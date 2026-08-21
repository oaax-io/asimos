import { supabase } from "@/integrations/supabase/client";

/** Tabellen, die über den Papierkorb wiederhergestellt werden können. */
export const TRASH_TABLES = [
  "properties",
  "clients",
  "leads",
  "tasks",
  "appointments",
  "documents",
  "mandates",
  "reservations",
  "checklists",
  "nda_agreements",
  "financing_dossiers",
  "property_media",
  "generated_documents",
  "client_financial_items",
  "matches",
] as const;

export type TrashTable = (typeof TRASH_TABLES)[number];

export const TRASH_LABELS: Record<TrashTable, string> = {
  properties: "Immobilie",
  clients: "Kunde",
  leads: "Lead",
  tasks: "Aufgabe",
  appointments: "Termin",
  documents: "Dokument",
  mandates: "Mandat",
  reservations: "Reservation",
  checklists: "Checkliste",
  nda_agreements: "NDA",
  financing_dossiers: "Finanzierung",
  property_media: "Medien",
  generated_documents: "Generiertes Dokument",
  client_financial_items: "Finanzposition",
  matches: "Matching",
};

function guessLabel(row: Record<string, any>): string {
  const first =
    row.title ||
    row.name ||
    row.file_name ||
    row.subject ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    row.address ||
    row.reference ||
    row.email;
  return (first as string) || "Eintrag";
}

function guessSubtitle(row: Record<string, any>): string | null {
  return (row.reference || row.city || row.status || row.email || null) as string | null;
}

/**
 * Verschiebt Datensätze in den Papierkorb und löscht sie anschliessend.
 * Fällt auf einen einfachen Delete zurück, wenn der Snapshot nicht gelesen werden kann.
 */
export async function deleteToTrash(table: TrashTable, ids: string | string[]) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  if (!list.length) return;

  const { data: rows } = await supabase.from(table as any).select("*").in("id", list);

  if (rows?.length) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;
    let agencyId: string | null = null;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", userId)
        .maybeSingle();
      agencyId = (profile as any)?.agency_id ?? null;
    }

    const entries = (rows as Record<string, any>[]).map((row) => ({
      agency_id: (row.agency_id as string) ?? agencyId,
      table_name: table,
      record_id: row.id as string,
      label: guessLabel(row),
      subtitle: guessSubtitle(row),
      payload: row,
      deleted_by: userId,
    }));

    await supabase.from("trash_items").insert(entries as any);
  }

  const { error } = await supabase.from(table as any).delete().in("id", list);
  if (error) throw error;
}

export async function restoreFromTrash(id: string) {
  const { error } = await supabase.rpc("trash_restore" as any, { _id: id });
  if (error) throw error;
}

export async function purgeTrashItem(id: string) {
  const { error } = await supabase.from("trash_items").delete().eq("id", id);
  if (error) throw error;
}
