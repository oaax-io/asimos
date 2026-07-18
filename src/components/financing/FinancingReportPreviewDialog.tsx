import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { SendDocumentDialog } from "@/components/documents/SendDocumentDialog";
import { GeneratePdfButton } from "@/components/documents/GeneratePdfButton";
import { logActivity } from "@/components/ActivityTab";
import {
  buildRecommendations, buildReportHtml, type ReportInput, type ReportBrand,
} from "@/lib/financing-report";
import type { FinancingType, QuickCheckStatus } from "@/lib/financing";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dossierId: string;
  dossier: any;
};

export function FinancingReportPreviewDialog({ open, onOpenChange, dossierId, dossier }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [sendOpen, setSendOpen] = useState(false);

  const brandQuery = useQuery({
    queryKey: ["brand-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_settings" as any)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any) ?? null;
    },
  });

  const agentQuery = useQuery({
    queryKey: ["current-agent-name"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) return null;
      const { data: prof } = await supabase
        .from("profiles").select("full_name, email").eq("id", u.user.id).maybeSingle();
      return prof?.full_name ?? prof?.email ?? null;
    },
  });

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
    const b = brandQuery.data;
    const brand: ReportBrand | null = b ? {
      company_name: b.company_name,
      company_address: b.company_address,
      company_email: b.company_email,
      company_website: b.company_website,
      logo_url: b.logo_url,
      primary_color: b.primary_color,
      secondary_color: b.secondary_color,
      font_family: b.font_family,
    } : null;
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
      brand,
      agent_name: agentQuery.data ?? null,
    };
  };

  const liveInput = buildInput();
  const liveHtml = useMemo(
    () => buildReportHtml(liveInput, buildRecommendations(liveInput)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dossier, brandQuery.data, agentQuery.data],
  );
  const reportTitle = t("financing.actions.reportTitle", { name: dossier.clients?.full_name ?? "" }).trim();

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
        title: reportTitle,
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
      const statusKey = dossier.quick_check_status ?? null;
      const statusLabel = statusKey
        ? t(`financing.quickCheckStatus.${statusKey}`, { defaultValue: statusKey })
        : "—";
      await logActivity({
        relatedType: "financing_dossier",
        relatedId: dossierId,
        action: t("financing.actions.activity", { status: statusLabel }),
        metadata: { generated_document_id: data.id },
      });
      return data.id as string;
    },
    onSuccess: () => {
      toast.success(t("financing.actions.toast.generated"));
      qc.invalidateQueries({ queryKey: ["financing_quick_check_report", dossierId] });
      qc.invalidateQueries({ queryKey: ["financing_documents"] });
      qc.invalidateQueries({ queryKey: ["generated-documents"] });
      qc.invalidateQueries({ queryKey: ["activity_logs", "financing_dossier", dossierId] });
    },
    onError: (e: any) => toast.error(e.message ?? t("financing.actions.toast.generateError")),
  });

  const openInNewTab = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error(t("financing.actions.toast.popupBlocked"));
      return;
    }
    w.document.open();
    w.document.write(liveHtml);
    w.document.close();
  };

  const ensureSavedThenSend = async () => {
    if (!reportQuery.data?.id) await generate.mutateAsync();
    setSendOpen(true);
  };

  const recipients = dossier.clients?.email
    ? [{ name: dossier.clients?.full_name ?? "", email: dossier.clients.email, role: t("financing.actions.role") }]
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{reportTitle || "Finanzierungsbericht"}</DialogTitle>
            <DialogDescription>Vorschau des finalen Finanzierungsdokuments — als PDF exportieren oder an den Kunden senden.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto bg-muted/40 p-6 flex justify-center">
            <div
              className="bg-white shadow-lg ring-1 ring-black/5 shrink-0"
              style={{ width: "210mm", minHeight: "297mm" }}
            >
              <iframe
                title="Finanzierungsbericht Vorschau"
                srcDoc={liveHtml}
                className="w-full bg-white border-0 block"
                style={{ height: "297mm" }}
                onLoad={(e) => {
                  const f = e.currentTarget;
                  try {
                    const h = f.contentDocument?.documentElement?.scrollHeight;
                    if (h && h > 0) f.style.height = `${h}px`;
                  } catch { /* ignore */ }
                }}
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-3 border-t bg-background flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openInNewTab}>
                <ExternalLink className="mr-1 h-4 w-4" />In neuem Tab öffnen
              </Button>
              <Button variant="outline" size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
                <RefreshCw className="mr-1 h-4 w-4" />
                {reportQuery.data?.id ? "Bericht aktualisieren" : "Bericht speichern"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={ensureSavedThenSend}>
                <Send className="mr-1 h-4 w-4" />An Kunde senden
              </Button>
              <GeneratePdfButton
                html={liveHtml}
                title={reportTitle}
                documentType="financing_quick_check"
                clientName={dossier.clients?.full_name ?? null}
                companyName={brandQuery.data?.company_name ?? null}
                variant="default"
                size="sm"
              />
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reportQuery.data?.id && (
        <SendDocumentDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          generatedDocumentId={reportQuery.data.id}
          documentTitle={reportTitle}
          initialRecipients={recipients}
        />
      )}
    </>
  );
}
