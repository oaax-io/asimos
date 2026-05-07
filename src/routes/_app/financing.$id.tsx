import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, User, Building2, Banknote, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  FINANCING_TYPE_LABELS, DOSSIER_STATUS_LABELS, QUICK_CHECK_LABELS,
  calcQuickCheck,
  type FinancingType, type DossierStatus, type QuickCheckStatus,
} from "@/lib/financing";
import { cn } from "@/lib/utils";
import { FinancingSelfDisclosureTab } from "@/components/financing/FinancingSelfDisclosureTab";
import { UbsChecklistTab } from "@/components/financing/UbsChecklistTab";
import { FinancingDocumentsTab } from "@/components/financing/FinancingDocumentsTab";
import { BankSubmissionTab } from "@/components/financing/BankSubmissionTab";
import { DossierQualityCard } from "@/components/financing/DossierQualityCard";
import { FinancingQuickCheckActions } from "@/components/financing/FinancingQuickCheckActions";
import { FinancingQuickCheckWizard } from "@/components/financing/FinancingQuickCheckWizard";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/financing/$id")({ component: FinancingDetailPage });

function FinancingDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

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

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("financing_dossiers")
        .update({ quick_check_status: "incomplete" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quick Check zurückgesetzt");
      setResetOpen(false);
      queryClient.invalidateQueries({ queryKey: ["financing_dossier", id] });
      queryClient.invalidateQueries({ queryKey: ["financing_dossiers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Zurücksetzen fehlgeschlagen"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;
  if (!dossier) return <p className="text-sm text-muted-foreground">Dossier nicht gefunden.</p>;

  const reasons = (dossier.quick_check_reasons as any[]) ?? [];
  const qcStatus = (dossier.quick_check_status ?? "incomplete") as QuickCheckStatus;
  const isIncomplete = qcStatus === "incomplete";
  const lastCheckAt = dossier.updated_at ? formatDateTime(dossier.updated_at) : null;

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

        <TabsContent value="quickcheck" className="space-y-4">
          {isIncomplete ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold">Quick Check starten</h3>
                  <p className="text-sm text-muted-foreground">
                    Erfasse die Eckdaten der Finanzierung im Wizard. Nach Abschluss erscheint hier das Ergebnis.
                  </p>
                </div>
                <Button onClick={() => setWizardOpen(true)}>Quick Check starten</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                  <Badge className={qcBadgeTone(qcStatus)}>{QUICK_CHECK_LABELS[qcStatus]}</Badge>
                  {lastCheckAt && (
                    <span className="text-sm text-muted-foreground">
                      Letzter Quick Check: {lastCheckAt}
                    </span>
                  )}
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
                      <RotateCcw className="mr-1 h-4 w-4" />Neu berechnen
                    </Button>
                    <FinancingQuickCheckActions
                      dossierId={dossier.id}
                      dossier={dossier}
                      showWorkflowButtons={false}
                    />
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="vorpruefung">
                <TabsList>
                  <TabsTrigger value="vorpruefung">Vorprüfung</TabsTrigger>
                  <TabsTrigger value="detail">Detailrechnung</TabsTrigger>
                  <TabsTrigger value="szenarien">Szenarien</TabsTrigger>
                </TabsList>

                <TabsContent value="vorpruefung" className="space-y-3">
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

                <TabsContent value="detail">
                  <Card>
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      Detailrechnung folgt.
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="szenarien">
                  <Card>
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      Szenarien folgen.
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
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

      <FinancingQuickCheckWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        defaultClientId={dossier.client_id ?? undefined}
        defaultPropertyId={dossier.property_id ?? undefined}
        onCreated={(newId) => {
          setWizardOpen(false);
          queryClient.invalidateQueries({ queryKey: ["financing_dossier", id] });
          if (newId !== id) navigate({ to: "/financing/$id", params: { id: newId } });
        }}
      />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quick Check zurücksetzen und neu starten?</AlertDialogTitle>
            <AlertDialogDescription>
              Die gespeicherten Werte bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              Zurücksetzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatDateTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function qcBadgeTone(s: QuickCheckStatus): string {
  if (s === "realistic") return "bg-emerald-600 hover:bg-emerald-600 text-white";
  if (s === "critical") return "bg-amber-500 hover:bg-amber-500 text-white";
  if (s === "not_financeable") return "bg-red-600 hover:bg-red-600 text-white";
  return "bg-secondary text-secondary-foreground hover:bg-secondary";
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
