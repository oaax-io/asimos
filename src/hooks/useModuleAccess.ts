import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Pfad → Modul. Ohne Eintrag gilt eine Seite als nicht modulgebunden. */
export const PATH_MODULE: Array<[string, string]> = [
  ["/leads", "leads"], ["/clients", "clients"], ["/properties", "properties"], ["/matching", "matching"],
  ["/financing", "financing"], ["/appointments", "appointments"], ["/tasks", "tasks"], ["/analytics", "analytics"],
  ["/documents", "documents"], ["/generated-documents", "documents"], ["/media", "media"], ["/mandates", "mandates"],
  ["/reservations", "reservations"], ["/ndas", "ndas"], ["/checklists", "checklists"], ["/exposes", "exposes"],
  ["/team", "employees"], ["/settings/company", "company_settings"], ["/feedback", "feedback"], ["/docs", "docs"],
];
export const moduleForPath = (p: string) => PATH_MODULE.find(([pre]) => p === pre || p.startsWith(pre + "/"))?.[1] ?? null;

/**
 * Nur Anzeige: Die eigentliche Sperre liegt serverseitig (RESTRICTIVE-Policies
 * module_gate_* + agency_module_enabled). Fehlt ein Eintrag, gilt das Modul als offen
 * (gleiche Regel wie agency_module_enabled).
 */
export function useModuleAccess() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["agency-modules", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_modules").select("module, is_entitled, is_enabled");
      if (error) throw error;
      return data ?? [];
    },
  });
  const isEnabled = (module: string | null) => {
    if (!module || !q.data) return true;
    const row = q.data.find((r) => r.module === module);
    return row ? row.is_entitled && row.is_enabled : true;
  };
  return { isEnabled, loaded: q.isSuccess };
}
