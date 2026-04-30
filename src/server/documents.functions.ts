import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server-side PDF generation.
 *
 * Provider-Abstraktion: aktuell PDFShift (HTML→PDF API, Worker-kompatibel via fetch).
 * Falls kein PDFSHIFT_API_KEY gesetzt ist → ok:false zurückgeben, damit das
 * Frontend auf den Browser-Print-Fallback wechseln kann.
 *
 * Workflow:
 *  1. HTML an PDFShift POSTen (sandbox=true wenn Key mit "sandbox_" beginnt)
 *  2. PDF-Bytes nach Storage-Bucket "documents" unter generated/{id}.pdf legen
 *  3. Signed URL erzeugen + generated_documents-Row aktualisieren
 *
 * Inputs:
 *  - html (Pflicht)
 *  - title (optional, für Dateinamen)
 *  - documentId (optional, wenn vorhanden wird Row aktualisiert)
 */
export const renderDocumentPdf = createServerFn({ method: "POST" })
  .inputValidator((input: { html: string; title?: string; documentId?: string | null }) => {
    if (!input || typeof input.html !== "string" || input.html.length === 0) {
      throw new Error("html is required");
    }
    if (input.html.length > 5_000_000) {
      throw new Error("html too large");
    }
    return {
      html: input.html,
      title: typeof input.title === "string" ? input.title.slice(0, 200) : "Dokument",
      documentId: input.documentId ?? null,
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.PDFSHIFT_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        reason: "no_server_pdf_provider",
        message:
          "Server-PDF ist noch nicht konfiguriert (PDFSHIFT_API_KEY fehlt). Es wird der Browser-Druck-Fallback verwendet.",
        fileUrl: null as string | null,
        title: data.title,
      };
    }

    // 1) Render via PDFShift
    let pdfBytes: ArrayBuffer;
    try {
      const res = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
        },
        body: JSON.stringify({
          source: data.html,
          format: "A4",
          margin: "20mm",
          landscape: false,
          sandbox: apiKey.startsWith("sandbox_"),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false as const,
          reason: "provider_error",
          message: `PDFShift-Fehler [${res.status}]: ${text.slice(0, 300)}`,
          fileUrl: null as string | null,
          title: data.title,
        };
      }
      pdfBytes = await res.arrayBuffer();
    } catch (err) {
      return {
        ok: false as const,
        reason: "provider_unreachable",
        message: `PDF-Provider nicht erreichbar: ${(err as Error).message}`,
        fileUrl: null as string | null,
        title: data.title,
      };
    }

    // 2) Upload to Storage
    const id = data.documentId ?? crypto.randomUUID();
    const path = `generated/${id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("documents")
      .upload(path, new Uint8Array(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) {
      return {
        ok: false as const,
        reason: "storage_error",
        message: `Storage-Upload fehlgeschlagen: ${upErr.message}`,
        fileUrl: null as string | null,
        title: data.title,
      };
    }

    // 3) Signed URL (1h)
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) {
      return {
        ok: false as const,
        reason: "signed_url_error",
        message: `Signed URL fehlgeschlagen: ${signErr?.message ?? "unknown"}`,
        fileUrl: null as string | null,
        title: data.title,
      };
    }

    // 4) Update generated_documents row when known
    if (data.documentId) {
      await supabaseAdmin
        .from("generated_documents")
        .update({
          pdf_url: path,
          pdf_generated_at: new Date().toISOString(),
          pdf_provider: "pdfshift",
          file_url: path,
        })
        .eq("id", data.documentId);
    }

    return {
      ok: true as const,
      fileUrl: signed.signedUrl,
      path,
      title: data.title,
      provider: "pdfshift" as const,
    };
  });

/**
 * Refresh a signed URL for an existing PDF (Storage-paths in pdf_url).
 */
export const getDocumentPdfUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { documentId: string }) => {
    if (!input?.documentId) throw new Error("documentId is required");
    return { documentId: input.documentId };
  })
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("generated_documents")
      .select("pdf_url")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error || !row?.pdf_url) {
      return { ok: false as const, fileUrl: null as string | null };
    }
    const { data: signed } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(row.pdf_url, 60 * 60);
    return { ok: true as const, fileUrl: signed?.signedUrl ?? null };
  });
