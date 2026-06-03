// Server-Funktionen für das Bank-Paket (Stufe 1 - Erstellung & Download).
// - buildBankPackage: sammelt Dossier-Daten, rendert Master-PDF, baut ZIP, lädt hoch
// - listBankPackages: gibt Historie zurück
// - getBankPackageSignedUrl: frischer signed Download-Link
// - fetchBankPackageBytes: proxy für adblocker-blockierte Domains

import { createServerFn } from "@tanstack/react-start";
import { zipSync, strToU8, type Zippable } from "fflate";
import { buildBankPackageHtml, type BankPackageInput, type PackageLocale } from "./bank-package-report";

const BANK_PACKAGES_BUCKET = "bank-packages";
const PDF_TIMEOUT_MS = 60_000;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB pro Datei
const MAX_TOTAL_ATTACHMENT_BYTES = 250 * 1024 * 1024; // 250 MB total

// ---------- helpers ----------

function safeFolderName(input: string): string {
  return (input || "Sonstige")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .slice(0, 80);
}

function safeFileName(input: string, fallback: string): string {
  const cleaned = (input || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .slice(0, 150);
  return cleaned || fallback;
}

function dedupeFileName(set: Set<string>, name: string): string {
  if (!set.has(name)) {
    set.add(name);
    return name;
  }
  const m = /^(.*?)(\.[^.]+)?$/.exec(name);
  const base = m?.[1] ?? name;
  const ext = m?.[2] ?? "";
  for (let i = 2; i < 9999; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!set.has(candidate)) {
      set.add(candidate);
      return candidate;
    }
  }
  return name;
}

// Versucht, eine Datei aus Storage zu laden. file_url kann sein:
// - voll-qualifizierte http(s)-URL (signed / public)
// - Storage-Pfad (z.B. "client/<uuid>/foo.pdf") in einem unbekannten Bucket
async function fetchAttachment(
  fileUrl: string,
  supabaseAdmin: unknown,
): Promise<{ bytes: Uint8Array; size: number } | null> {
  if (!fileUrl) return null;
  const admin = supabaseAdmin as {
    storage: {
      from: (b: string) => {
        download: (p: string) => Promise<{ data: Blob | null; error: { message: string } | null }>;
      };
    };
  };

  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      return { bytes: buf, size: buf.byteLength };
    } catch {
      return null;
    }
  }

  // Storage-Pfad: durchprobieren der bekannten Buckets
  const candidates = ["documents", "generated-documents", "media", "brand-assets"];
  for (const bucket of candidates) {
    try {
      const { data, error } = await admin.storage.from(bucket).download(fileUrl);
      if (!error && data) {
        const buf = new Uint8Array(await data.arrayBuffer());
        return { bytes: buf, size: buf.byteLength };
      }
    } catch {
      // weiter mit nächstem Bucket
    }
  }
  return null;
}

// ---------- buildBankPackage ----------

export const buildBankPackage = createServerFn({ method: "POST" })
  .inputValidator((input: { dossierId: string; locale?: PackageLocale }) => {
    if (!input?.dossierId || typeof input.dossierId !== "string") {
      throw new Error("dossierId is required");
    }
    return {
      dossierId: input.dossierId,
      locale: (input.locale ?? "de") as PackageLocale,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const serviceUrl = process.env.PDF_SERVICE_URL;
    const serviceToken = process.env.PDF_SERVICE_TOKEN;

    if (!serviceUrl || !serviceToken) {
      return {
        ok: false as const,
        reason: "no_server_pdf_provider" as const,
        message: "PDF-Service ist nicht konfiguriert.",
        filePath: null as string | null,
        fileUrl: null as string | null,
        generatedDocumentId: null as string | null,
      };
    }

    // 1) Dossier laden
    const { data: dossier, error: dossierErr } = await supabaseAdmin
      .from("financing_dossiers")
      .select("*")
      .eq("id", data.dossierId)
      .maybeSingle();
    if (dossierErr || !dossier) {
      return {
        ok: false as const,
        reason: "dossier_not_found" as const,
        message: dossierErr?.message ?? "Dossier nicht gefunden.",
        filePath: null,
        fileUrl: null,
        generatedDocumentId: null,
      };
    }

    // 2) Kunde + Ehepartner laden
    const clientIds = [dossier.client_id, dossier.co_applicant_client_id].filter(Boolean) as string[];
    const { data: clients } = await supabaseAdmin.from("clients").select("*").in("id", clientIds);
    const mainClient = clients?.find((c) => c.id === dossier.client_id) ?? null;
    const coClient = dossier.co_applicant_client_id
      ? (clients?.find((c) => c.id === dossier.co_applicant_client_id) ?? null)
      : null;

    // 3) Selbstauskünfte
    const { data: disclosures } = await supabaseAdmin
      .from("client_self_disclosures")
      .select("*")
      .in("client_id", clientIds);
    const mainDisclosure = disclosures?.find((d) => d.client_id === dossier.client_id) ?? null;
    const coDisclosure = dossier.co_applicant_client_id
      ? (disclosures?.find((d) => d.client_id === dossier.co_applicant_client_id) ?? null)
      : null;

    // 4) Property optional
    let property: { title?: string | null; address?: string | null; city?: string | null; type?: string | null; area?: number | null; rooms?: number | null } | null = null;
    if (dossier.property_id) {
      const { data: prop } = await supabaseAdmin
        .from("properties")
        .select("title, address, city, type, area, rooms")
        .eq("id", dossier.property_id)
        .maybeSingle();
      property = (prop as typeof property) ?? null;
    }

    // 5) Checkliste
    const { data: checklistRows } = await supabaseAdmin
      .from("financing_checklist_items")
      .select("label, section, status, note, sort_order")
      .eq("dossier_id", data.dossierId)
      .order("sort_order", { ascending: true });

    // 6) Dokumente (Kunde, Ehepartner, Objekt, Financing)
    const orParts: string[] = [`and(related_type.eq.financing,related_id.eq.${data.dossierId})`];
    if (dossier.client_id) orParts.push(`and(related_type.eq.client,related_id.eq.${dossier.client_id})`);
    if (dossier.co_applicant_client_id)
      orParts.push(`and(related_type.eq.client,related_id.eq.${dossier.co_applicant_client_id})`);
    if (dossier.property_id) orParts.push(`and(related_type.eq.property,related_id.eq.${dossier.property_id})`);

    const { data: documents } = await supabaseAdmin
      .from("documents")
      .select("id, file_name, file_url, document_type, related_type, related_id, mime_type, size_bytes, created_at")
      .or(orParts.join(","));

    // Generierte Dokumente (Mandate, Reservation, Quick-Check-PDFs etc.) - aber bereits erstellte Bank-Pakete ausschliessen
    const { data: generated } = await supabaseAdmin
      .from("generated_documents")
      .select("id, title, file_url, document_type, related_type, related_id, created_at")
      .or(orParts.join(","));

    // 7) Brand + Agent
    const { data: brand } = await supabaseAdmin
      .from("brand_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 8) Dokumente herunterladen und ZIP-Inventar zusammenstellen
    const zipEntries: Zippable = {};
    const usedNames = new Set<string>();
    const inventory: BankPackageInput["documents"] = [];
    let totalBytes = 0;

    type DocSource = {
      file_name: string | null;
      file_url: string | null;
      document_type?: string | null;
      related_type?: string | null;
      related_id?: string | null;
      title?: string | null;
      mime_type?: string | null;
      size_bytes?: number | null;
    };

    const sourceLabel = (d: DocSource): { folder: string; label: string } => {
      if (d.related_type === "client") {
        if (d.related_id === dossier.co_applicant_client_id) return { folder: "02_Ehepartner", label: "Ehepartner" };
        return { folder: "01_Kunde", label: "Kunde" };
      }
      if (d.related_type === "property") return { folder: "03_Objekt", label: "Objekt" };
      if (d.related_type === "financing") return { folder: "04_Finanzierung", label: "Finanzierung" };
      return { folder: "05_Sonstige", label: "Sonstige" };
    };

    const addToZip = async (d: DocSource, isGenerated: boolean) => {
      if (!d.file_url) return;
      if (totalBytes >= MAX_TOTAL_ATTACHMENT_BYTES) return;

      const fetched = await fetchAttachment(d.file_url, supabaseAdmin);
      if (!fetched) return;
      if (fetched.size > MAX_ATTACHMENT_BYTES) return;
      if (totalBytes + fetched.size > MAX_TOTAL_ATTACHMENT_BYTES) return;

      const baseName = isGenerated
        ? (d.title ?? d.file_name ?? `generiert_${d.related_id ?? "datei"}.pdf`)
        : (d.file_name ?? `datei_${d.related_id ?? "x"}`);
      const cleaned = safeFileName(baseName, "datei.bin");
      const targetFolder = safeFolderName(isGenerated ? "06_Generiert" : sourceLabel(d).folder);
      const fullPath = `${targetFolder}/${dedupeFileName(usedNames, cleaned)}`;
      zipEntries[fullPath] = fetched.bytes;
      totalBytes += fetched.size;
      inventory.push({
        folder: targetFolder,
        filename: fullPath.split("/").pop() ?? cleaned,
        source: isGenerated ? "Generiert" : sourceLabel(d).label,
        size_bytes: fetched.size,
      });
    };

    for (const d of documents ?? []) await addToZip(d as DocSource, false);
    for (const d of generated ?? []) {
      // Bereits existierende Bank-Pakete nicht ins neue Paket aufnehmen
      if (d.document_type === "bank_package") continue;
      await addToZip(d as DocSource, true);
    }

    // 9) Master-HTML & PDF
    const applicantData = {
      full_name: mainClient?.full_name ?? null,
      email: mainClient?.email ?? null,
      phone: mainClient?.phone ?? null,
      address: [mainClient?.address, mainClient?.postal_code, mainClient?.city]
        .filter(Boolean)
        .join(", ") || null,
      birth_date: mainDisclosure?.birth_date ?? null,
      nationality: mainDisclosure?.nationality ?? null,
      marital_status: mainDisclosure?.marital_status ?? null,
      employment_status: mainDisclosure?.employment_status ?? null,
      employer_name: mainDisclosure?.employer_name ?? null,
      salary_net_monthly: mainDisclosure?.salary_net_monthly ?? null,
      annual_net_salary: mainDisclosure?.annual_net_salary ?? null,
      total_income_monthly: mainDisclosure?.total_income_monthly ?? null,
      total_expenses_monthly: mainDisclosure?.total_expenses_monthly ?? null,
      reserve_total: mainDisclosure?.reserve_total ?? null,
    };

    const coApplicantData = coClient
      ? {
          full_name: coClient.full_name ?? null,
          email: coClient.email ?? null,
          phone: coClient.phone ?? null,
          address: [coClient.address, coClient.postal_code, coClient.city].filter(Boolean).join(", ") || null,
          birth_date: coDisclosure?.birth_date ?? null,
          nationality: coDisclosure?.nationality ?? null,
          marital_status: coDisclosure?.marital_status ?? null,
          employment_status: coDisclosure?.employment_status ?? null,
          employer_name: coDisclosure?.employer_name ?? null,
          salary_net_monthly: coDisclosure?.salary_net_monthly ?? null,
          annual_net_salary: coDisclosure?.annual_net_salary ?? null,
          total_income_monthly: coDisclosure?.total_income_monthly ?? null,
          total_expenses_monthly: coDisclosure?.total_expenses_monthly ?? null,
          reserve_total: coDisclosure?.reserve_total ?? null,
        }
      : null;

    const html = buildBankPackageHtml({
      locale: data.locale,
      brand: brand ?? null,
      dossier: dossier as BankPackageInput["dossier"],
      applicant: applicantData,
      coApplicant: coApplicantData,
      property,
      checklist: (checklistRows ?? []).map((c) => ({
        label: c.label,
        section: c.section,
        status: c.status,
        note: c.note,
      })),
      documents: inventory,
    });

    // PDF rendern
    let pdfBytes: Uint8Array;
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
        body: JSON.stringify({ html, title: "Bank-Paket", filename: "00_Dossier.pdf" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false as const,
          reason: "pdf_render_failed" as const,
          message: `PDF-Service Fehler [${res.status}]: ${text.slice(0, 200)}`,
          filePath: null,
          fileUrl: null,
          generatedDocumentId: null,
        };
      }
      pdfBytes = new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      return {
        ok: false as const,
        reason: "pdf_render_error" as const,
        message: `PDF-Service nicht erreichbar: ${(err as Error).message}`,
        filePath: null,
        fileUrl: null,
        generatedDocumentId: null,
      };
    } finally {
      clearTimeout(timeoutId);
    }

    // 10) ZIP bauen
    const clientSlug = safeFileName(mainClient?.full_name ?? "Kunde", "Kunde").replace(/[ .]+$/, "");
    zipEntries[`00_Dossier_${clientSlug}.pdf`] = pdfBytes;
    zipEntries["README.txt"] = strToU8(
      [
        `Bank-Paket - ${mainClient?.full_name ?? ""}`,
        `Dossier-ID: ${dossier.id}`,
        `Erstellt: ${new Date().toLocaleString("de-CH")}`,
        ``,
        `Inhalt:`,
        `- 00_Dossier_${clientSlug}.pdf: Master-Dossier mit Kunde, Ehepartner, Finanzierung, Checkliste, Notizen`,
        `- 01_Kunde/: Unterlagen des Hauptantragstellers`,
        coApplicantData ? `- 02_Ehepartner/: Unterlagen des Mitantragstellers` : null,
        property ? `- 03_Objekt/: Unterlagen zum Objekt` : null,
        `- 04_Finanzierung/: Unterlagen zur Finanzierung`,
        `- 06_Generiert/: Generierte Dokumente (Quick-Check PDF etc.)`,
      ]
        .filter(Boolean)
        .join("\n"),
    );

    let zipBytes: Uint8Array;
    try {
      zipBytes = zipSync(zipEntries, { level: 6 });
    } catch (err) {
      return {
        ok: false as const,
        reason: "zip_failed" as const,
        message: `ZIP konnte nicht erstellt werden: ${(err as Error).message}`,
        filePath: null,
        fileUrl: null,
        generatedDocumentId: null,
      };
    }

    // 11) Upload
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const zipFileName = `Bank-Paket_${clientSlug}_${timestamp.slice(0, 19)}.zip`;
    const storagePath = `${data.dossierId}/${zipFileName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(BANK_PACKAGES_BUCKET)
      .upload(storagePath, zipBytes, {
        contentType: "application/zip",
        upsert: false,
      });
    if (upErr) {
      return {
        ok: false as const,
        reason: "storage_upload_failed" as const,
        message: `Upload fehlgeschlagen: ${upErr.message}`,
        filePath: null,
        fileUrl: null,
        generatedDocumentId: null,
      };
    }

    // 12) generated_documents Eintrag (Historie)
    const insertRow = {
      title: `Bank-Paket ${clientSlug} (${new Date().toLocaleString("de-CH")})`,
      document_type: "bank_package",
      related_type: "financing",
      related_id: data.dossierId,
      file_url: storagePath,
      status: "ready",
      variables: {
        bytes: zipBytes.byteLength,
        attachments: inventory.length,
        attachment_bytes: totalBytes,
      } as Record<string, unknown>,
    };
    const { data: createdRow, error: insertErr } = await supabaseAdmin
      .from("generated_documents")
      .insert(insertRow as never)
      .select("id")
      .maybeSingle();
    if (insertErr) {
      console.warn("[bank-package] generated_documents insert failed", insertErr.message);
    }

    // 13) Signed URL (1h) für sofortigen Download
    const { data: signed } = await supabaseAdmin.storage
      .from(BANK_PACKAGES_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);

    // 14) Activity-Log
    try {
      await supabaseAdmin.from("activity_logs").insert({
        action: "Bank-Paket erstellt",
        related_type: "financing",
        related_id: data.dossierId,
        metadata: {
          bytes: zipBytes.byteLength,
          attachments: inventory.length,
          storage_path: storagePath,
        },
      } as never);
    } catch {
      // non-fatal
    }

    return {
      ok: true as const,
      filePath: storagePath,
      fileUrl: signed?.signedUrl ?? null,
      fileName: zipFileName,
      sizeBytes: zipBytes.byteLength,
      attachmentCount: inventory.length,
      generatedDocumentId: createdRow?.id ?? null,
    };
  });

// ---------- listBankPackages ----------

export const listBankPackages = createServerFn({ method: "GET" })
  .inputValidator((input: { dossierId: string }) => {
    if (!input?.dossierId) throw new Error("dossierId is required");
    return { dossierId: input.dossierId };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("generated_documents")
      .select("id, title, file_url, created_at, variables, created_by")
      .eq("related_type", "financing")
      .eq("related_id", data.dossierId)
      .eq("document_type", "bank_package")
      .order("created_at", { ascending: false });
    if (error) return { ok: false as const, packages: [] as const, message: error.message };
    return {
      ok: true as const,
      message: null as string | null,
      packages: (rows ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        file_url: r.file_url,
        created_at: r.created_at,
        variables: (r.variables ?? {}) as Record<string, unknown>,
      })),
    };
  });

// ---------- getBankPackageSignedUrl ----------

export const getBankPackageSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string }) => {
    if (!input?.path) throw new Error("path is required");
    return { path: input.path };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BANK_PACKAGES_BUCKET)
      .createSignedUrl(data.path, 60 * 60 * 24); // 24h
    if (error || !signed?.signedUrl) {
      return { ok: false as const, fileUrl: null as string | null, message: error?.message ?? "not_found" };
    }
    return { ok: true as const, fileUrl: signed.signedUrl, message: null as string | null };
  });

// ---------- fetchBankPackageBytes (proxy für adblocker) ----------

export const fetchBankPackageBytes = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string }) => {
    if (!input?.path) throw new Error("path is required");
    return { path: input.path };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error } = await supabaseAdmin.storage
      .from(BANK_PACKAGES_BUCKET)
      .download(data.path);
    if (error || !file) {
      return { ok: false as const, base64: null as string | null, message: error?.message ?? "not_found" };
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < buf.length; i += chunkSize) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
    }
    return { ok: true as const, base64: btoa(binary), message: null as string | null };
  });
