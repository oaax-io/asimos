import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { GeneratePdfButton } from "@/components/documents/GeneratePdfButton";
import {
  defaultTemplateForType,
  renderTemplate,
  wrapHtmlDocument,
  type TemplateContext,
} from "@/lib/document-templates";
import { resolveDocumentContext } from "@/lib/document-context";

type DocumentKind = "reservation" | "mandate" | "mandate_partial" | "reservation_receipt" | "nda";

const KIND_LABELS: Record<DocumentKind, string> = {
  reservation: "Reservationsvereinbarung",
  reservation_receipt: "Reservations-Quittung",
  mandate: "Maklermandat (exklusiv)",
  mandate_partial: "Maklermandat (teilexklusiv)",
  nda: "Vertraulichkeitsvereinbarung (NDA)",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If set, load the saved html from generated_documents */
  generatedDocumentId?: string | null;
  /** Otherwise build a live preview from the default template + CRM data */
  kind?: DocumentKind;
  clientId?: string | null;
  propertyId?: string | null;
  extraContext?: Partial<TemplateContext>;
};

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  generatedDocumentId,
  kind,
  clientId,
  propertyId,
  extraContext,
}: Props) {
  // Load saved HTML if available
  const { data: savedHtml } = useQuery({
    queryKey: ["generated-doc-html", generatedDocumentId],
    enabled: open && !!generatedDocumentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("generated_documents")
        .select("html_content")
        .eq("id", generatedDocumentId!)
        .maybeSingle();
      return data?.html_content ?? null;
    },
  });

  // Live preview when no saved doc exists
  const { data: liveHtml, isLoading: liveLoading } = useQuery({
    queryKey: ["live-preview", kind, clientId, propertyId, JSON.stringify(extraContext ?? {})],
    enabled: open && !generatedDocumentId && !!kind,
    queryFn: async () => {
      const ctx = await resolveDocumentContext({
        clientId: clientId ?? undefined,
        propertyId: propertyId ?? undefined,
        overrides: extraContext,
      });
      // Try active template first
      const { data: tpl } = await supabase
        .from("document_templates")
        .select("content")
        .eq("type", kind! as any)
        .eq("is_active", true)
        .order("name")
        .limit(1)
        .maybeSingle();
      const content = tpl?.content ?? defaultTemplateForType(kind!);
      return wrapHtmlDocument(KIND_LABELS[kind!], renderTemplate(content, ctx), ctx.brand);
    },
  });

  const html = savedHtml ?? liveHtml ?? "";
  const title = generatedDocumentId
    ? "Generiertes Dokument"
    : kind
    ? `Vorschau · ${KIND_LABELS[kind]}`
    : "Vorschau";

  const printIt = () => {
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle>{title}</DialogTitle>
            <div className="flex gap-2">
              <GeneratePdfButton
                html={html}
                title={title}
                documentId={generatedDocumentId ?? null}
                onPrintFallback={printIt}
              />
              <Button variant="ghost" size="sm" onClick={printIt} disabled={!html}>
                <Printer className="mr-2 size-4" /> Drucken
              </Button>
            </div>
          </div>
        </DialogHeader>
        {!html && (liveLoading || (!!generatedDocumentId && savedHtml === undefined)) ? (
          <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">
            Vorschau wird geladen…
          </div>
        ) : (
          <iframe
            title="Dokument-Vorschau"
            srcDoc={html || "<p style='font-family:sans-serif;padding:2rem;color:#888'>Keine Vorschau verfügbar</p>"}
            className="h-[70vh] w-full rounded-md border bg-white"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
