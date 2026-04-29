import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Send, ArrowRight, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SendDocumentDialog } from "@/components/documents/SendDocumentDialog";
import {
  buildRecommendations, buildReportHtml, type ReportInput,
} from "@/lib/financing-report";
import type { FinancingType, QuickCheckStatus } from "@/lib/financing";

type Props = {
  dossierId: string;
  dossier: any;
  onContinue?: () => void;
  onDiscard?: () => void;
  showWorkflowButtons?: boolean;
};

export function FinancingQuickCheckActions({
  dossierId, dossier, onContinue, onDiscard, showWorkflowButtons = true,
}: Props) {
  const qc = useQueryClient();
  const [sendOpen, setSendOpen] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Existierenden Bericht laden
  const reportQuery = useQuery({
    queryKey: ["financing_quick_check_report", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_documents")
        .select("*")
        .eq("related_type", "financing_dossier")
        .eq("related_id", dossierId)
        .eq("document_type", "financing_quick_check")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const buildInput = (): ReportInput => {
    const propLabel = dossier.properties?.title
      || (dossier.property_snapshot && (dossier.property_snapshot as any).title)
      || null;
    return {
      client_name: dossier.clients?.full_name ?? null,
      client_email: dossier.clients?.email ?? null,
      property_label: propLabel,
      data_source: dossier.data_source ?? null,
      financing_type: dossier.financing_type as FinancingType,
      total_investment: dossier.total_investment,
      effective_mortgage: dossier.requested_mortgage ?? dossier.new_total_mortgage ?? null,
      own_funds_total: dossier.own_funds_total,
      own_funds_pension_fund: dossier.own_funds_pension_fund,
      own_funds_vested_benefits: dossier.own_funds_vested_benefits,
      loan_to_value_ratio: dossier.loan_to_value_ratio,
      affordability_ratio: dossier.affordability_ratio,
      quick_check_status: dossier.quick_check_status as QuickCheckStatus,
      quick_check_reasons: dossier.quick_check_reasons as any,
    };
  };

  const generate = useMutation({
    mutationFn: async () => {
      const input = buildInput();
      const recs = buildRecommendations(input);
      const html = buildReportHtml(input, recs);

      const variables = {
        client_id: dossier.client_id ?? null,
        property_id: dossier.property_id ?? null,
        dossier_id: dossierId,
        financing_type: dossier.financing_type,
        quick_check_status: dossier.quick_check_status,
        recommendation_source: "rules" as const,
        recommendations: recs,
        ai_recommendations: null,
      };

      const payload: any = {
        title: `Finanzierungs Quick-Check – ${dossier.clients?.full_name ?? ""}`.trim(),
        document_type: "financing_quick_check",
        related_type: "financing_dossier",
        related_id: dossierId,
        html_content: html,
        variables,
        status: "draft",
      };

      const { data, error } = await supabase
        .from("generated_documents")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Bericht generiert");
      qc.invalidateQueries({ queryKey: ["financing_quick_check_report", dossierId] });
      qc.invalidateQueries({ queryKey: ["financing_documents"] });
      qc.invalidateQueries({ queryKey: ["generated-documents"] });
      openPreview(id);
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Generieren"),
  });

  const openPreview = async (idOverride?: string) => {
    const id = idOverride ?? reportQuery.data?.id;
    if (!id) {
      toast.error("Kein Bericht vorhanden – bitte zuerst generieren.");
      return;
    }
    const { data, error } = await supabase
      .from("generated_documents")
      .select("html_content, title")
      .eq("id", id)
      .maybeSingle();
    if (error || !data?.html_content) {
      toast.error("Bericht konnte nicht geöffnet werden.");
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Popup blockiert – bitte Popups erlauben.");
      return;
    }
    w.document.open();
    w.document.write(data.html_content);
    w.document.close();
  };

  const onSend = async () => {
    let id = reportQuery.data?.id;
    if (!id) {
      const newId = await generate.mutateAsync();
      id = newId;
    }
    setActiveDocId(id!);
    setSendOpen(true);
  };

  const recipients = dossier.clients?.email
    ? [{ name: dossier.clients?.full_name ?? "", email: dossier.clients.email, role: "Kunde" }]
    : [];

  const hasReport = !!reportQuery.data?.id;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          <FileText className="mr-1 h-4 w-4" />
          {hasReport ? "Bericht neu generieren" : "Bericht generieren"}
        </Button>
        <Button variant="outline" onClick={() => openPreview()} disabled={!hasReport}>
          <Eye className="mr-1 h-4 w-4" />Bericht ansehen
        </Button>
        <Button variant="outline" onClick={onSend}>
          <Send className="mr-1 h-4 w-4" />An Kunde senden
        </Button>
        {showWorkflowButtons && onContinue && (
          <Button variant="secondary" onClick={onContinue}>
            <ArrowRight className="mr-1 h-4 w-4" />Dossier weiterbearbeiten
          </Button>
        )}
        {showWorkflowButtons && onDiscard && (
          <Button variant="ghost" onClick={onDiscard}>
            <XCircle className="mr-1 h-4 w-4" />Nicht weiterverfolgen
          </Button>
        )}
      </div>

      {activeDocId && (
        <SendDocumentDialog
          open={sendOpen}
          onOpenChange={(v) => { setSendOpen(v); if (!v) setActiveDocId(null); }}
          generatedDocumentId={activeDocId}
          documentTitle={`Finanzierungs Quick-Check – ${dossier.clients?.full_name ?? ""}`.trim()}
          initialRecipients={recipients}
        />
      )}
    </>
  );
}
