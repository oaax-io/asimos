/**
 * Zentrale Tenant-Konfigurationsauflösung.
 *
 * Angemeldete App:   Benutzer → aktive Mitgliedschaft → current_agency_id() → get_tenant_config()
 * Öffentliche Links: Token/Ressource → agency_id → Branding (serverseitig in der
 *                    jeweiligen Resolve-Funktion, z. B. bank_package_share_resolve)
 * Später Domains:    Hostname → Firma identifizieren → Branding. Ein Hostname
 *                    verleiht NIE Berechtigungen; Rechte kommen nur aus der Mitgliedschaft.
 *
 * Branding ist reine Darstellung – niemals für Autorisierung verwenden.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TenantCompany = {
  name: string | null;
  legal_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
};

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
  company: TenantCompany | null;
};

export type TenantModuleState = { unlocked: boolean; enabled: boolean };

export type TenantConfig = {
  agency_id: string;
  agency_name: string | null;
  branding: TenantBranding | null;
  /** Modul → nutzbar (Plattform-Freischaltung UND Firmen-Einstellung). Fehlt ein Modul, gilt es als nutzbar. */
  modules: Record<string, boolean>;
  module_states: Record<string, TenantModuleState>;
};

export async function fetchTenantConfig(): Promise<TenantConfig | null> {
  const { data, error } = await (supabase as any).rpc("get_tenant_config");
  if (error) throw error;
  return (data ?? null) as TenantConfig | null;
}

export const TENANT_CONFIG_QUERY_KEY = ["tenant-config"] as const;

export function useTenantConfig(enabled = true) {
  return useQuery({
    queryKey: TENANT_CONFIG_QUERY_KEY,
    queryFn: fetchTenantConfig,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function isModuleAvailable(cfg: TenantConfig | null | undefined, module: string): boolean {
  if (!cfg) return true;
  return cfg.modules?.[module] ?? true;
}
