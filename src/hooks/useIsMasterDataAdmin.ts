// ---------------------------------------------------------------------------
// Rollenprüfung für die Stammlisten-Verwaltung (Einstellungen → Kategorien).
// Bearbeiten dürfen nur Inhaber/Admin (profiles.role) oder Superadmin.
// Serverseitig wird dasselbe über die RLS-Policies auf
// public.master_list_values und public.property_feature_options erzwungen.
// ---------------------------------------------------------------------------
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useIsMasterDataAdmin() {
  const { user, isSuperadmin } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["is-master-data-admin", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      const role = (profile as any)?.role;
      const isAdmin = role === "admin" || role === "owner";
      const hasAdminRole = (roles ?? []).some(
        (r: any) => r.role === "superadmin" || r.role === "admin" || r.role === "owner",
      );
      return isAdmin || hasAdminRole;
    },
  });

  return { canEdit: isSuperadmin || query.data === true, loading: query.isLoading };
}
