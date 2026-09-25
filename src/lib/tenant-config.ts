/**
 * Zentrale Tenant-Konfigurationsauflösung.
 *
 * Angemeldete App:   Benutzer → aktuelle Firma → get_tenant_config()
 * Öffentliche Links: Token/Ressource → agency_id → Branding (serverseitig in der
 *                    jeweiligen Resolve-Funktion, z. B. bank_package_share_resolve)
 * Später Domains:    Hostname → Firma identifizieren → Branding. Ein Hostname
 *                    verleiht NIE Berechtigungen; Rechte kommen nur aus der Mitgliedschaft.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TenantBranding = {
  agency_id: string;
  company_name: string | null;
  logo_url: string | null;
  logo_alt_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  favicon_url: string | null;
  font_family: string | null;
  company_email: string | null;
  company_website: string | null;
  company_address: string | null;
};

export type TenantConfig = {
  agency_id: string;
  branding: TenantBranding | null;
  /** Modul → nutzbar (Plattform-Freischaltung UND Firmen-Einstellung). Fehlt ein Modul, gilt es als nutzbar. */
  modules: Record<string, boolean>;
};

export async function fetchTenantConfig(): Promise<TenantConfig | null> {
  const { data, error } = await (supabase as any).rpc("get_tenant_config");
  if (error) throw error;
  return (data ?? null) as TenantConfig | null;
}

export function useTenantConfig() {
  return useQuery({
    queryKey: ["tenant-config"],
    queryFn: fetchTenantConfig,
    staleTime: 5 * 60 * 1000,
  });
}

export function isModuleAvailable(cfg: TenantConfig | null | undefined, module: string): boolean {
  if (!cfg) return true;
  return cfg.modules?.[module] ?? true;
}
