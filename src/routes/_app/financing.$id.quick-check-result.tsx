import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { FinancingQuickCheckActions } from "@/components/financing/FinancingQuickCheckActions";
import {
  FINANCING_TYPE_LABELS, QUICK_CHECK_LABELS, calcQuickCheck,
  type FinancingType, type QuickCheckStatus,
} from "@/lib/financing";

export const Route = createFileRoute("/_app/financing/$id/quick-check-result")({
  component: QuickCheckResultPage,
});

function QuickCheckResultPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: dossier, isLoading } = useQuery({
    queryKey: ["financing_dossier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers").select("*").eq("id", id).maybeSingle();
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

  // Guard: incomplete → zurück zum Dossier
  useEffect(() => {
    if (dossier && dossier.quick_check_status === "incomplete") {
      navigate({ to: "/financing/$id", params: { id }, replace: true });
    }
  }, [dossier, id, navigate]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;
  if (!dossier) return <p className="text-sm text-muted-foreground">Dossier nicht gefunden.</p>;
  if (dossier.quick_check_status === "incomplete") return null;

  const status = (dossier.quick_check_status as QuickCheckStatus) ?? "incomplete";
  const title =
    dossier.title ||
    FINANCING_TYPE_LABELS[dossier.financing_type as FinancingType] ||
    "Finanzierung";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/financing/$id" params={{ id }}>
          <ArrowLeft className="mr-1 h-4 w-4" />Zurück zum Dossier
        </Link>
      </Button>

      <PageHeader
        title={title}
        description={[
          FINANCING_TYPE_LABELS[dossier.financing_type as FinancingType],
          dossier.clients?.full_name,
        ].filter(Boolean).join(" · ")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <FinancingQuickCheckActions
              dossierId={dossier.id}
              dossier={dossier}
              showWorkflowButtons={false}
            />
          </div>
        }
      />

      <ResultTabs dossier={dossier} />
    </div>
  );
}

function ResultTabs({ dossier }: { dossier: any }) {
  const [tab, setTab] = useState("vorpruefung");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="vorpruefung">Vorprüfung</TabsTrigger>
        <TabsTrigger value="detail">Detailrechnung</TabsTrigger>
        <TabsTrigger value="szenarien">Szenarien</TabsTrigger>
      </TabsList>

      <TabsContent value="vorpruefung" className="space-y-4">
        <VorpruefungTab dossier={dossier} />
      </TabsContent>
      <TabsContent value="detail" className="space-y-4">
        <DetailTab dossier={dossier} />
      </TabsContent>
      <TabsContent value="szenarien" className="space-y-4">
        <ScenariosTab dossier={dossier} onSaved={() => setTab("vorpruefung")} />
      </TabsContent>
    </Tabs>
  );
}

function StatusBadge({ status }: { status: QuickCheckStatus }) {
  const cls =
    status === "realistic" ? "bg-emerald-600 hover:bg-emerald-600 text-white" :
    status === "critical" ? "bg-amber-500 hover:bg-amber-500 text-white" :
    status === "not_financeable" ? "bg-red-600 hover:bg-red-600 text-white" :
    "bg-muted text-foreground";
  return <Badge className={cls}>{QUICK_CHECK_LABELS[status]}</Badge>;
}

// ---------------- Tab Vorprüfung ----------------

function VorpruefungTab({ dossier }: { dossier: any }) {
  const m = useMemo(() => {
    const purchase = numv(dossier.purchase_price);
    const reno = numv(dossier.renovation_costs);
    const total = numv(dossier.total_investment) || (purchase + reno);
    const mortgage = numv(dossier.requested_mortgage);
    const equity = effectiveEquity(dossier);
    const pension = effectivePension(dossier);
    const hardEquity = Math.max(0, equity - pension);
    const income = effectiveIncome(dossier);
    const yearly = numv(dossier.yearly_costs) ||
      (mortgage * (numv(dossier.calculated_interest_rate, 5) / 100)
        + (dossier.ancillary_costs_yearly != null ? numv(dossier.ancillary_costs_yearly) : total * 0.01)
        + numv(dossier.amortisation_yearly));

    const ltv = total > 0 ? (mortgage / total) * 100 : 0;
    const afford = income > 0 ? (yearly / income) * 100 : 0;
    const equityRatio = total > 0 ? (equity / total) * 100 : 0;
    const hardRatio = total > 0 ? (hardEquity / total) * 100 : 0;

    return { purchase, total, mortgage, equity, hardEquity, income, yearly, ltv, afford, equityRatio, hardRatio };
  }, [dossier]);

  const tips: string[] = [];
  if (m.afford > 33 && m.income > 0) {
    const required = m.yearly / 0.33;
    const delta = required - m.income;
    tips.push(`Einkommen müsste um CHF ${chf(delta)} erhöht werden, um Tragbarkeit auf 33% zu bringen (benötigt: CHF ${chf(required)}).`);
  }
  if (m.equityRatio < 20 && m.total > 0) {
    const required = m.total * 0.2;
    const delta = required - m.equity;
    tips.push(`Fehlende Eigenmittel: CHF ${chf(delta)} (mindestens CHF ${chf(required)} erforderlich).`);
  }
  if (m.hardRatio < 10 && m.total > 0) {
    const required = m.total * 0.1;
    tips.push(`PK-Anteil zu hoch — mindestens CHF ${chf(required)} aus Barvermögen erforderlich (aktuell CHF ${chf(m.hardEquity)} harte Eigenmittel).`);
  }
  if (tips.length === 0) {
    tips.push("Alle Kennzahlen erfüllt — Finanzierung grundsätzlich bankfähig.");
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Belehnung (LTV)" value={m.ltv} limit={80} mode="max" />
        <KpiCard label="Tragbarkeit" value={m.afford} limit={33} mode="max" />
        <KpiCard label="Eigenmittelquote" value={m.equityRatio} limit={20} mode="min" />
        <KpiCard label="Harte Eigenmittel" value={m.hardRatio} limit={10} mode="min" />
      </div>

      <Card>
        <CardContent className="p-5 space-y-2">
          <h3 className="font-semibold">Optimierungsvorschläge</h3>
          <ul className="space-y-1.5 text-sm">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function KpiCard({ label, value, limit, mode }: {
  label: string; value: number; limit: number; mode: "max" | "min";
}) {
  // Tone
  const ok = mode === "max" ? value <= limit * 0.9 : value >= limit;
  const bad = mode === "max" ? value > limit : value < limit * 0.7;
  const warn = !ok && !bad;
  const tone = bad ? "bad" : warn ? "warn" : "ok";

  const colors = {
    ok: { bar: "bg-emerald-500", text: "text-emerald-600" },
    warn: { bar: "bg-amber-500", text: "text-amber-600" },
    bad: { bar: "bg-red-500", text: "text-red-600" },
  }[tone];

  // Skala: bei "max" zeigen bis 1.25 * limit, sonst bis limit*1.5
  const scaleMax = mode === "max" ? Math.max(limit * 1.25, value) : Math.max(limit * 1.5, value, 100);
  const valuePct = Math.min(100, (value / scaleMax) * 100);
  const limitPct = Math.min(100, (limit / scaleMax) * 100);

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Limit {limit}%</p>
        </div>
        <p className={`text-3xl font-semibold ${colors.text}`}>{value.toFixed(1)}%</p>
        <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${colors.bar} transition-all`} style={{ width: `${valuePct}%` }} />
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/70"
            style={{ left: `${limitPct}%` }}
            aria-hidden
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- helpers ----------------

function numv(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

// Berücksichtigt Mitantragsteller/Ehepartner: nutzt kombiniertes Einkommen sofern gesetzt.
function effectiveIncome(d: any): number {
  const combined = numv(d?.einkommen_kombiniert);
  if (combined > 0) return combined;
  const main = numv(d?.gross_income_yearly);
  const co = numv(d?.co_applicant_einkommen);
  return main + co;
}

// Eigenmittel beider Partner zusammen (inkl. PK / Freizügigkeit – zählen als Eigenmittel)
function effectiveEquity(d: any): number {
  const combined = numv(d?.eigenkapital_kombiniert);
  if (combined > 0) return combined;
  // own_funds_total enthält bereits die PK/Freizügigkeit des Hauptantragstellers.
  // Beim Partner kommen Eigenkapital + PK-Anteil dazu.
  return (
    numv(d?.own_funds_total) +
    numv(d?.co_applicant_eigenkapital) +
    numv(d?.co_applicant_pk_anteil)
  );
}

// PK / Freizügigkeit beider Partner zusammen
function effectivePension(d: any): number {
  const combined = numv(d?.pk_anteil_kombiniert);
  if (combined > 0) return combined;
  const main = numv(d?.own_funds_pension_fund) + numv(d?.own_funds_vested_benefits);
  return main + numv(d?.co_applicant_pk_anteil);
}

function hasCoApplicant(d: any): boolean {
  return (
    !!d?.co_applicant_client_id ||
    numv(d?.co_applicant_einkommen) > 0 ||
    numv(d?.einkommen_kombiniert) > 0 ||
    numv(d?.co_applicant_eigenkapital) > 0 ||
    numv(d?.eigenkapital_kombiniert) > 0 ||
    numv(d?.co_applicant_pk_anteil) > 0 ||
    numv(d?.pk_anteil_kombiniert) > 0
  );
}

function chf(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return sign + Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ---------------- Tab Detailrechnung ----------------

function DetailTab({ dossier }: { dossier: any }) {
  const purchase = numv(dossier.purchase_price);
  const reno = numv(dossier.renovation_costs);
  const total = numv(dossier.total_investment) || (purchase + reno);
  const equity = effectiveEquity(dossier);
  const pension = effectivePension(dossier);
  const cash = Math.max(0, equity - pension);
  const mortgage = numv(dossier.requested_mortgage);
  const income = effectiveIncome(dossier);
  const rate = numv(dossier.calculated_interest_rate, 5);

  // 1./2. Hypothek (CH-Standard: 1. Hypo bis 65% des Wertes, 2. Hypo 65–80%)
  const firstMortgageMax = total * 0.65;
  const firstMortgage = Math.min(mortgage, firstMortgageMax);
  const secondMortgage = Math.max(0, mortgage - firstMortgageMax);
  const amortYearly = secondMortgage / 15;

  const interestCost = mortgage * (rate / 100);
  const ancillary = dossier.ancillary_costs_yearly != null ? numv(dossier.ancillary_costs_yearly) : total * 0.01;
  const totalYearly = interestCost + ancillary + amortYearly;
  const afford = income > 0 ? (totalYearly / income) * 100 : 0;
  const minIncome = totalYearly / 0.33;
  const equityRatio = total > 0 ? (equity / total) * 100 : 0;
  const mortgageRatio = total > 0 ? (mortgage / total) * 100 : 0;

  const affordTone =
    afford <= 33 ? "text-emerald-600" : afford <= 38 ? "text-amber-600" : "text-red-600";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="p-5 space-y-2">
          <h3 className="font-semibold mb-3">Finanzierungsstruktur</h3>
          <Row label="Kaufpreis" value={`CHF ${chf(purchase)}`} />
          {reno > 0 && <Row label="+ Renovationskosten" value={`CHF ${chf(reno)}`} />}
          {numv(dossier.renovation_own_work) > 0 && (
            <Row label="davon Eigenleistung" value={`CHF ${chf(numv(dossier.renovation_own_work))}`} muted />
          )}
          <Row label="= Gesamtinvestition" value={`CHF ${chf(total)}`} bold />
          <Divider />
          <Row label="Eigenmittel total" value={`CHF ${chf(equity)} (${equityRatio.toFixed(1)}%)`} />
          <Row label="davon Barvermögen" value={`CHF ${chf(cash)}`} muted />
          <Row label="davon PK / Freizügigkeit" value={`CHF ${chf(pension)}`} muted />
          <Row label="Hypothek gesamt" value={`CHF ${chf(mortgage)} (${mortgageRatio.toFixed(1)}%)`} />
          <Row label="1. Hypothek (≤ 65%)" value={`CHF ${chf(firstMortgage)}`} muted />
          <Row label="2. Hypothek (65–80%)" value={`CHF ${chf(secondMortgage)}`} muted />
          <Row label="Amortisation 2. Hypo" value={`CHF ${chf(amortYearly)} / Jahr (über 15 J.)`} muted />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-2">
          <h3 className="font-semibold mb-3">Jahreskosten</h3>
          <Row label={`Kalk. Zinssatz (${rate.toFixed(1)}%)`} value={`CHF ${chf(interestCost)}`} />
          <Row label="Nebenkosten (1%)" value={`CHF ${chf(ancillary)}`} />
          <Row label="Amortisation" value={`CHF ${chf(amortYearly)}`} />
          <Divider />
          <Row label="Total Wohnkosten p.a." value={`CHF ${chf(totalYearly)}`} bold />
          <Row label="Bruttoeinkommen p.a." value={`CHF ${chf(income)}`} />
          <Divider />
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold">Tragbarkeitsquote</span>
            <span className={`text-lg font-bold ${affordTone}`}>{afford.toFixed(1)}%</span>
          </div>
          <Row label="Mindesteinkommen (33%)" value={`CHF ${chf(minIncome)}`} muted />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground pl-3" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t my-2" />;
}

// ---------------- Tab Szenarien ----------------

type ScenarioState = {
  purchase: number;
  equity: number;
  income: number;
  rate: number;
  mortgage: number;
  reno: number;
  ownWork: number;
};

function ScenariosTab({ dossier, onSaved }: { dossier: any; onSaved: () => void }) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const original: ScenarioState = useMemo(() => ({
    purchase: Math.round(numv(dossier.purchase_price)),
    equity: Math.round(effectiveEquity(dossier)),
    income: Math.round(effectiveIncome(dossier)),
    rate: Math.round(numv(dossier.calculated_interest_rate, 5) * 10) / 10,
    mortgage: Math.round(numv(dossier.requested_mortgage)),
    reno: Math.round(numv(dossier.renovation_costs)),
    ownWork: Math.round(numv(dossier.renovation_own_work)),
  }), [dossier]);

  const [s, setS] = useState<ScenarioState>(original);
  useEffect(() => { setS(original); }, [original]);

  const reno = s.reno;
  const pension = effectivePension(dossier);


  // Original metrics
  const origResult = useMemo(() => calcQuickCheck({
    purchase_price: original.purchase,
    renovation_costs: original.reno,
    requested_mortgage: original.mortgage,
    own_funds_total: original.equity + original.ownWork,
    own_funds_pension_fund: numv(dossier.own_funds_pension_fund),
    own_funds_vested_benefits: numv(dossier.own_funds_vested_benefits),
    gross_income_yearly: original.income,
    calculated_interest_rate: original.rate,
    ancillary_costs_yearly: dossier.ancillary_costs_yearly,
    amortisation_yearly: dossier.amortisation_yearly,
  }), [original, dossier]);

  // Live metrics from sliders
  const liveResult = useMemo(() => {

    // Adjust pension share proportionally if equity changes? Keep absolute pension if equity covers it.
    const effectiveEq = s.equity + s.ownWork;
    const pensionUsed = Math.min(pension, effectiveEq);
    return calcQuickCheck({
      purchase_price: s.purchase,
      renovation_costs: reno,
      requested_mortgage: s.mortgage,
      own_funds_total: effectiveEq,
      own_funds_pension_fund: pensionUsed,
      own_funds_vested_benefits: 0,
      gross_income_yearly: s.income,
      calculated_interest_rate: s.rate,
      ancillary_costs_yearly: dossier.ancillary_costs_yearly,
      amortisation_yearly: dossier.amortisation_yearly,
    });
  }, [s, reno, pension, dossier]);


  const totalLive = s.purchase + s.reno;
  const totalOrig = original.purchase + original.reno;
  const eqLive = s.equity + s.ownWork;
  const eqOrig = original.equity + original.ownWork;
  const equityRatioLive = totalLive > 0 ? (eqLive / totalLive) * 100 : 0;
  const equityRatioOrig = totalOrig > 0 ? (eqOrig / totalOrig) * 100 : 0;
  const hardLive = Math.max(0, eqLive - Math.min(pension, eqLive));
  const hardRatioLive = totalLive > 0 ? (hardLive / totalLive) * 100 : 0;
  const hardOrig = Math.max(0, eqOrig - pension);
  const hardRatioOrig = totalOrig > 0 ? (hardOrig / totalOrig) * 100 : 0;

  const tips: string[] = [];
  if (liveResult.affordability_ratio > 33) {
    const requiredIncome = (liveResult.yearly_costs) / 0.33;
    tips.push(`Einkommen müsste auf CHF ${chf(requiredIncome)} erhöht werden, um Tragbarkeit auf 33% zu bringen.`);
  }
  if (equityRatioLive < 20) {
    const required = totalLive * 0.2;
    tips.push(`Fehlende Eigenmittel: CHF ${chf(required - eqLive)} (mind. CHF ${chf(required)} erforderlich).`);
  }
  if (hardRatioLive < 10) {
    const required = totalLive * 0.1;
    tips.push(`Harte Eigenmittel zu tief — mindestens CHF ${chf(required)} aus Barvermögen erforderlich.`);
  }
  if (tips.length === 0) {
    tips.push("Alle Kennzahlen erfüllt — Finanzierung grundsätzlich bankfähig.");
  }


  const saveMutation = useMutation({
    mutationFn: async () => {
      const effectiveEq = s.equity + s.ownWork;
      const pensionUsed = Math.min(pension, effectiveEq);
      const result = calcQuickCheck({
        purchase_price: s.purchase,
        renovation_costs: s.reno,
        requested_mortgage: s.mortgage,
        own_funds_total: effectiveEq,
        own_funds_pension_fund: pensionUsed,
        own_funds_vested_benefits: 0,
        gross_income_yearly: s.income,
        calculated_interest_rate: s.rate,
        ancillary_costs_yearly: dossier.ancillary_costs_yearly,
        amortisation_yearly: dossier.amortisation_yearly,
      });
      const coApp = hasCoApplicant(dossier);
      const incomeUpdate = coApp
        ? { einkommen_kombiniert: s.income }
        : { gross_income_yearly: s.income };
      const equityUpdate = coApp
        ? { eigenkapital_kombiniert: s.equity }
        : { own_funds_total: s.equity };
      const { error } = await supabase.from("financing_dossiers").update({
        purchase_price: s.purchase,
        renovation_costs: s.reno,
        renovation_own_work: s.ownWork,
        ...equityUpdate,
        ...incomeUpdate,
        calculated_interest_rate: s.rate,
        requested_mortgage: s.mortgage,
        total_investment: result.total_investment,
        loan_to_value_ratio: result.loan_to_value_ratio,
        affordability_ratio: result.affordability_ratio,
        quick_check_status: result.status,
        quick_check_reasons: result.reasons,
      }).eq("id", dossier.id);
      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Dossier aktualisiert");
      qc.invalidateQueries({ queryKey: ["financing_dossier", dossier.id] });
      setConfirmOpen(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Speichern"),
  });

  return (
    <>
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            Verschiebe die Regler, um zu sehen, wie sich Änderungen auf Tragbarkeit
            und Belehnung auswirken. Die Originalwerte bleiben gespeichert, bis du
            sie explizit übernimmst.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-5 space-y-5">
          <SliderRow
            label="Kaufpreis" unit="CHF"
            value={s.purchase}
            min={Math.round(original.purchase * 0.5)}
            max={Math.round(original.purchase * 1.5) || 100000}
            step={10000}
            onChange={(v) => setS((p) => ({ ...p, purchase: Math.round(v) }))}
            display={(v) => `CHF ${chf(v)}`}
          />
          <SliderRow
            label="Eigenmittel" unit="CHF"
            value={s.equity}
            min={0}
            max={Math.round(original.equity * 2.0) || 100000}
            step={5000}
            onChange={(v) => setS((p) => ({ ...p, equity: Math.round(v) }))}
            display={(v) => `CHF ${chf(v)}`}
          />
          <SliderRow
            label="Bruttoeinkommen p.a." unit="CHF"
            value={s.income}
            min={Math.round(original.income * 0.5)}
            max={Math.round(original.income * 2.0) || 100000}
            step={5000}
            onChange={(v) => setS((p) => ({ ...p, income: Math.round(v) }))}
            display={(v) => `CHF ${chf(v)}`}
          />
          <SliderRow
            label="Kalk. Zinssatz" unit="%"
            value={s.rate}
            min={1.0} max={8.0} step={0.1}
            onChange={(v) => setS((p) => ({ ...p, rate: Math.round(v * 10) / 10 }))}
            display={(v) => `${v.toFixed(1)}%`}
          />
          <SliderRow
            label="Gewünschte Hypothek" unit="CHF"
            value={s.mortgage}
            min={Math.round(original.mortgage * 0.7)}
            max={Math.round(original.mortgage * 1.3) || 100000}
            step={10000}
            onChange={(v) => setS((p) => ({ ...p, mortgage: Math.round(v) }))}
            display={(v) => `CHF ${chf(v)}`}
          />
        </CardContent></Card>

        <Card><CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Live-Ergebnis</h3>
            <StatusBadge status={liveResult.status} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DeltaMetric label="Belehnung" value={liveResult.loan_to_value_ratio} original={origResult.loan_to_value_ratio} mode="max" limit={80} />
            <DeltaMetric label="Tragbarkeit" value={liveResult.affordability_ratio} original={origResult.affordability_ratio} mode="max" limit={33} />
            <DeltaMetric label="Eigenmittelquote" value={equityRatioLive} original={equityRatioOrig} mode="min" limit={20} />
            <DeltaMetric label="Harte Eigenmittel" value={hardRatioLive} original={hardRatioOrig} mode="min" limit={10} />
          </div>
          <div className="space-y-1.5 text-sm pt-2 border-t">
            {tips.map((t, i) => (
              <div key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{t}</span></div>
            ))}
          </div>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setConfirmOpen(true)} disabled={saveMutation.isPending}>
          <Save className="mr-1 h-4 w-4" />Werte übernehmen
        </Button>
        <Button variant="outline" onClick={() => setS(original)} disabled={saveMutation.isPending}>
          <RotateCcw className="mr-1 h-4 w-4" />Zurücksetzen
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dossier mit neuen Werten aktualisieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Originalwerte werden überschrieben und der Quick Check neu berechnet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveMutation.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); saveMutation.mutate(); }} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Speichern…" : "Übernehmen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SliderRow({ label, value, min, max, step, onChange, display }: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: (v: number) => string;
}) {
  const safeMax = max > min ? max : min + step;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{display(value)}</span>
      </div>
      <Slider
        value={[Math.min(safeMax, Math.max(min, value))]}
        min={min} max={safeMax} step={step}
        onValueChange={(v) => onChange(v[0])}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{display(min)}</span><span>{display(safeMax)}</span>
      </div>
    </div>
  );
}

function DeltaMetric({ label, value, original, mode, limit }: {
  label: string; value: number; original: number; mode: "max" | "min"; limit: number;
}) {
  const delta = value - original;
  const ok = mode === "max" ? value <= limit : value >= limit;
  const tone = ok ? "text-emerald-600" : "text-red-600";
  const arrow = Math.abs(delta) < 0.05 ? "" : delta > 0 ? "▲" : "▼";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${tone}`}>{value.toFixed(1)}%</p>
      {arrow && (
        <p className="text-xs text-muted-foreground">
          {arrow} {Math.abs(delta).toFixed(1)}% vs. Original
        </p>
      )}
    </div>
  );
}
