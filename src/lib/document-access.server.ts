/**
 * Zentrale serverseitige Zugriffskontrolle für Dokumente (Phase 3A.1).
 *
 * Kette: authentifizierter Benutzer → aktive agency_membership → current_agency_id()
 *        → document.agency_id. Erst danach darf Service Role verwendet werden.
 *
 * Verweigerungen liefern immer denselben neutralen Fehler, damit nicht erkennbar
 * ist, ob ein fremdes Dokument existiert.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserClient = any;

export const DOCUMENT_ACCESS_DENIED = "Dokument nicht gefunden oder kein Zugriff";
const BUCKET = "documents";

function deny(): never {
  throw new Error(DOCUMENT_ACCESS_DENIED);
}

/** Liefert die aktive Firma des Benutzers (nur über aktive Mitgliedschaft) oder wirft. */
export async function requireCurrentAgency(sb: UserClient): Promise<string> {
  const { data, error } = await sb.rpc("current_agency_id");
  if (error || typeof data !== "string" || !data) deny();
  return data;
}

/** generated_documents: Datensatz muss zur aktuellen Firma gehören. */
export async function assertGeneratedDocumentAccess(sb: UserClient, documentId: string) {
  const agencyId = await requireCurrentAgency(sb);
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) deny();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("generated_documents")
    .select("id, agency_id, pdf_url, file_url, related_type, related_id, title, document_type, created_by")
    .eq("id", documentId)
    .maybeSingle();
  if (!data || data.agency_id !== agencyId) deny();
  return { agencyId, doc: data };
}

function normalizePath(path: string): string {
  if (typeof path !== "string") deny();
  const p = path.trim().replace(/^\/+/, "");
  if (!p || p.length > 1024 || p.includes("..") || p.includes("\\") || p.includes("\0")) deny();
  return p;
}

/**
 * Storage-Pfad im Bucket "documents": Zugriff nur, wenn der Pfad serverseitig
 * der aktuellen Firma zugeordnet ist (Tenant-Präfix, Dokumentdatensatz oder
 * storage_object_tenants). Ein vom Client gelieferter Pfad allein genügt nie.
 */
export async function assertDocumentPathAccess(sb: UserClient, rawPath: string) {
  const agencyId = await requireCurrentAgency(sb);
  const path = normalizePath(rawPath);

  // 1) Neue Uploads: agency/{agency_id}/…
  if (path.startsWith("agency/")) {
    if (path.startsWith(`agency/${agencyId}/`)) return { agencyId, path };
    deny();
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 2) Legacy: über Dokumentdatensatz auflösen
  const [{ data: genPdf }, { data: genFile }, { data: docs }, { data: sot }] = await Promise.all([
    supabaseAdmin.from("generated_documents").select("agency_id").eq("pdf_url", path).limit(5),
    supabaseAdmin.from("generated_documents").select("agency_id").eq("file_url", path).limit(5),
    supabaseAdmin.from("documents").select("agency_id").eq("file_url", path).limit(5),
    supabaseAdmin.from("storage_object_tenants").select("agency_id").eq("bucket_id", BUCKET).eq("object_name", path).limit(5),
  ]);
  const owners = [...(genPdf ?? []), ...(genFile ?? []), ...(docs ?? []), ...(sot ?? [])].map((r: { agency_id: string | null }) => r.agency_id);
  if (owners.length === 0) deny();
  // Jede Zuordnung muss zur aktuellen Firma passen (keine Mischzuordnung).
  if (owners.some((a) => a !== agencyId)) deny();
  return { agencyId, path };
}
