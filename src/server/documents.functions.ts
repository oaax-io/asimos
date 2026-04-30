import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server-side PDF generation via self-hosted Puppeteer microservice.
 *
 * Contract:
 *   POST {PDF_SERVICE_URL}
 *   Headers: x-api-key: {PDF_SERVICE_TOKEN}
 *   Body:    { html: string, filename?: string }
 *   Response: application/pdf (binary)
 *
 * Workflow:
 *   1. POST HTML to microservice (10s timeout)
 *   2. Upload returned PDF bytes to Storage bucket "generated-documents"
 *      under generated/{document_id}.pdf
 *   3. Update generated_documents row (file_url, pdf_url, pdf_generated_at,
 *      pdf_provider, status='ready')
 *   4. Return signed URL (1h) so the UI can immediately download
 *
 * If the service is unreachable / fails / times out → ok:false; the UI falls
 * back to the existing window.print() flow.
 */

const PDF_TIMEOUT_MS = 30_000;
const BUCKET = "documents";
const PDF_PROVIDER = "railway-puppeteer";

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
    const serviceUrl = process.env.PDF_SERVICE_URL;
    const serviceToken = process.env.PDF_SERVICE_TOKEN;
    const startedAt = Date.now();

    if (!serviceUrl || !serviceToken) {
      console.warn("[pdf] PDF_SERVICE_URL/PDF_SERVICE_TOKEN not configured – falling back to browser print");
      return {
        ok: false as const,
        reason: "no_server_pdf_provider",
        message:
          "Server-PDF ist noch nicht konfiguriert (PDF_SERVICE_URL/PDF_SERVICE_TOKEN fehlen). Es wird der Browser-Druck-Fallback verwendet.",
        fileUrl: null as string | null,
        title: data.title,
      };
    }

    const id = data.documentId ?? crypto.randomUUID();
    const filename = `${slugify(data.title) || "dokument"}-${id.slice(0, 8)}.pdf`;
    const storagePath = `generated/${id}.pdf`;

    // 1) Render via microservice (10s timeout)
    let pdfBytes: ArrayBuffer;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);
    try {
      const endpoint = serviceUrl.replace(/\/+$/, "") + "/render-pdf";
      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-pdf-token": serviceToken,
          "x-api-key": serviceToken,
        },
        body: JSON.stringify({ html: data.html, title: data.title, filename }),
      });
      if (!res.ok) {
        const text = await safeText(res);
        const ms = Date.now() - startedAt;
        console.error(`[pdf] microservice error status=${res.status} ms=${ms} body=${text.slice(0, 300)}`);
        return {
          ok: false as const,
          reason: "provider_error",
          message: `PDF-Service Fehler [${res.status}]: ${text.slice(0, 200)}`,
          fileUrl: null as string | null,
          title: data.title,
        };
      }
      pdfBytes = await res.arrayBuffer();
    } catch (err) {
      const ms = Date.now() - startedAt;
      const aborted = (err as Error)?.name === "AbortError";
      console.error(`[pdf] microservice ${aborted ? "timeout" : "unreachable"} ms=${ms} err=${(err as Error).message}`);
      return {
        ok: false as const,
        reason: aborted ? "provider_timeout" : "provider_unreachable",
        message: aborted
          ? `PDF-Service Timeout nach ${PDF_TIMEOUT_MS}ms`
          : `PDF-Service nicht erreichbar: ${(err as Error).message}`,
        fileUrl: null as string | null,
        title: data.title,
      };
    } finally {
      clearTimeout(timeoutId);
    }

    // 2) Upload to Storage
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, new Uint8Array(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) {
      console.error(`[pdf] storage upload failed path=${storagePath} err=${upErr.message}`);
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
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (signErr || !signed?.signedUrl) {
      console.error(`[pdf] signed url failed path=${storagePath} err=${signErr?.message}`);
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
      const { error: updErr } = await supabaseAdmin
        .from("generated_documents")
        .update({
          file_url: storagePath,
          pdf_url: storagePath,
          pdf_generated_at: new Date().toISOString(),
          pdf_provider: "puppeteer",
          status: "ready",
        })
        .eq("id", data.documentId);
      if (updErr) {
        console.warn(`[pdf] generated_documents update failed id=${data.documentId} err=${updErr.message}`);
      }
    }

    const ms = Date.now() - startedAt;
    console.log(`[pdf] ok bytes=${pdfBytes.byteLength} ms=${ms} path=${storagePath} doc=${data.documentId ?? "-"}`);

    return {
      ok: true as const,
      fileUrl: signed.signedUrl,
      path: storagePath,
      title: data.title,
      provider: "puppeteer" as const,
      durationMs: ms,
    };
  });

/**
 * Refresh a signed URL for an existing PDF (path stored in pdf_url/file_url).
 */
export const getDocumentPdfUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { documentId: string }) => {
    if (!input?.documentId) throw new Error("documentId is required");
    return { documentId: input.documentId };
  })
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("generated_documents")
      .select("pdf_url, file_url")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error || !row) {
      return { ok: false as const, fileUrl: null as string | null };
    }
    const path = row.pdf_url ?? row.file_url;
    if (!path) return { ok: false as const, fileUrl: null as string | null };
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    return { ok: !!signed?.signedUrl, fileUrl: signed?.signedUrl ?? null };
  });

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
