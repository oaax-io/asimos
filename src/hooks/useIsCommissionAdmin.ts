// ---------------------------------------------------------------------------
// Gemeinsame Rollenprüfung für die Provisionsdaten.
// Nur Rolle 'admin' (profiles.role) oder Superadmin (user_roles = 'superadmin',
// gleiche Logik wie `effectiveIsSuperadmin` in team.tsx) dürfen die
// Provisionszahlen ALLER Mitarbeitenden sehen. Serverseitig wird dasselbe über
// die SQL-Funktion public.is_commission_admin() in den RLS-Policies erzwungen;
// diese Prüfung hier dient nur der passenden Darstellung im UI.
// ---------------------------------------------------------------------------
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useIsCommissionAdmin() {
  const { user, isSuperadmin } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["is-commission-admin", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      const isAdmin = (profile as any)?.role === "admin";
      const isSystemowner = (roles ?? []).some((r: any) => r.role === "superadmin");
      return isAdmin || isSystemowner;
    },
  });

  return {
    isCommissionAdmin: isSuperadmin || query.data === true,
    loading: query.isLoading,
    userId,
  };
}
