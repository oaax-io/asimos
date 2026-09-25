import { supabase } from "@/integrations/supabase/client";

/**
 * Liefert für neue private Uploads einen tenantbezogenen Pfad: agency/{agency_id}/{rest}.
 * Ohne aktive Firma wird der Legacy-Pfad verwendet (bestehende Dateien bleiben unverändert).
 */
export async function tenantStoragePath(rest: string): Promise<string> {
  const { data } = await supabase.rpc("current_agency_id");
  const agencyId = typeof data === "string" && data ? data : null;
  const clean = rest.replace(/^\/+/, "");
  return agencyId ? `agency/${agencyId}/${clean}` : clean;
}
