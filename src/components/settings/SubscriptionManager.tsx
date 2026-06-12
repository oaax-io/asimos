import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, ExternalLink, FileText, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { createPortalSession, listInvoices } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

const PRICE_ID = "asimos_monthly";
const PRICE_LABEL = "CHF 89.90 / Monat";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  trialing: "Testphase",
  past_due: "Zahlung überfällig",
  canceled: "Gekündigt",
  incomplete: "Unvollständig",
  unpaid: "Unbezahlt",
  paused: "Pausiert",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  trialing: "default",
  past_due: "destructive",
  canceled: "secondary",
  incomplete: "outline",
  unpaid: "destructive",
  paused: "secondary",
};

export function SubscriptionManager() {
  const { user, isSuperadmin } = useAuth();
  const qc = useQueryClient();
  const [showCheckout, setShowCheckout] = useState(false);

  const meQuery = useQuery({
    queryKey: ["me-role"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role, agency_id")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const isOwner = meQuery.data?.role === "owner";
  const agencyId = meQuery.data?.agency_id as string | undefined;

  const subQuery = useQuery({
    queryKey: ["subscription", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!agencyId,
    refetchInterval: showCheckout ? 5000 : false,
  });

  const portal = useMutation({
    mutationFn: async () => {
      return await createPortalSession({
        data: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/settings`,
        },
      });
    },
    onSuccess: (url) => {
      window.open(url, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (meQuery.isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>;
  }

  const sub = subQuery.data as any;
  const isActive = sub && (
    (["active", "trialing", "past_due"].includes(sub.status) && (!sub.current_period_end || new Date(sub.current_period_end) > new Date()))
    || (sub.status === "canceled" && sub.current_period_end && new Date(sub.current_period_end) > new Date())
  );

  // Systemowner (Lovable) sieht nur Status, zahlt nicht
  if (isSuperadmin && !isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Abonnement-Status (Systemowner-Ansicht)</CardTitle>
          <CardDescription>Du als Systemowner siehst hier den Abo-Status, zahlst aber nicht selbst.</CardDescription>
        </CardHeader>
        <CardContent>
          {sub ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANTS[sub.status] ?? "outline"}>{STATUS_LABELS[sub.status] ?? sub.status}</Badge>
                {sub.cancel_at_period_end && <Badge variant="outline">Kündigung zum Periodenende</Badge>}
              </div>
              {sub.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  Laufzeit bis: {new Date(sub.current_period_end).toLocaleDateString("de-CH")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Kein aktives Abonnement für diese Agentur.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Abonnement</CardTitle>
          <CardDescription>Nur der Inhaber der Agentur kann das Abonnement verwalten.</CardDescription>
        </CardHeader>
        <CardContent>
          {sub && isActive ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm">Aktives Abonnement: {PRICE_LABEL}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Kein aktives Abonnement.</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <PaymentTestModeBanner />

      <Card>
        <CardHeader>
          <CardTitle>ASIMOS Abonnement</CardTitle>
          <CardDescription>Vollzugriff auf ASIMOS für CHF 89.90 pro Monat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sub && isActive ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANTS[sub.status] ?? "outline"}>{STATUS_LABELS[sub.status] ?? sub.status}</Badge>
                {sub.cancel_at_period_end && <Badge variant="outline">Kündigung geplant</Badge>}
              </div>
              {sub.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  {sub.cancel_at_period_end ? "Zugriff bis" : "Nächste Abbuchung am"}:{" "}
                  {new Date(sub.current_period_end).toLocaleDateString("de-CH")}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={() => portal.mutate()} disabled={portal.isPending} variant="outline">
                  {portal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                  Rechnungen & Zahlungsmethode verwalten
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-semibold">ASIMOS Pro</span>
                  <span className="text-2xl font-bold">{PRICE_LABEL}</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mt-3">
                  <li>• Vollzugriff auf Immobilien-CRM</li>
                  <li>• Finanzierung & Selbstauskunft</li>
                  <li>• Dokumente, Vorlagen & E-Sign</li>
                  <li>• Matching & Lead-Verwaltung</li>
                  <li>• Unbegrenzte Mitarbeiter</li>
                </ul>
              </div>

              {!showCheckout ? (
                <Button onClick={() => setShowCheckout(true)} size="lg">
                  Jetzt abonnieren
                </Button>
              ) : (
                <div className="space-y-2">
                  <StripeEmbeddedCheckout priceId={PRICE_ID} agencyId={agencyId} />
                  <Button variant="ghost" size="sm" onClick={() => setShowCheckout(false)}>
                    Abbrechen
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && sub?.stripe_customer_id && <InvoiceHistory />}
    </div>
  );
}

function InvoiceHistory() {
  const env = getStripeEnvironment();
  const invoicesQuery = useQuery({
    queryKey: ["invoices", env],
    queryFn: async () => await listInvoices({ data: { environment: env } }),
    refetchInterval: 60_000,
  });

  const invoices = invoicesQuery.data ?? [];
  const openInvoices = invoices.filter((i) => i.status === "open" || i.status === "uncollectible");
  const totalDue = openInvoices.reduce((sum, i) => sum + i.amount_remaining, 0);

  const fmt = (cents: number, currency: string) =>
    new Intl.NumberFormat("de-CH", { style: "currency", currency: currency.toUpperCase() }).format(cents);

  const statusLabel = (s: string | null, days: number) => {
    if (s === "paid") return { text: "Bezahlt", variant: "default" as const };
    if (s === "open" && days > 0) return { text: `Überfällig (${days} T.)`, variant: "destructive" as const };
    if (s === "open") return { text: "Offen", variant: "outline" as const };
    if (s === "uncollectible") return { text: "Uneinbringlich", variant: "destructive" as const };
    if (s === "void") return { text: "Storniert", variant: "secondary" as const };
    if (s === "draft") return { text: "Entwurf", variant: "secondary" as const };
    return { text: s ?? "—", variant: "outline" as const };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Zahlungshistorie
        </CardTitle>
        <CardDescription>
          Monatliche Abrechnungen, offene Posten und Zahlungen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoicesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Rechnungen …
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Noch keine Rechnungen vorhanden.</p>
        ) : (
          <div className="space-y-3">
            {openInvoices.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-destructive">
                    {openInvoices.length} offene Rechnung{openInvoices.length > 1 ? "en" : ""} – insgesamt{" "}
                    {fmt(totalDue, openInvoices[0].currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Du kannst jede Rechnung einzeln bezahlen. Das Abo läuft normal weiter.
                  </p>
                </div>
              </div>
            )}

            <div className="divide-y border rounded-lg overflow-hidden">
              {invoices.map((inv) => {
                const s = statusLabel(inv.status, inv.days_overdue);
                const period = inv.period_start && inv.period_end
                  ? `${new Date(inv.period_start).toLocaleDateString("de-CH", { month: "short", year: "numeric" })}`
                  : inv.created
                  ? new Date(inv.created).toLocaleDateString("de-CH", { month: "short", year: "numeric" })
                  : "—";
                const isOpen = inv.status === "open" || inv.status === "uncollectible";
                return (
                  <div key={inv.id} className="flex flex-wrap items-center gap-3 p-3 hover:bg-muted/30">
                    <div className="flex-1 min-w-[140px]">
                      <div className="font-medium capitalize">{period}</div>
                      <div className="text-xs text-muted-foreground">
                        {inv.number ?? inv.id.slice(0, 12)}
                        {inv.due_date && ` · fällig ${new Date(inv.due_date).toLocaleDateString("de-CH")}`}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {fmt(isOpen ? inv.amount_remaining : inv.amount_paid, inv.currency)}
                    </div>
                    <Badge variant={s.variant}>{s.text}</Badge>
                    <div className="flex gap-1">
                      {isOpen && inv.hosted_invoice_url && (
                        <Button asChild size="sm">
                          <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
                            Jetzt bezahlen
                          </a>
                        </Button>
                      )}
                      {inv.invoice_pdf && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={inv.invoice_pdf} target="_blank" rel="noreferrer" title="PDF herunterladen">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
