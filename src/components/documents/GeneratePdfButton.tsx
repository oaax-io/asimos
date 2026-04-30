import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getDocumentPdfUrl, renderDocumentPdf, fetchDocumentPdfBytes } from "@/server/documents.functions";
import { buildDocumentFileName, type DocumentTypeKey } from "@/lib/document-filename";

type Props = {
  html: string | null | undefined;
  title?: string;
  documentId?: string | null;
  /** Document type used for the filename label (e.g. mandate, reservation, nda). */
  documentType?: DocumentTypeKey | null;
  /** Customer / client name used in filename. */
  clientName?: string | null;
  /** Property title used as fallback when there is no client. */
  propertyTitle?: string | null;
  /** Company name used in filename. Falls back to "Dokument" if missing. */
  companyName?: string | null;
  /** Browser-print fallback when server PDF is unavailable */
  onPrintFallback?: () => void;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
  disabled?: boolean;
};

/**
 * "PDF generieren" button: ruft die Server-Funktion auf, zeigt Toast, bietet Download.
 * Fallback: wenn der Server keinen Provider hat oder fehlschlägt → Browser-Print.
 */
export function GeneratePdfButton({
  html,
  title,
  documentId,
  documentType,
  clientName,
  propertyTitle,
  companyName,
  onPrintFallback,
  size = "sm",
  variant = "outline",
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const renderPdf = useServerFn(renderDocumentPdf);
  const getPdfUrl = useServerFn(getDocumentPdfUrl);
  const fetchBytes = useServerFn(fetchDocumentPdfBytes);

  const downloadName = buildDocumentFileName({
    company: companyName,
    documentType,
    documentLabel: !documentType ? title : null,
    clientName,
    propertyTitle,
    documentId,
  });

  const triggerDownload = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName;
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const base64ToBlobUrl = (b64: string): string => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  };

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

  const requestPrintFallback = (message?: string) => {
    const reason = message?.trim() || "Der PDF-Service hat keine Datei zurückgegeben.";
    toast.error("PDF konnte nicht generiert werden. Browser-Druck als Fallback verwenden?", {
      description: reason,
    });
    setFallbackReason(reason);
  };

  /** Try to load PDF bytes via server proxy → return a blob URL. */
  const loadAsBlob = async (path: string): Promise<string | null> => {
    try {
      const res = await fetchBytes({ data: { path } });
      if (res.ok && res.base64) return base64ToBlobUrl(res.base64);
    } catch (err) {
      console.warn("[pdf] proxy download failed", err);
    }
    return null;
  };

  const handle = async () => {
    if (!html) {
      toast.error("Kein Inhalt zum Generieren");
      return;
    }
    setLoading(true);
    try {
      // Existing PDF?
      if (documentId) {
        const existing = await getPdfUrl({ data: { documentId } });
        if (existing.ok && existing.fileUrl) {
          // existing.fileUrl is a signed Supabase URL → may be blocked.
          // Always proxy the bytes through the server.
          const path = new URL(existing.fileUrl).pathname.split("/object/sign/" + "documents/")[1]?.split("?")[0];
          const blob = path ? await loadAsBlob(path) : null;
          const finalUrl = blob ?? existing.fileUrl;
          setBlobUrl(finalUrl);
          triggerDownload(finalUrl);
          toast.success("PDF geöffnet");
          return;
        }
      }

      const res = await renderPdf({ data: { html, title, documentId: documentId ?? null } });
      if (res.ok && res.fileUrl) {
        // Proxy bytes via server to bypass adblockers blocking the storage domain.
        const blob = res.path ? await loadAsBlob(res.path) : null;
        const finalUrl = blob ?? res.fileUrl;
        setBlobUrl(finalUrl);
        toast.success("PDF wurde erstellt");
        triggerDownload(finalUrl);
      } else {
        requestPrintFallback("message" in res ? res.message : undefined);
      }
    } catch (err) {
      requestPrintFallback((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (blobUrl) {
    return (
      <Button variant={variant} size={size} onClick={() => triggerDownload(blobUrl)}>
        <FileDown className="mr-2 size-4" /> PDF herunterladen
      </Button>
    );
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={handle} disabled={disabled || loading || !html}>
        {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />}
        {loading ? "Wird erstellt…" : "PDF generieren"}
      </Button>

      <AlertDialog open={!!fallbackReason} onOpenChange={(open) => !open && setFallbackReason(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Browser-Druck als Fallback verwenden?</AlertDialogTitle>
            <AlertDialogDescription>
              {fallbackReason ?? "PDF konnte nicht generiert werden."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setFallbackReason(null);
                triggerPrint();
              }}
            >
              Browser-Druck öffnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
