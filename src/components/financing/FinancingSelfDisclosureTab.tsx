import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { FileSignature, Pencil, AlertTriangle } from "lucide-react";
import { SelfDisclosureLinkCard } from "@/components/clients/SelfDisclosureLinkCard";
import { FinancingEditorDialog } from "@/components/clients/FinancingEditorDialog";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Entwurf", tone: "bg-muted text-muted-foreground" },
  sent: { label: "Gesendet", tone: "bg-blue-600/15 text-blue-600" },
  submitted: { label: "Eingereicht", tone: "bg-amber-500/15 text-amber-600" },
  reviewed: { label: "Geprüft", tone: "bg-emerald-600/15 text-emerald-600" },
};

export function FinancingSelfDisclosureTab({
  dossierId, clientId, clientEmail,
}: {
  dossierId: string;
  clientId: string | null;
  clientEmail?: string | null;
}) {
  const { user } = useAuth();
  const [editorOpen, setEditorOpen] = useState(false);

  const { data: disclosure } = useQuery({
    queryKey: ["client_self_disclosure", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("client_self_disclosures")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
          Kein Kunde mit dem Dossier verknüpft.
        </CardContent>
      </Card>
    );
  }

  const status = disclosure?.status ?? "draft";
  const meta = STATUS_LABELS[status] ?? STATUS_LABELS.draft;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold flex items-center gap-2">
              <FileSignature className="h-4 w-4" />Selbstauskunft
            </h3>
            <Badge className={meta.tone}>{meta.label}</Badge>
          </div>

          {disclosure ? (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <KV label="Name" value={[disclosure.first_name, disclosure.last_name].filter(Boolean).join(" ")} />
              <KV label="Geburtsdatum" value={disclosure.birth_date} />
              <KV label="Beruf" value={disclosure.employed_as} />
              <KV label="Arbeitgeber" value={disclosure.employer_name} />
              <KV label="Nettolohn / Mt." value={fmtNum(disclosure.salary_net_monthly)} />
              <KV label="Einkommen total / Mt." value={fmtNum(disclosure.total_income_monthly)} />
              <KV label="Ausgaben total / Mt." value={fmtNum(disclosure.total_expenses_monthly)} />
              <KV label="Reserve / Mt." value={fmtNum(disclosure.reserve_total)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Selbstauskunft vorhanden.</p>
          )}

          <div className="flex gap-2 flex-wrap pt-2">
            <Button onClick={() => setEditorOpen(true)} size="sm">
              <Pencil className="mr-1 h-4 w-4" />{disclosure ? "Bearbeiten" : "Selbst ausfüllen"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {user && (
        <SelfDisclosureLinkCard clientId={clientId} clientEmail={clientEmail} userId={user.id} />
      )}

      {editorOpen && (
        <FinancingEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          clientId={clientId}
        />
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-2 border-b border-dashed py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function fmtNum(v: any) {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);
}
