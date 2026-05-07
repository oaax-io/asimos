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

      <Tabs defaultValue="vorpruefung">
        <TabsList>
          <TabsTrigger value="vorpruefung">Vorprüfung</TabsTrigger>
          <TabsTrigger value="detail">Detailrechnung</TabsTrigger>
          <TabsTrigger value="szenarien">Szenarien</TabsTrigger>
        </TabsList>

        <TabsContent value="vorpruefung" className="space-y-4">
          <VorpruefungTab dossier={dossier} />
        </TabsContent>
        <TabsContent value="detail">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Detailrechnung folgt in einer späteren Phase.
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="szenarien">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Szenarien folgen in einer späteren Phase.
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
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
    const equity = numv(dossier.own_funds_total);
    const pension = numv(dossier.own_funds_pension_fund) + numv(dossier.own_funds_vested_benefits);
    const hardEquity = Math.max(0, equity - pension);
    const income = numv(dossier.gross_income_yearly);
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

function chf(n: number): string {
  const rounded = Math.round(n);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}
