import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getStripeEnvironment } from "@/lib/stripe";
import { AlertTriangle, Clock, CreditCard, Info } from "lucide-react";

/**
 * Abo-Banner für Dashboard.
 * - Inhaber: voller CTA-Banner (zahlen / aktualisieren).
 * - Superadmin (Systemowner): nur Info-Hinweis, keine Aktion.
 * - Andere Rollen: nichts.
 *
 * Es wird KEIN Zugriff blockiert – Banner ist rein informativ.
 */
export function SubscriptionBanner() {
  const { user, isSuperadmin } = useAuth();

  const profileQuery = useQuery({
    queryKey: ["subscription-banner-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("role, agency_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const role = profileQuery.data?.role;
  const agencyId = profileQuery.data?.agency_id as string | undefined;
  const isOwner = role === "owner";
  const shouldShow = isOwner || isSuperadmin;

  const subQuery = useQuery({
    queryKey: ["subscription-banner", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data } = await supabase
        .from("subscriptions")
        .select("status, current_period_end, cancel_at_period_end")
        .eq("agency_id", agencyId)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!agencyId && shouldShow,
    refetchInterval: 60_000,
  });

  if (!shouldShow) return null;
  if (profileQuery.isLoading || subQuery.isLoading) return null;

  const sub = subQuery.data as any;
  const now = new Date();
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const daysToEnd = periodEnd ? Math.ceil((periodEnd.getTime() - now.getTime()) / 86_400_000) : null;

  // --- Fall 1: Kein Abo ---
  if (!sub) {
    return (
      <BannerShell tone="warn" icon={CreditCard}>
        <div className="flex-1">
          <p className="font-medium">
            {isOwner ? "Bitte aktiviere dein ASIMOS-Abonnement." : "Diese Agentur hat noch kein aktives Abonnement."}
          </p>
          <p className="text-xs opacity-90">
            CHF 89.90 / Monat. Der Zugriff bleibt vorerst bestehen, eine Aktivierung ist aber erforderlich.
          </p>
        </div>
        {isOwner && (
          <Link
            to="/settings"
            search={{ tab: "subscription" } as any}
            className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-950"
          >
            Jetzt abonnieren
          </Link>
        )}
      </BannerShell>
    );
  }

  // --- Fall 2: Zahlung fehlgeschlagen / überfällig ---
  if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete") {
    return (
      <BannerShell tone="danger" icon={AlertTriangle}>
        <div className="flex-1">
          <p className="font-medium">
            {isOwner
              ? "Zahlung fehlgeschlagen – bitte Zahlungsmethode aktualisieren."
              : "Zahlung des Inhabers ist überfällig."}
          </p>
          <p className="text-xs opacity-90">
            Stripe wiederholt den Einzug automatisch. Dein Zugriff bleibt bestehen – bitte zeitnah handeln.
          </p>
        </div>
        {isOwner && (
          <Link
            to="/settings"
            search={{ tab: "subscription" } as any}
            className="rounded-md bg-red-900 px-3 py-1.5 text-xs font-medium text-red-50 hover:bg-red-950"
          >
            Zahlungsmethode aktualisieren
          </Link>
        )}
      </BannerShell>
    );
  }

  // --- Fall 3: Gekündigt (läuft noch bis Periodenende) ---
  if (sub.status === "canceled" && periodEnd && periodEnd > now) {
    return (
      <BannerShell tone="warn" icon={Info}>
        <div className="flex-1">
          <p className="font-medium">
            Abonnement gekündigt – Zugriff bis {periodEnd.toLocaleDateString("de-CH")}.
          </p>
          {isOwner && (
            <p className="text-xs opacity-90">
              Reaktiviere jederzeit, um Unterbruch zu vermeiden.
            </p>
          )}
        </div>
        {isOwner && (
          <Link to="/settings" search={{ tab: "subscription" } as any}
            className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-950">
            Reaktivieren
          </Link>
        )}
      </BannerShell>
    );
  }

  // --- Fall 4: Aktiv, kurz vor nächster Abbuchung ---
  if ((sub.status === "active" || sub.status === "trialing") && daysToEnd !== null && daysToEnd <= 7 && !sub.cancel_at_period_end) {
    return (
      <BannerShell tone="info" icon={Clock}>
        <div className="flex-1">
          <p className="font-medium">
            Nächste Abbuchung (CHF 89.90) {daysToEnd <= 1 ? "morgen" : `in ${daysToEnd} Tagen`} – am {periodEnd!.toLocaleDateString("de-CH")}.
          </p>
          <p className="text-xs opacity-90">Stelle sicher, dass deine Zahlungsmethode aktuell ist.</p>
        </div>
      </BannerShell>
    );
  }

  // --- Aktiv & alles ok: kein Banner ---
  return null;
}

function BannerShell({
  tone,
  icon: Icon,
  children,
}: {
  tone: "danger" | "warn" | "info";
  icon: any;
  children: React.ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "bg-red-50 border-red-300 text-red-900"
      : tone === "warn"
      ? "bg-amber-50 border-amber-300 text-amber-900"
      : "bg-blue-50 border-blue-300 text-blue-900";
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 ${cls}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex flex-1 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
