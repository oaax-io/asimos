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
    </div>
  );
}
