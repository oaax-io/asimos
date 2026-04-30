import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { renderDocumentPdf } from "@/server/documents.functions";

type Props = {
  html: string | null | undefined;
  title?: string;
  documentId?: string | null;
  /** Browser-print fallback when server PDF is unavailable */
  onPrintFallback?: () => void;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
};

/**
 * "PDF generieren" button: ruft die Server-Funktion auf, zeigt Toast, bietet Download.
 * Fallback: wenn der Server keinen Provider hat oder fehlschlägt → Browser-Print.
 */
export function GeneratePdfButton({
  html,
  title,
  documentId,
  onPrintFallback,
  size = "sm",
  variant = "outline",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const renderPdf = useServerFn(renderDocumentPdf);

  const triggerPrint = () => {
    if (onPrintFallback) return onPrintFallback();
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const handle = async () => {
    if (!html) {
      toast.error("Kein Inhalt zum Generieren");
      return;
    }
    setLoading(true);
    try {
      const res = await renderPdf({ data: { html, title, documentId: documentId ?? null } });
      if (res.ok && res.fileUrl) {
        setFileUrl(res.fileUrl);
        toast.success("PDF wurde erstellt");
        // Open immediately in a new tab
        window.open(res.fileUrl, "_blank");
      } else {
        toast.message("Server-PDF nicht verfügbar – Druck-Fallback wird geöffnet", {
          description: "message" in res ? res.message : undefined,
        });
        triggerPrint();
      }
    } catch (err) {
      toast.error("PDF-Erzeugung fehlgeschlagen", { description: (err as Error).message });
      triggerPrint();
    } finally {
      setLoading(false);
    }
  };

  if (fileUrl) {
    return (
      <Button asChild variant={variant} size={size}>
        <a href={fileUrl} target="_blank" rel="noreferrer">
          <FileDown className="mr-2 size-4" /> PDF herunterladen
        </a>
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} onClick={handle} disabled={loading || !html}>
      {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Printer className="mr-2 size-4" />}
      {loading ? "Wird erstellt…" : "PDF generieren"}
    </Button>
  );
}
