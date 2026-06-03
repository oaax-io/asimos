import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, User, Building2, Banknote, RotateCcw, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
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
import { ActivityTab, logActivity } from "@/components/ActivityTab";

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
      const [clientRes, propRes, coRes] = await Promise.all([
        data.client_id
          ? supabase.from("clients").select("id, full_name, email, phone").eq("id", data.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        data.property_id
          ? supabase.from("properties").select("id, title, city, price").eq("id", data.property_id).maybeSingle()
          : Promise.resolve({ data: null }),
        (data as { co_applicant_client_id?: string | null }).co_applicant_client_id
          ? supabase.from("clients").select("id, full_name").eq("id", (data as { co_applicant_client_id: string }).co_applicant_client_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { ...data, clients: clientRes.data, properties: propRes.data, co_applicant: coRes.data } as any;
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("financing_dossiers")
        .update({ quick_check_status: "incomplete" })
        .eq("id", id);
      if (error) throw error;
      await logActivity({
        relatedType: "financing_dossier",
        relatedId: id,
        action: "Quick Check zurückgesetzt",
      });
    },
    onSuccess: () => {
      toast.success("Quick Check zurückgesetzt");
      setResetOpen(false);
      queryClient.invalidateQueries({ queryKey: ["financing_dossier", id] });
      queryClient.invalidateQueries({ queryKey: ["financing_dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs", "financing_dossier", id] });
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

                <TabsContent value="vorpruefung" className="space-y-4">
                  <QuickCheckVorpruefung dossier={dossier} />
                </TabsContent>

                <TabsContent value="detail" className="space-y-4">
                  <QuickCheckDetail dossier={dossier} />
                </TabsContent>

                <TabsContent value="szenarien" className="space-y-4">
                  <QuickCheckScenarios dossier={dossier} />
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
          <ActivityTab relatedType="financing_dossier" relatedId={id} />
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

// ───────── Quick Check Sub-Tabs ─────────

type Dossier = Record<string, unknown> & {
  purchase_price?: number | string | null;
  renovation_costs?: number | string | null;
  requested_mortgage?: number | string | null;
  own_funds_total?: number | string | null;
  own_funds_pension_fund?: number | string | null;
  own_funds_vested_benefits?: number | string | null;
  gross_income_yearly?: number | string | null;
  calculated_interest_rate?: number | string | null;
  ancillary_costs_yearly?: number | string | null;
  amortisation_yearly?: number | string | null;
  co_applicant_client_id?: string | null;
  co_applicant_role?: string | null;
  co_applicant_einkommen?: number | string | null;
  co_applicant_eigenkapital?: number | string | null;
  co_applicant_pk_anteil?: number | string | null;
  einkommen_kombiniert?: number | string | null;
  eigenkapital_kombiniert?: number | string | null;
  pk_anteil_kombiniert?: number | string | null;
  co_applicant?: { id: string; full_name: string } | null;
  clients?: { id: string; full_name: string; email?: string | null; phone?: string | null } | null;
};

function n(v: unknown, fallback = 0): number {
  const x = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? x : fallback;
}
function chf(v: number): string {
  return formatCurrency(Math.round(v));
}
function chfCompact(v: number): string {
  const k = v / 1000;
  if (Math.abs(k) >= 1000) return `${(k / 1000).toFixed(1)}M`;
  return `${Math.round(k)}k`;
}
function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

type Inputs = {
  total: number;
  purchase: number;
  reno: number;
  mortgage: number;
  equity: number;
  pension: number;
  vested: number;
  hardEquity: number;
  income: number;
  rate: number;
  ancillaryPct: number;
  ancillary: number;
  firstMortgage: number;
  secondMortgage: number;
  amortYears: number;
  amort: number;
  yearly: number;
  interest: number;
  ltv: number;
  affordability: number;
  equityRatio: number;
  hardRatio: number;
  minIncome: number;
};

function deriveInputs(d: Dossier): Inputs {
  const purchase = n(d.purchase_price);
  const reno = n(d.renovation_costs);
  const total = purchase + reno;
  const mortgage = n(d.requested_mortgage);
  
  const equity = d.eigenkapital_kombiniert != null && d.eigenkapital_kombiniert !== ""
    ? n(d.eigenkapital_kombiniert) : n(d.own_funds_total);
  const pension = d.pk_anteil_kombiniert != null && d.pk_anteil_kombiniert !== ""
    ? n(d.pk_anteil_kombiniert) : n(d.own_funds_pension_fund);
  const vested = n(d.own_funds_vested_benefits);
  const pensionRelated = pension + vested;
  const hardEquity = Math.max(0, equity - pensionRelated);
  const income = d.einkommen_kombiniert != null && d.einkommen_kombiniert !== ""
    ? n(d.einkommen_kombiniert) : n(d.gross_income_yearly);
  const rate = n(d.calculated_interest_rate, 5);
  const ancillary = d.ancillary_costs_yearly != null && d.ancillary_costs_yearly !== ""
    ? n(d.ancillary_costs_yearly)
    : total * 0.01;
  const ancillaryPct = total > 0 ? (ancillary / total) * 100 : 1;
  const firstMortgageMax = total * 0.6667;
  const firstMortgage = Math.min(mortgage, firstMortgageMax);
  const secondMortgage = Math.max(0, mortgage - firstMortgageMax);
  const amortYears = 15;
  const amort = d.amortisation_yearly != null && d.amortisation_yearly !== ""
    ? n(d.amortisation_yearly)
    : secondMortgage / amortYears;
  const interest = mortgage * (rate / 100);
  const yearly = interest + ancillary + amort;
  const ltv = total > 0 ? (mortgage / total) * 100 : 0;
  const affordability = income > 0 ? (yearly / income) * 100 : 0;
  const equityRatio = total > 0 ? (equity / total) * 100 : 0;
  const hardRatio = total > 0 ? (hardEquity / total) * 100 : 0;
  const minIncome = yearly > 0 ? yearly / 0.33 : 0;
  return {
    total, purchase, reno, mortgage, equity, pension, vested, hardEquity,
    income, rate, ancillary, ancillaryPct, firstMortgage, secondMortgage,
    amortYears, amort, yearly, interest, ltv, affordability, equityRatio,
    hardRatio, minIncome,
  };
}

function toneFor(value: number, limit: number, warn: number, mode: "max" | "min"): "ok" | "warn" | "bad" {
  if (mode === "max") {
    if (value <= limit) return "ok";
    if (value <= warn) return "warn";
    return "bad";
  }
  if (value >= limit) return "ok";
  if (value >= warn) return "warn";
  return "bad";
}
function toneText(t: "ok" | "warn" | "bad"): string {
  return t === "ok" ? "text-emerald-600" : t === "warn" ? "text-amber-600" : "text-red-600";
}
function toneBar(t: "ok" | "warn" | "bad"): string {
  return t === "ok" ? "bg-emerald-500" : t === "warn" ? "bg-amber-500" : "bg-red-500";
}

function MetricCard({
  label, value, limitLabel, tone, fillPct, limitPct,
}: {
  label: string; value: string; limitLabel: string;
  tone: "ok" | "warn" | "bad"; fillPct: number; limitPct: number;
}) {
  const fill = Math.max(0, Math.min(100, fillPct));
  const limit = Math.max(0, Math.min(100, limitPct));
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{limitLabel}</p>
        </div>
        <p className={cn("text-2xl font-semibold", toneText(tone))}>{value}</p>
        <div className="relative h-2 w-full rounded bg-muted">
          <div className={cn("h-2 rounded transition-all", toneBar(tone))} style={{ width: `${fill}%` }} />
          <div
            className="absolute top-[-2px] h-3 w-px bg-foreground/70"
            style={{ left: `${limit}%` }}
            aria-hidden
          />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickCheckVorpruefung({ dossier }: { dossier: Dossier }) {
  const i = deriveInputs(dossier);
  const ltvTone = toneFor(i.ltv, 80, 90, "max");
  const affTone = toneFor(i.affordability, 33, 38, "max");
  const eqTone = toneFor(i.equityRatio, 20, 15, "min");
  const hardTone = toneFor(i.hardRatio, 10, 7, "min");

  const tips: { tone: "ok" | "warn" | "bad"; text: string }[] = [];
  if (i.affordability > 33 && i.income > 0) {
    const incomeNeeded = i.minIncome;
    const delta = Math.max(0, incomeNeeded - i.income);
    tips.push({
      tone: "warn",
      text: `Einkommen müsste um ${chf(delta)} erhöht werden um Tragbarkeit auf 33% zu bringen (benötigt: ${chf(incomeNeeded)})`,
    });
  }
  if (i.equityRatio < 20 && i.total > 0) {
    const needed = i.total * 0.20;
    const missing = Math.max(0, needed - i.equity);
    tips.push({
      tone: "warn",
      text: `Fehlende Eigenmittel: ${chf(missing)} (mindestens ${chf(needed)} des Kaufpreises erforderlich)`,
    });
  }
  if (i.hardRatio < 10 && i.total > 0) {
    const neededHard = i.total * 0.10;
    tips.push({
      tone: "warn",
      text: `PK-Anteil zu hoch — mindestens ${chf(neededHard)} aus Barvermögen erforderlich (aktuell ${chf(i.hardEquity)} harte Eigenmittel)`,
    });
  }
  if (tips.length === 0) {
    tips.push({ tone: "ok", text: "Alle Kennzahlen erfüllt — Finanzierung grundsätzlich bankfähig." });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard label="Belehnung (LTV)" value={pct(i.ltv)} limitLabel="Limit: 80%" tone={ltvTone} fillPct={i.ltv} limitPct={80} />
        <MetricCard label="Tragbarkeit" value={pct(i.affordability)} limitLabel="Limit: 33%" tone={affTone} fillPct={i.affordability * (100 / 50)} limitPct={33 * (100 / 50)} />
        <MetricCard label="Eigenmittelquote" value={pct(i.equityRatio)} limitLabel="Limit: 20%" tone={eqTone} fillPct={i.equityRatio * (100 / 50)} limitPct={20 * (100 / 50)} />
        <MetricCard label="Harte Eigenmittel" value={pct(i.hardRatio)} limitLabel="Limit: 10%" tone={hardTone} fillPct={i.hardRatio * (100 / 30)} limitPct={10 * (100 / 30)} />
      </div>
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold">Optimierungsvorschläge</h3>
          <ul className="space-y-1 text-sm">
            {tips.map((t, idx) => (
              <li key={idx} className={toneText(t.tone)}>• {t.text}</li>
            ))}
          </ul>
          {(() => {
            const coIncome = n(dossier.co_applicant_einkommen);
            const coName = dossier.co_applicant?.full_name;
            const coId = dossier.co_applicant_client_id;
            const mainIncome = n(dossier.gross_income_yearly);
            const mainName = dossier.clients?.full_name ?? "Hauptantragsteller";
            if (coId && coName && coIncome > 0) {
              return (
                <div className="mt-3 rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-900 dark:text-blue-100">
                  Berechnung mit kombiniertem Einkommen:{" "}
                  <span className="font-medium">{mainName}</span> {chf(mainIncome)} +{" "}
                  <span className="font-medium">{coName}</span> {chf(coIncome)} ={" "}
                  <span className="font-semibold">{chf(i.income)}</span> / Jahr
                </div>
              );
            }
            if (coId && coName && coIncome <= 0) {
              return (
                <div className="mt-3 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-100">
                  Einkommen von <span className="font-medium">{coName}</span> nicht erfasst —
                  Berechnung basiert nur auf Einkommen des Hauptantragstellers.{" "}
                  <a href={`/clients/${coId}`} className="underline font-medium">→ Zum Kundenprofil</a>
                </div>
              );
            }
            return null;
          })()}
        </CardContent>
      </Card>
    </>
  );
}

function DetailRow({ label, value, bold, indent, divider }: {
  label: string; value: string; bold?: boolean; indent?: boolean; divider?: boolean;
}) {
  return (
    <>
      {divider && <div className="my-2 border-t" />}
      <div className={cn("flex justify-between gap-4 text-sm", indent && "pl-4 text-muted-foreground")}>
        <span>{label}</span>
        <span className={cn("tabular-nums", bold && "font-semibold")}>{value}</span>
      </div>
    </>
  );
}

function QuickCheckDetail({ dossier }: { dossier: Dossier }) {
  const i = deriveInputs(dossier);
  const affTone = toneFor(i.affordability, 33, 38, "max");

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardContent className="p-4 space-y-1">
          <h3 className="font-semibold mb-2">Finanzierungsstruktur</h3>
          <DetailRow label="Kaufpreis" value={chf(i.purchase)} />
          {i.reno > 0 && <DetailRow label="+ Renovationskosten" value={chf(i.reno)} />}
          <DetailRow label="= Gesamtinvestition" value={chf(i.total)} bold divider />
          <DetailRow label={`Eigenmittel total (${pct(i.equityRatio)})`} value={chf(i.equity)} divider />
          <DetailRow label="davon Barvermögen" value={chf(i.hardEquity)} indent />
          <DetailRow label="davon PK / Freizügigkeit" value={chf(i.pension + i.vested)} indent />
          <DetailRow label={`Hypothek gesamt (${pct(i.ltv)})`} value={chf(i.mortgage)} divider />
          <DetailRow label="1. Hypothek (≤ 65%)" value={chf(i.firstMortgage)} indent />
          <DetailRow label="2. Hypothek (65–80%)" value={chf(i.secondMortgage)} indent />
          <DetailRow label={`Amortisation 2. Hypo (über ${i.amortYears} J.)`} value={`${chf(i.amort)}/J`} divider />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 space-y-1">
          <h3 className="font-semibold mb-2">Jahreskosten (Tragbarkeit)</h3>
          <DetailRow label={`Kalk. Zinssatz (${i.rate.toFixed(1)}%)`} value={chf(i.interest)} />
          <DetailRow label={`Nebenkosten (${i.ancillaryPct.toFixed(1)}%)`} value={chf(i.ancillary)} />
          <DetailRow label="Amortisation" value={chf(i.amort)} />
          <DetailRow label="Total Wohnkosten p.a." value={chf(i.yearly)} bold divider />
          {(() => {
            const coIncome = n(dossier.co_applicant_einkommen);
            const mainIncome = n(dossier.gross_income_yearly);
            const coName = dossier.co_applicant?.full_name;
            const role = dossier.co_applicant_role === "ehepartner" ? "Ehepartner/in" : "Mitantragsteller/in";
            if (coIncome > 0 && coName) {
              return (
                <>
                  <DetailRow label="Einkommen Hauptantragsteller" value={chf(mainIncome)} />
                  <DetailRow label={`Einkommen ${role} ${coName}`} value={chf(coIncome)} />
                  <DetailRow label="Kombiniertes Einkommen p.a." value={chf(i.income)} bold />
                </>
              );
            }
            return <DetailRow label="Bruttoeinkommen p.a." value={chf(i.income)} />;
          })()}
          <div className="my-2 border-t" />
          <div className="flex justify-between gap-4 text-sm">
            <span>Tragbarkeitsquote</span>
            <span className={cn("font-semibold tabular-nums", toneText(affTone))}>{pct(i.affordability)}</span>
          </div>
          <DetailRow label="Mindesteinkommen (33%)" value={chf(i.minIncome)} />
        </CardContent>
      </Card>
    </div>
  );
}

type ScenarioRow = {
  id: string;
  created_at: string;
  dossier_id: string;
  bezeichnung: string;
  kaufpreis: number | null;
  eigenmittel: number | null;
  bruttoeinkommen: number | null;
  hypothek: number | null;
  kalk_zinssatz: number | null;
  tragbarkeit: number | null;
  belehnung: number | null;
  eigenmittelquote: number | null;
  harte_eigenmittel: number | null;
  status: string | null;
};

function QuickCheckScenarios({ dossier }: { dossier: Dossier }) {
  const original = useMemo(() => deriveInputs(dossier), [dossier]);
  const dossierId = String((dossier as { id?: string }).id ?? "");
  const queryClient = useQueryClient();

  const [purchase, setPurchase] = useState<number>(Math.round(original.purchase));
  const [equity, setEquity] = useState<number>(Math.round(original.equity));
  const [income, setIncome] = useState<number>(Math.round(original.income));
  const [mortgage, setMortgage] = useState<number>(Math.round(original.mortgage));
  const [rate, setRate] = useState<number>(Math.round(original.rate * 10) / 10);
  const [reno, setReno] = useState<number>(Math.round(original.reno));
  const [ownWork, setOwnWork] = useState<number>(Math.round(n((dossier as { renovation_own_work?: number | string | null }).renovation_own_work)));

  const [saveOpen, setSaveOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState("");

  const purchaseMin = Math.round(original.purchase * 0.5);
  const purchaseMax = Math.round(original.purchase * 1.5) || 100000;
  const equityMax = Math.max(Math.round((purchase + reno) * 0.5), Math.round(original.equity * 2.0), 200000);
  const incomeMin = Math.round(original.income * 0.5);
  const incomeMax = Math.round(original.income * 2.0) || 200000;
  const mortgageMin = Math.round(original.mortgage * 0.5);
  const mortgageMax = Math.round(original.mortgage * 1.3) || 100000;
  const renoMax = Math.max(Math.round(original.reno * 2.0), Math.round(purchase * 0.5), 200000);
  const ownWorkMax = Math.max(reno, 50000);

  // Live calculation based on slider values
  const live = useMemo(() => {
    const p = Math.round(purchase);
    const eq = Math.round(equity);
    const inc = Math.round(income);
    const mort = Math.round(mortgage);
    const r = Math.round(rate * 10) / 10;
    const rn = Math.round(reno);
    const ow = Math.min(Math.round(ownWork), rn);
    const effectiveEq = eq + ow;
    const total = p + rn;
    const ancillary = total * (original.ancillaryPct / 100);
    const firstMortgageMax = total * 0.6667;
    const second = Math.max(0, mort - firstMortgageMax);
    const amort = second / original.amortYears;
    const result = calcQuickCheck({
      purchase_price: p,
      renovation_costs: rn,
      requested_mortgage: mort,
      own_funds_total: effectiveEq,
      own_funds_pension_fund: original.pension,
      own_funds_vested_benefits: original.vested,
      gross_income_yearly: inc,
      calculated_interest_rate: r,
      ancillary_costs_yearly: ancillary,
      amortisation_yearly: amort,
    });
    return { p, eq: effectiveEq, inc, mort, r, total, rn, ow, result };
  }, [purchase, equity, income, mortgage, rate, reno, ownWork, original]);

  const reset = () => {
    setPurchase(Math.round(original.purchase));
    setEquity(Math.round(original.equity));
    setIncome(Math.round(original.income));
    setMortgage(Math.round(original.mortgage));
    setRate(Math.round(original.rate * 10) / 10);
    setReno(Math.round(original.reno));
    setOwnWork(Math.round(n((dossier as { renovation_own_work?: number | string | null }).renovation_own_work)));
  };

  const saveMutation = useMutation({
    mutationFn: async (label: string) => {
      const r = live.result;
      const { error } = await supabase.from("financing_dossiers_scenarios" as never).insert({
        dossier_id: dossierId,
        bezeichnung: label,
        kaufpreis: live.p,
        eigenmittel: live.eq,
        bruttoeinkommen: live.inc,
        hypothek: live.mort,
        kalk_zinssatz: live.r,
        tragbarkeit: r.affordability_ratio,
        belehnung: r.loan_to_value_ratio,
        eigenmittelquote: live.total > 0 ? (live.eq / live.total) * 100 : 0,
        harte_eigenmittel: r.hard_equity,
        status: r.status,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Szenario gespeichert");
      setSaveOpen(false);
      setScenarioName("");
      queryClient.invalidateQueries({ queryKey: ["financing_scenarios", dossierId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Speichern fehlgeschlagen"),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["financing_scenarios", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers_scenarios" as never)
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ScenarioRow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sid: string) => {
      const { error } = await supabase
        .from("financing_dossiers_scenarios" as never)
        .delete()
        .eq("id", sid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Szenario gelöscht");
      queryClient.invalidateQueries({ queryKey: ["financing_scenarios", dossierId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Löschen fehlgeschlagen"),
  });

  const loadScenario = (s: ScenarioRow) => {
    if (s.kaufpreis != null) setPurchase(Math.round(Number(s.kaufpreis)));
    if (s.eigenmittel != null) setEquity(Math.round(Number(s.eigenmittel)));
    if (s.bruttoeinkommen != null) setIncome(Math.round(Number(s.bruttoeinkommen)));
    if (s.hypothek != null) setMortgage(Math.round(Number(s.hypothek)));
    if (s.kalk_zinssatz != null) setRate(Math.round(Number(s.kalk_zinssatz) * 10) / 10);
    toast.success(`Szenario "${s.bezeichnung}" geladen`);
  };

  const liveLtv = live.result.loan_to_value_ratio;
  const liveAff = live.result.affordability_ratio;
  const liveEqRatio = live.total > 0 ? (live.eq / live.total) * 100 : 0;
  const liveStatus = live.result.status as QuickCheckStatus;

  // Matrix uses slider values for equity, mortgage, rate
  const priceSteps = [-200000, -100000, 0, 100000, 200000];
  const incomeSteps = [-40000, -20000, 0, 20000, 40000];

  type Cell = { tone: "ok" | "warn" | "bad" | "gray"; label: string; isCurrent: boolean };
  const matrix: Cell[][] = incomeSteps.map((dInc) =>
    priceSteps.map((dPrice) => {
      const p = Math.max(0, live.p + dPrice);
      const total = p + original.reno;
      const ancillary = total * (original.ancillaryPct / 100);
      const firstMortgageMax = total * 0.6667;
      const second = Math.max(0, live.mort - firstMortgageMax);
      const amort = second / original.amortYears;
      const result = calcQuickCheck({
        purchase_price: p,
        renovation_costs: original.reno,
        requested_mortgage: live.mort,
        own_funds_total: live.eq,
        own_funds_pension_fund: original.pension,
        own_funds_vested_benefits: original.vested,
        gross_income_yearly: Math.max(0, live.inc + dInc),
        calculated_interest_rate: live.r,
        ancillary_costs_yearly: ancillary,
        amortisation_yearly: amort,
      });
      const eqRatio = total > 0 ? (live.eq / total) * 100 : 0;
      const aff = result.affordability_ratio;
      let tone: Cell["tone"];
      let label: string;
      if (eqRatio < 10) { tone = "gray"; label = "EK!"; }
      else if (aff > 38 || eqRatio < 15) { tone = "bad"; label = pct(aff); }
      else if (aff > 33 || eqRatio < 20) { tone = "warn"; label = pct(aff); }
      else { tone = "ok"; label = pct(aff); }
      return { tone, label, isCurrent: dPrice === 0 && dInc === 0 };
    })
  );

  const cellTone = (t: Cell["tone"]) =>
    t === "ok" ? "bg-emerald-100 text-emerald-800"
    : t === "warn" ? "bg-amber-100 text-amber-800"
    : t === "bad" ? "bg-red-100 text-red-800"
    : "bg-muted text-muted-foreground";
  const borderTone = (t: Cell["tone"]) =>
    t === "ok" ? "border-emerald-600"
    : t === "warn" ? "border-amber-600"
    : t === "bad" ? "border-red-600"
    : "border-muted-foreground";

  const equityPctNow = live.total > 0 ? (live.eq / live.total) * 100 : 0;
  const ltvNow = live.total > 0 ? (live.mort / live.total) * 100 : 0;

  return (
    <>
      {/* BEREICH A — Slider */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold">Interaktive Szenario-Regler</h3>
            <p className="text-sm text-muted-foreground">
              Passe die Werte an um verschiedene Szenarien zu prüfen. Die Matrix aktualisiert sich live.
              Du kannst ein Szenario als neue Berechnung im Dossier speichern.
            </p>
          </div>

          <SliderRow
            label="Kaufpreis"
            display={chf(purchase)}
            value={purchase}
            min={purchaseMin}
            max={purchaseMax}
            step={10000}
            onChange={setPurchase}
          />
          <SliderRow
            label="Eigenmittel"
            display={`${chf(equity)} (${pct(equityPctNow)})`}
            value={equity}
            min={0}
            max={equityMax}
            step={5000}
            onChange={setEquity}
          />
          <SliderRow
            label="Bruttoeinkommen"
            display={`${chf(income)} / Jahr`}
            value={income}
            min={incomeMin}
            max={incomeMax}
            step={5000}
            onChange={setIncome}
          />
          <SliderRow
            label="Gewünschte Hypothek"
            display={`${chf(mortgage)} (${pct(ltvNow)} Belehnung)`}
            value={mortgage}
            min={mortgageMin}
            max={mortgageMax}
            step={10000}
            onChange={setMortgage}
          />
          <SliderRow
            label="Kalk. Zinssatz"
            display={`${rate.toFixed(1)}%`}
            value={rate}
            min={1.0}
            max={8.0}
            step={0.1}
            onChange={(v) => setRate(Math.round(v * 10) / 10)}
            isPercent
          />

          {/* Live result */}
          <div className="grid gap-2 sm:grid-cols-4 pt-2 border-t">
            <LiveMetric label="Belehnung" value={pct(liveLtv)} delta={liveLtv - original.ltv} betterWhenLower />
            <LiveMetric label="Tragbarkeit" value={pct(liveAff)} delta={liveAff - original.affordability} betterWhenLower />
            <LiveMetric label="Eigenmittelquote" value={pct(liveEqRatio)} delta={liveEqRatio - original.equityRatio} betterWhenLower={false} />
            <div className="rounded-lg border p-3 flex flex-col justify-center">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge className={cn("mt-1 w-fit", qcBadgeTone(liveStatus))}>{QUICK_CHECK_LABELS[liveStatus]}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSaveOpen(true)}>Als Szenario speichern</Button>
            <Button variant="outline" onClick={reset}>Zurücksetzen</Button>
          </div>
        </CardContent>
      </Card>

      {/* BEREICH B — Matrix */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Sensitivitätsanalyse — Einkommen vs. Kaufpreis</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs text-muted-foreground">Einkommen \ Kaufpreis</th>
                  {priceSteps.map((dp) => {
                    const v = Math.max(0, live.p + dp);
                    return (
                      <th key={dp} className="p-2 text-center text-xs text-muted-foreground tabular-nums">
                        {chfCompact(v)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {incomeSteps.map((di, rowIdx) => {
                  const incomeV = Math.max(0, live.inc + di);
                  return (
                    <tr key={di}>
                      <th className="p-2 text-left text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {chfCompact(incomeV)}/J
                      </th>
                      {matrix[rowIdx].map((cell, colIdx) => (
                        <td key={colIdx} className="p-0">
                          <div
                            className={cn(
                              "rounded px-2 py-3 text-center text-xs font-medium tabular-nums border-2",
                              cellTone(cell.tone),
                              cell.isCurrent ? borderTone(cell.tone) : "border-transparent",
                            )}
                          >
                            {cell.label}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <LegendDot tone="ok" label="Realistisch" />
            <LegendDot tone="warn" label="Kritisch" />
            <LegendDot tone="bad" label="Nicht finanzierbar" />
            <LegendDot tone="gray" label="EK ungenügend" />
          </div>
          <p className="text-xs text-muted-foreground">
            Eigenmittel {chf(live.eq)} · Zinssatz {live.r.toFixed(1)}% · Nebenkosten {original.ancillaryPct.toFixed(1)}% · Hypothek {chf(live.mort)}
          </p>
        </CardContent>
      </Card>

      {/* Saved scenarios */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Gespeicherte Szenarien</h3>
          {!scenarios || scenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Szenarien gespeichert.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {scenarios.map((s) => {
                const st = (s.status as QuickCheckStatus) ?? "incomplete";
                return (
                  <div key={s.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{s.bezeichnung}</p>
                        <p className="text-xs text-muted-foreground">{formatDateOnly(s.created_at)}</p>
                      </div>
                      <Badge className={qcBadgeTone(st)}>{QUICK_CHECK_LABELS[st]}</Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground tabular-nums">
                      <span>Tragbarkeit: <span className="font-medium text-foreground">{s.tragbarkeit != null ? pct(Number(s.tragbarkeit)) : "—"}</span></span>
                      <span>Belehnung: <span className="font-medium text-foreground">{s.belehnung != null ? pct(Number(s.belehnung)) : "—"}</span></span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadScenario(s)}>Laden</Button>
                      <DeleteScenarioButton onConfirm={() => deleteMutation.mutate(s.id)} pending={deleteMutation.isPending} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Szenario speichern</DialogTitle>
            <DialogDescription>Vergib eine Bezeichnung für dieses Szenario.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="scenario-name">Bezeichnung</Label>
            <Input
              id="scenario-name"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="z.B. Mehr Eigenkapital"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => saveMutation.mutate(scenarioName.trim())}
              disabled={!scenarioName.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SliderRow({
  label, display, value, min, max, step, onChange, isPercent,
}: {
  label: string; display: string; value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void; isPercent?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-medium tabular-nums">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(isPercent ? v[0] : Math.round(v[0]))}
      />
    </div>
  );
}

function LiveMetric({
  label, value, delta, betterWhenLower,
}: { label: string; value: string; delta: number; betterWhenLower: boolean }) {
  const abs = Math.abs(delta);
  const showDelta = abs >= 0.05;
  const isBetter = betterWhenLower ? delta < 0 : delta > 0;
  const colorCls = !showDelta ? "text-muted-foreground" : isBetter ? "text-emerald-600" : "text-muted-foreground";
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {showDelta && (
        <p className={cn("text-xs flex items-center gap-1 tabular-nums", colorCls)}>
          <Icon className="h-3 w-3" />
          {abs.toFixed(1)}% vs. Original
        </p>
      )}
    </div>
  );
}

function DeleteScenarioButton({ onConfirm, pending }: { onConfirm: () => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Szenario löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onConfirm(); setOpen(false); }} disabled={pending}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatDateOnly(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function LegendDot({ tone, label }: { tone: "ok" | "warn" | "bad" | "gray"; label: string }) {
  const cls =
    tone === "ok" ? "bg-emerald-500"
    : tone === "warn" ? "bg-amber-500"
    : tone === "bad" ? "bg-red-500"
    : "bg-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded", cls)} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
