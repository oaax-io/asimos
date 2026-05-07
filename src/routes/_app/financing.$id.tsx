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
  const equity = n(d.own_funds_total);
  const pension = n(d.own_funds_pension_fund);
  const vested = n(d.own_funds_vested_benefits);
  const pensionRelated = pension + vested;
  const hardEquity = Math.max(0, equity - pensionRelated);
  const income = n(d.gross_income_yearly);
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
          <DetailRow label="Bruttoeinkommen p.a." value={chf(i.income)} />
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

function QuickCheckScenarios({ dossier }: { dossier: Dossier }) {
  const i = deriveInputs(dossier);
  const priceSteps = [-200000, -100000, 0, 100000, 200000];
  const incomeSteps = [-40000, -20000, 0, 20000, 40000];

  type Cell = { affordability: number; tone: "ok" | "warn" | "bad" | "gray"; label: string; isCurrent: boolean };
  const matrix: Cell[][] = incomeSteps.map((dInc) =>
    priceSteps.map((dPrice) => {
      const purchase = Math.max(0, i.purchase + dPrice);
      const total = purchase + i.reno;
      const newReno = i.reno;
      const newAncillary = total * (i.ancillaryPct / 100);
      const firstMortgageMax = total * 0.6667;
      const newSecond = Math.max(0, i.mortgage - firstMortgageMax);
      const newAmort = newSecond / i.amortYears;
      const result = calcQuickCheck({
        purchase_price: purchase,
        renovation_costs: newReno,
        requested_mortgage: i.mortgage,
        own_funds_total: i.equity,
        own_funds_pension_fund: i.pension,
        own_funds_vested_benefits: i.vested,
        gross_income_yearly: Math.max(0, i.income + dInc),
        calculated_interest_rate: i.rate,
        ancillary_costs_yearly: newAncillary,
        amortisation_yearly: newAmort,
      });
      const eqRatio = total > 0 ? (i.equity / total) * 100 : 0;
      const aff = result.affordability_ratio;
      let tone: Cell["tone"];
      let label: string;
      if (eqRatio < 10) {
        tone = "gray";
        label = "EK!";
      } else if (aff > 38 || eqRatio < 15) {
        tone = "bad";
        label = pct(aff);
      } else if (aff > 33 || eqRatio < 20) {
        tone = "warn";
        label = pct(aff);
      } else {
        tone = "ok";
        label = pct(aff);
      }
      return { affordability: aff, tone, label, isCurrent: dPrice === 0 && dInc === 0 };
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

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold">Sensitivitätsanalyse — Einkommen vs. Kaufpreis</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs text-muted-foreground">Einkommen \ Kaufpreis</th>
                {priceSteps.map((dp) => {
                  const v = Math.max(0, i.purchase + dp);
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
                const incomeV = Math.max(0, i.income + di);
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
          Eigenmittel {chf(i.equity)} · Zinssatz {i.rate.toFixed(1)}% · Nebenkosten {i.ancillaryPct.toFixed(1)}% · Alle anderen Werte konstant
        </p>
      </CardContent>
    </Card>
  );
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
