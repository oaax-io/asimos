import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { checklistStats, type ChecklistRow } from "@/lib/financing-checklist";
import { type QuickCheckStatus, type DossierStatus } from "@/lib/financing";

type Props = {
  dossierId: string;
  dossier: any;
};

type Verdict = "ready" | "missing" | "critical" | "do_not_submit";

export function DossierQualityCard({ dossierId, dossier }: Props) {
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["financing_checklist", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_checklist_items")
        .select("*").eq("dossier_id", dossierId);
      if (error) throw error;
      return (data ?? []) as any as ChecklistRow[];
    },
  });

  const stats = checklistStats(rows);
  const qcStatus = dossier.quick_check_status as QuickCheckStatus | null;
  const dossierStatus = dossier.dossier_status as DossierStatus | null;
  const ltv = Number(dossier.loan_to_value_ratio ?? 0);
  const affordability = Number(dossier.affordability_ratio ?? 0);
  const equityOk = ltv > 0 && ltv <= 80;
  const affordabilityOk = affordability > 0 && affordability <= 33;
  const hasMandatoryFinancials =
    Number(dossier.requested_mortgage ?? 0) > 0 &&
    Number(dossier.total_investment ?? 0) > 0 &&
    Number(dossier.gross_income_yearly ?? 0) > 0;

  const risks: string[] = [];
  if (!equityOk && ltv > 0) risks.push(`Belehnung ${ltv.toFixed(1)}% (über 80%)`);
  if (!affordabilityOk && affordability > 0) risks.push(`Tragbarkeit ${affordability.toFixed(1)}% (über 33%)`);
  if (qcStatus === "not_financeable") risks.push("Quick Check: nicht finanzierbar");
  if (qcStatus === "critical") risks.push("Quick Check: kritisch");
  if (!hasMandatoryFinancials) risks.push("Pflichtdaten unvollständig (Hypothek, Investition, Einkommen)");

  const verdict: Verdict = computeVerdict(stats.requiredPercent, qcStatus, equityOk, affordabilityOk);

  // Button-Gating
  let blockReason: string | null = null;
  if (qcStatus === "not_financeable") {
    blockReason = "Dieses Dossier erfüllt die Mindestkriterien aktuell nicht und sollte nicht an die Bank eingereicht werden.";
  } else if (qcStatus === "critical") {
    blockReason = "Dieses Dossier ist kritisch. Bitte Tragbarkeit, Eigenmittel oder fehlende Unterlagen prüfen, bevor es an die Bank geht.";
  } else if (qcStatus === "incomplete" || !qcStatus) {
    blockReason = "Es fehlen noch Angaben für eine vollständige Vorprüfung.";
  } else if (!hasMandatoryFinancials) {
    blockReason = "Pflichtdaten fehlen: Hypothek, Gesamtinvestition und Bruttoeinkommen sind erforderlich.";
  } else if (dossierStatus === "rejected" || dossierStatus === "cancelled") {
    blockReason = "Dossier ist abgelehnt oder storniert und kann nicht an die Bank gesendet werden.";
  } else if (stats.requiredPercent < 60) {
    blockReason = "Mindestpflichtpunkte der Checkliste sind noch nicht erfüllt.";
  }
  const canMarkReady =
    !blockReason &&
    qcStatus === "realistic" &&
    dossierStatus !== "ready_for_bank";

  const markReady = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("financing_dossiers")
        .update({ dossier_status: "ready_for_bank" as DossierStatus })
        .eq("id", dossierId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financing_dossier", dossierId] });
      qc.invalidateQueries({ queryKey: ["financing_dossiers"] });
      toast.success("Als bereit für Bank markiert");
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />Dossier-Qualität
          </h3>
          <VerdictBadge verdict={verdict} />
        </div>

        <div className="space-y-2">
          <Bar label="Checkliste vollständig" pct={stats.completionPercent} />
          <Bar label="Pflichtdokumente vorhanden" pct={stats.requiredPercent} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <Row ok={affordabilityOk} label={`Tragbarkeit: ${affordability ? affordability.toFixed(1) + "%" : "—"}`} />
          <Row ok={equityOk} label={`Belehnung: ${ltv ? ltv.toFixed(1) + "%" : "—"}`} />
        </div>

        {risks.length > 0 && (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50/40 p-3 text-sm">
            <p className="font-medium text-amber-700 mb-1">Ablehnungsrisiken</p>
            <ul className="space-y-0.5 text-amber-700/90">
              {risks.map((r) => (<li key={r}>• {r}</li>))}
            </ul>
          </div>
        )}

        {blockReason && (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50/40 p-3 text-sm text-amber-700">
            {blockReason}
          </div>
        )}

        {dossierStatus === "ready_for_bank" && (
          <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/40 p-3 text-sm text-emerald-700">
            Dieses Dossier ist bereits als bereit für Bank markiert.
          </div>
        )}

        <Button
          onClick={() => markReady.mutate()}
          disabled={!canMarkReady || markReady.isPending}
          className="w-full"
        >
          Bereit für Bank markieren
        </Button>
      </CardContent>
    </Card>
  );
}

function computeVerdict(requiredPct: number, qcStatus: QuickCheckStatus | null, equityOk: boolean, affordabilityOk: boolean): Verdict {
  if (qcStatus === "not_financeable") return "do_not_submit";
  if (!equityOk || !affordabilityOk) return "critical";
  if (requiredPct >= 90) return "ready";
  if (requiredPct >= 60) return "missing";
  return "critical";
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (verdict === "ready")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Bereit für Bank</Badge>;
  if (verdict === "missing")
    return <Badge className="bg-amber-500 hover:bg-amber-500"><AlertTriangle className="h-3 w-3 mr-1" />Unterlagen fehlen</Badge>;
  if (verdict === "critical")
    return <Badge className="bg-orange-600 hover:bg-orange-600"><AlertTriangle className="h-3 w-3 mr-1" />Kritisch</Badge>;
  return <Badge className="bg-red-600 hover:bg-red-600"><XCircle className="h-3 w-3 mr-1" />Nicht einreichen</Badge>;
}

function Bar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1"><span>{label}</span><span>{pct}%</span></div>
      <Progress value={pct} />
    </div>
  );
}

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
      <span>{label}</span>
    </div>
  );
}
