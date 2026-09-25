// ---------------------------------------------------------------------------
// Rollenprüfung für die Stammlisten-Verwaltung (Einstellungen → Kategorien).
// Bearbeiten dürfen nur Inhaber/Admin der aktuellen Firma (Mitgliedschaft).
// Plattformrechte verleihen bewusst KEIN Bearbeitungsrecht für Firmen-Stammdaten.
// Serverseitig wird dasselbe über die Zugriffsregeln erzwungen.
// ---------------------------------------------------------------------------
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useIsMasterDataAdmin() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["is-master-data-admin", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_owner_or_admin");
      if (error) return false;
      return !!data;
    },
  });

  return { canEdit: query.data === true, loading: query.isLoading };
}
