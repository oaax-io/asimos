import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    returnUrl: string;
    environment: StripeEnv;
    agencyId?: string;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email;

    const stripe = createStripeClient(data.environment);
    const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];

    const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      metadata: { userId, ...(data.agencyId && { agencyId: data.agencyId }) },
      subscription_data: {
        metadata: { userId, ...(data.agencyId && { agencyId: data.agencyId }) },
      },
    });

    return session.client_secret;
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_customer_id) throw new Error("Kein Abonnement gefunden");

    const stripe = createStripeClient(data.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      ...(data.returnUrl && { return_url: data.returnUrl }),
    });
    return portal.url;
  });

export type InvoiceRow = {
  id: string;
  number: string | null;
  status: string | null;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  created: string | null;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  days_overdue: number;
};

export const listInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<InvoiceRow[]> => {
    const { supabase, userId } = context;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const stripe = createStripeClient(data.environment);

    // Resolve customers: prefer DB, plus Stripe search by metadata.userId, then email.
    const customerIds = new Set<string>();
    if (sub?.stripe_customer_id) customerIds.add(sub.stripe_customer_id as string);
    if (/^[a-zA-Z0-9_-]+$/.test(userId)) {
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 10,
      });
      for (const c of found.data) customerIds.add(c.id);
    }
    if (customerIds.size === 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const byEmail = await stripe.customers.list({ email: user.email, limit: 10 });
        for (const c of byEmail.data) customerIds.add(c.id);
      }
    }
    if (customerIds.size === 0) return [];

    const allInvoices = (
      await Promise.all(
        [...customerIds].map((customer) =>
          stripe.invoices.list({ customer, limit: 36 }).then((r) => r.data),
        ),
      )
    ).flat();

    const now = Date.now();
    const toIso = (s: number | null | undefined) =>
      s ? new Date(s * 1000).toISOString() : null;

    const rows = allInvoices.map((inv) => {
      const dueTs = (inv.due_date ?? inv.created) * 1000;
      const overdue =
        inv.status === "open" || inv.status === "uncollectible"
          ? Math.max(0, Math.floor((now - dueTs) / 86_400_000))
          : 0;
      // Prefer the billing period of the first line item (correct month),
      // fall back to the invoice-level period.
      const linePeriod = (inv.lines?.data?.[0] as any)?.period as
        | { start?: number; end?: number }
        | undefined;
      return {
        id: inv.id ?? "",
        number: inv.number ?? null,
        status: inv.status ?? null,
        amount_due: (inv.amount_due ?? 0) / 100,
        amount_paid: (inv.amount_paid ?? 0) / 100,
        amount_remaining: (inv.amount_remaining ?? 0) / 100,
        currency: inv.currency ?? "chf",
        created: toIso(inv.created),
        due_date: toIso(inv.due_date ?? inv.created),
        period_start: toIso(linePeriod?.start ?? inv.period_start),
        period_end: toIso(linePeriod?.end ?? inv.period_end),
        hosted_invoice_url: inv.hosted_invoice_url ?? null,
        invoice_pdf: inv.invoice_pdf ?? null,
        days_overdue: overdue,
      };
    });

    rows.sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));
    return rows;
  });
