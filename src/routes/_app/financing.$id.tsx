import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, User, Building2, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  FINANCING_TYPE_LABELS, DOSSIER_STATUS_LABELS, QUICK_CHECK_LABELS,
  type FinancingType, type DossierStatus, type QuickCheckStatus,
} from "@/lib/financing";
import { FinancingSelfDisclosureTab } from "@/components/financing/FinancingSelfDisclosureTab";
import { UbsChecklistTab } from "@/components/financing/UbsChecklistTab";
import { FinancingDocumentsTab } from "@/components/financing/FinancingDocumentsTab";
import { BankSubmissionTab } from "@/components/financing/BankSubmissionTab";
import { DossierQualityCard } from "@/components/financing/DossierQualityCard";

export const Route = createFileRoute("/_app/financing/$id")({ component: FinancingDetailPage });

function FinancingDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: dossier, isLoading } = useQuery({
    queryKey: ["financing_dossier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [clientRes, propRes] = await Promise.all([
        data.client_id
          ? supabase.from("clients").select("id, full_name, email, phone").eq("id", data.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        data.property_id
          ? supabase.from("properties").select("id, title, city, price").eq("id", data.property_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { ...data, clients: clientRes.data, properties: propRes.data } as any;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;
  if (!dossier) return <p className="text-sm text-muted-foreground">Dossier nicht gefunden.</p>;

  const reasons = (dossier.quick_check_reasons as any[]) ?? [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/financing" })}>
        <ArrowLeft className="mr-1 h-4 w-4" />Zurück
      </Button>

      <PageHeader
        title={dossier.title || FINANCING_TYPE_LABELS[dossier.financing_type as FinancingType] || "Finanzierung"}
        description={
          [
            FINANCING_TYPE_LABELS[dossier.financing_type as FinancingType],
            dossier.clients?.full_name,
            dossier.properties?.title,
          ].filter(Boolean).join(" · ")
        }
        action={
          <div className="flex gap-2">
            <Badge>{DOSSIER_STATUS_LABELS[dossier.dossier_status as DossierStatus] ?? "Entwurf"}</Badge>
            {dossier.quick_check_status && (
              <Badge variant="outline">{QUICK_CHECK_LABELS[dossier.quick_check_status as QuickCheckStatus]}</Badge>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Banknote} label="Gesamtinvestition" value={fmt(dossier.total_investment)} />
        <Stat icon={Banknote} label="Hypothek" value={fmt(dossier.requested_mortgage)} />
        <Stat icon={Banknote} label="Eigenmittel" value={fmt(dossier.own_funds_total)} />
        <Stat icon={Banknote} label="Tragbarkeit" value={dossier.affordability_ratio != null ? `${Number(dossier.affordability_ratio).toFixed(1)}%` : "—"} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="quickcheck">Quick Check</TabsTrigger>
          <TabsTrigger value="disclosure">Selbstauskunft</TabsTrigger>
          <TabsTrigger value="ubs">UBS Checkliste</TabsTrigger>
          <TabsTrigger value="documents">Dokumente</TabsTrigger>
          <TabsTrigger value="bank">Bank Einreichung</TabsTrigger>
          <TabsTrigger value="activity">Aktivität</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" />Kunde</h3>
                {dossier.clients ? (
                  <Link to="/clients/$id" params={{ id: dossier.clients.id }} className="text-sm text-primary hover:underline">
                    {dossier.clients.full_name}
                  </Link>
                ) : <p className="text-sm text-muted-foreground">—</p>}
                {dossier.clients?.email && <p className="text-xs text-muted-foreground">{dossier.clients.email}</p>}
                {dossier.clients?.phone && <p className="text-xs text-muted-foreground">{dossier.clients.phone}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" />Immobilie</h3>
                {dossier.properties ? (
                  <Link to="/properties/$id" params={{ id: dossier.properties.id }} className="text-sm text-primary hover:underline">
                    {dossier.properties.title}
                  </Link>
                ) : <p className="text-sm text-muted-foreground">Keine Immobilie verknüpft</p>}
                {dossier.properties?.city && <p className="text-xs text-muted-foreground">{dossier.properties.city}</p>}
              </CardContent>
            </Card>
          </div>
          <DossierQualityCard dossierId={dossier.id} dossier={dossier} />
        </TabsContent>

        <TabsContent value="quickcheck" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KV label="Kaufpreis" value={fmt(dossier.purchase_price)} />
            <KV label="Renovationskosten" value={fmt(dossier.renovation_costs)} />
            <KV label="Gesamtinvestition" value={fmt(dossier.total_investment)} />
            <KV label="Hypothek" value={fmt(dossier.requested_mortgage)} />
            <KV label="Belehnung" value={dossier.loan_to_value_ratio != null ? `${Number(dossier.loan_to_value_ratio).toFixed(1)}%` : "—"} />
            <KV label="Eigenmittel total" value={fmt(dossier.own_funds_total)} />
            <KV label="Pensionskasse" value={fmt(dossier.own_funds_pension_fund)} />
            <KV label="Freizügigkeit" value={fmt(dossier.own_funds_vested_benefits)} />
            <KV label="Bruttoeinkommen jährlich" value={fmt(dossier.gross_income_yearly)} />
            <KV label="Kalkulatorischer Zinssatz" value={`${Number(dossier.calculated_interest_rate ?? 5).toFixed(2)}%`} />
            <KV label="Nebenkosten jährlich" value={fmt(dossier.ancillary_costs_yearly)} />
            <KV label="Amortisation jährlich" value={fmt(dossier.amortisation_yearly)} />
            <KV label="Tragbarkeit" value={dossier.affordability_ratio != null ? `${Number(dossier.affordability_ratio).toFixed(1)}%` : "—"} />
          </div>
          {reasons.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Bewertung</h3>
                <ul className="space-y-1 text-sm">
                  {reasons.map((r, i) => (
                    <li key={i} className={
                      r.tone === "ok" ? "text-emerald-600" :
                      r.tone === "warn" ? "text-amber-600" :
                      r.tone === "bad" ? "text-red-600" : ""
                    }>• {r.label}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="disclosure">
          <FinancingSelfDisclosureTab
            dossierId={dossier.id}
            clientId={dossier.client_id}
            clientEmail={dossier.clients?.email}
          />
        </TabsContent>
        <TabsContent value="ubs">
          <UbsChecklistTab dossierId={dossier.id} />
        </TabsContent>
        <TabsContent value="documents">
          <FinancingDocumentsTab
            dossierId={dossier.id}
            clientId={dossier.client_id}
            propertyId={dossier.property_id}
          />
        </TabsContent>
        <TabsContent value="bank">
          <BankSubmissionTab dossierId={dossier.id} />
        </TabsContent>
        <TabsContent value="activity">
          <p className="text-sm text-muted-foreground">Aktivitätenverlauf folgt in einer späteren Phase.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function fmt(v: any) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return formatCurrency(n);
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
