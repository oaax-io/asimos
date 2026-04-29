import { createServerFn } from "@tanstack/react-start";

/**
 * Phase 3 — Server-PDF (vorbereitet).
 *
 * Aktuell läuft die PDF-Erzeugung über den Browser-Print-Dialog im Wizard
 * (window.print() auf der HTML-Vorschau). Diese Server-Funktion bildet den
 * Andockpunkt für eine spätere echte PDF-Pipeline (z. B. PDFShift/DocRaptor
 * oder ein interner Renderer). Sie liefert heute nur die HTML-Quelle zurück
 * und einen Hinweis, dass kein Server-PDF konfiguriert ist.
 *
 * Sobald ein Anbieter angeschlossen wird:
 *  - Secret PDF_RENDER_API_KEY hinzufügen
 *  - hier fetch() gegen den Anbieter aufrufen
 *  - resultierendes PDF in Storage-Bucket "generated-documents" ablegen
 *  - Rückgabe: { fileUrl }
 */
export const renderDocumentPdf = createServerFn({ method: "POST" })
  .inputValidator((input: { html: string; title?: string }) => {
    if (!input || typeof input.html !== "string" || input.html.length === 0) {
      throw new Error("html is required");
    }
    if (input.html.length > 5_000_000) {
      throw new Error("html too large");
    }
    return {
      html: input.html,
      title: typeof input.title === "string" ? input.title.slice(0, 200) : "Dokument",
    };
  })
  .handler(async ({ data }) => {
    const provider = process.env.PDF_RENDER_PROVIDER;
    if (!provider) {
      return {
        ok: false as const,
        reason: "no_server_pdf_provider",
        message:
          "Server-PDF ist noch nicht konfiguriert. Nutze vorerst den Drucken-Dialog (Browser → PDF speichern).",
        fileUrl: null,
        title: data.title,
      };
    }

    // Placeholder for future provider integration.
    return {
      ok: false as const,
      reason: "not_implemented",
      message: `PDF-Provider "${provider}" ist konfiguriert, aber noch nicht angeschlossen.`,
      fileUrl: null,
      title: data.title,
    };
  });
