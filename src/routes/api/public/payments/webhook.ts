import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

function resolvePriceId(item: any): string {
  return item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
}

async function resolveAgencyId(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data } = await (getSupabase() as any)
    .from("profiles")
    .select("agency_id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.agency_id as string | null) ?? null;
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const agencyId = subscription.metadata?.agencyId ?? (await resolveAgencyId(userId));
  const item = subscription.items?.data?.[0];
  const priceId = resolvePriceId(item);
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  // Bestehende Zeile lesen, um neu vs. update zu unterscheiden
  const { data: prev } = await (getSupabase() as any)
    .from("subscriptions")
    .select("status")
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env)
    .maybeSingle();

  await (getSupabase() as any).from("subscriptions").upsert(
    {
      user_id: userId,
      agency_id: agencyId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  // Nur einmal benachrichtigen — beim ersten Aktivieren
  if (!prev && (subscription.status === "active" || subscription.status === "trialing")) {
    await notifySubscriptionActivated(agencyId, userId);
  }
}


async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = resolvePriceId(item);
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  // Vorherigen Status lesen, um nur bei Statuswechsel zu benachrichtigen
  const { data: prev } = await (getSupabase() as any)
    .from("subscriptions")
    .select("status, user_id, agency_id")
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env)
    .maybeSingle();

  await (getSupabase() as any)
    .from("subscriptions")
    .update({
      status: subscription.status,
      product_id: productId,
      price_id: priceId,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  // Benachrichtigung bei Eintritt in past_due / unpaid
  const dunningStatuses = new Set(["past_due", "unpaid"]);
  if (dunningStatuses.has(subscription.status) && !dunningStatuses.has(prev?.status ?? "")) {
    await notifyPaymentFailed(prev?.agency_id ?? null, prev?.user_id ?? null);
  }
  // Benachrichtigung wenn Zahlung wieder erfolgreich
  if (subscription.status === "active" && dunningStatuses.has(prev?.status ?? "")) {
    await notifyPaymentRecovered(prev?.agency_id ?? null, prev?.user_id ?? null);
  }
}

async function notifyPaymentFailed(agencyId: string | null, ownerUserId: string | null) {
  const sb = getSupabase() as any;
  const recipients = new Set<string>();

  // Inhaber der Agentur
  if (agencyId) {
    const { data: owners } = await sb
      .from("profiles")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("role", "owner");
    for (const o of owners ?? []) recipients.add(o.id);
  }
  if (ownerUserId) recipients.add(ownerUserId);

  // Superadmins (Systemowner)
  const { data: sas } = await sb
    .from("user_roles")
    .select("user_id")
    .eq("role", "superadmin");
  for (const s of sas ?? []) recipients.add(s.user_id);

  for (const uid of recipients) {
    await sb.rpc("create_notification", {
      _user_id: uid,
      _type: "task",
      _title: "ASIMOS-Zahlung fehlgeschlagen",
      _message: "Die monatliche Abrechnung konnte nicht eingezogen werden. Bitte Zahlungsmethode aktualisieren.",
      _link: "/settings?tab=subscription",
      _related_type: "subscription",
      _related_id: null,
    });
  }
}

async function notifyPaymentRecovered(agencyId: string | null, ownerUserId: string | null) {
  const sb = getSupabase() as any;
  const recipients = new Set<string>();
  if (agencyId) {
    const { data: owners } = await sb.from("profiles").select("id").eq("agency_id", agencyId).eq("role", "owner");
    for (const o of owners ?? []) recipients.add(o.id);
  }
  if (ownerUserId) recipients.add(ownerUserId);
  for (const uid of recipients) {
    await sb.rpc("create_notification", {
      _user_id: uid,
      _type: "task",
      _title: "Zahlung erfolgreich",
      _message: "Deine ASIMOS-Zahlung wurde erfolgreich eingezogen. Vielen Dank.",
      _link: "/settings?tab=subscription",
      _related_type: "subscription",
      _related_id: null,
    });
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await (getSupabase() as any)
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
