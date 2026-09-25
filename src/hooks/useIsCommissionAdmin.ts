// Rollenprüfung für Provisionsdaten (Tenant-Ebene): Inhaber/Admin der Firma.
// Plattformrechte spielen bewusst keine Rolle; serverseitig via is_commission_admin().
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useIsCommissionAdmin() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const query = useQuery({
    queryKey: ["is-commission-admin", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_commission_admin");
      return !error && !!data;
    },
  });
  return { isCommissionAdmin: query.data === true, loading: query.isLoading, userId };
}
