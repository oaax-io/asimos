import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

type CompanyBilling = {
  name?: string;
  email?: string;
  phone?: string;
  tax_id?: { type: "ch_uid" | "eu_vat"; value: string };
  address?: {
    line1?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  };
};

async function loadCompanyBilling(
  supabase: ReturnType<typeof createStripeClient> extends never ? never : any,
  userId: string,
): Promise<CompanyBilling> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("agency_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.agency_id) return {};
  const { data: c } = await supabase
    .from("company")
    .select("name, legal_name, address, postal_code, city, country, phone, email, uid_number")
    .eq("agency_id", profile.agency_id)
    .maybeSingle();
  if (!c) return {};

  const countryCode = (c.country ?? "").trim().slice(0, 2).toUpperCase() || undefined;
  // UID like "CHE-123.456.789" → Stripe ch_uid; otherwise treat as EU VAT if non-CH.
  const uid = (c.uid_number ?? "").trim();
  let tax_id: CompanyBilling["tax_id"];
  if (uid) {
    tax_id = countryCode === "CH" || /^che[- ]?/i.test(uid)
      ? { type: "ch_uid", value: uid }
      : { type: "eu_vat", value: uid };
  }

  return {
    name: c.legal_name || c.name || undefined,
    email: c.email || undefined,
    phone: c.phone || undefined,
    tax_id,
    address: {
      line1: c.address || undefined,
      postal_code: c.postal_code || undefined,
      city: c.city || undefined,
      country: countryCode,
    },
  };
}

async function syncCustomerBilling(
  stripe: ReturnType<typeof createStripeClient>,
  customerId: string,
  billing: CompanyBilling,
) {
  const payload: any = {};
  if (billing.name) payload.name = billing.name;
  if (billing.phone) payload.phone = billing.phone;
  if (billing.address && Object.values(billing.address).some(Boolean)) {
    payload.address = billing.address;
  }
  if (Object.keys(payload).length) {
    await stripe.customers.update(customerId, payload);
  }
  // Sync tax id (idempotent: only add if missing)
  if (billing.tax_id) {
    const existing = await stripe.customers.listTaxIds(customerId, { limit: 10 });
    const match = existing.data.find(
      (t) => t.type === billing.tax_id!.type && t.value === billing.tax_id!.value,
    );
    if (!match) {
      try {
        await stripe.customers.createTaxId(customerId, billing.tax_id);
      } catch {
        // invalid UID format etc. — skip silently
      }
    }
  }
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string; billing?: CompanyBilling },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  let customerId: string | undefined;
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) customerId = found.data[0].id;
  }
  if (!customerId && options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (options.userId && c.metadata?.userId !== options.userId) {
        await stripe.customers.update(c.id, {
          metadata: { ...c.metadata, userId: options.userId },
        });
      }
      customerId = c.id;
    }
  }
  if (!customerId) {
    const created = await stripe.customers.create({
      ...(options.email && { email: options.email }),
      ...(options.userId && { metadata: { userId: options.userId } }),
      ...(options.billing?.name && { name: options.billing.name }),
      ...(options.billing?.phone && { phone: options.billing.phone }),
      ...(options.billing?.address &&
        Object.values(options.billing.address).some(Boolean) && {
          address: options.billing.address as any,
        }),
    });
    customerId = created.id;
  }
  if (options.billing) {
    await syncCustomerBilling(stripe, customerId, options.billing);
  }
  return customerId;
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

    const billing = await loadCompanyBilling(supabase, userId);
    const customerId = await resolveOrCreateCustomer(stripe, { email, userId, billing });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      customer_update: { name: "auto", address: "auto" },
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

export const createInvoicePaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceId: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_]+$/.test(data.invoiceId)) throw new Error("Invalid invoiceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ clientSecret: string; amount: number; currency: string }> => {
    const { supabase, userId } = context;
    const stripe = createStripeClient(data.environment);

    let invoice = await stripe.invoices.retrieve(data.invoiceId, { expand: ["payment_intent"] });
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) throw new Error("Rechnung hat keinen Kunden");

    // Authorize: invoice's customer must belong to this user.
    const customer = await stripe.customers.retrieve(customerId);
    const meta = (customer as any).metadata ?? {};
    let owned = meta.userId === userId;
    if (!owned) {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase();
      const custEmail = (customer as any).email?.toLowerCase();
      owned = !!email && !!custEmail && email === custEmail;
    }
    if (!owned) throw new Error("Nicht autorisiert");

    // Firmendaten am Stripe-Customer aktualisieren, damit künftige
    // Rechnungen die korrekten Empfängerdaten tragen.
    try {
      const billing = await loadCompanyBilling(supabase, userId);
      await syncCustomerBilling(stripe, customerId, billing);
    } catch {
      // non-fatal
    }

    if (invoice.status === "draft") {
      invoice = await stripe.invoices.finalizeInvoice(invoice.id!, { expand: ["payment_intent"] });
    }
    if (invoice.status === "paid") throw new Error("Rechnung ist bereits bezahlt");

    let pi: any = (invoice as any).payment_intent;
    if (typeof pi === "string") {
      pi = await stripe.paymentIntents.retrieve(pi);
    }

    // Invoices with collection_method='send_invoice' have no PaymentIntent.
    // Create a standalone PI for the outstanding amount, link via metadata,
    // and we'll mark the invoice paid_out_of_band after confirmation.
    if (!pi) {
      pi = await stripe.paymentIntents.create({
        amount: invoice.amount_remaining ?? 0,
        currency: invoice.currency ?? "chf",
        customer: customerId,
        description: `Rechnung ${invoice.number ?? invoice.id}`,
        automatic_payment_methods: { enabled: true },
        metadata: {
          invoice_id: invoice.id ?? "",
          userId,
        },
      });
    }

    return {
      clientSecret: pi.client_secret as string,
      amount: (invoice.amount_remaining ?? 0) / 100,
      currency: invoice.currency ?? "chf",
    };
  });

export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceId: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_]+$/.test(data.invoiceId)) throw new Error("Invalid invoiceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const stripe = createStripeClient(data.environment);

    const invoice = await stripe.invoices.retrieve(data.invoiceId);
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) throw new Error("Rechnung hat keinen Kunden");

    const customer = await stripe.customers.retrieve(customerId);
    const meta = (customer as any).metadata ?? {};
    let owned = meta.userId === userId;
    if (!owned) {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase();
      const custEmail = (customer as any).email?.toLowerCase();
      owned = !!email && !!custEmail && email === custEmail;
    }
    if (!owned) throw new Error("Nicht autorisiert");

    if (invoice.status !== "paid") {
      await stripe.invoices.pay(invoice.id!, { paid_out_of_band: true });
    }
    return { ok: true };
  });
