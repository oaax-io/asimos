/**
 * Immolia Platform Admin – Lesezugriff ausschliesslich über begrenzte
 * platform_* RPCs (serverseitig durch is_platform_admin() geschützt).
 * Keine direkten Tabellenzugriffe, keine CRM-Daten.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw error;
  return data as T;
}

export type PlatformOverview = {
  tenants: number; users: number; active_domains: number;
  subdomains: number; custom_domains: number; active_modules: number;
};
export type PlatformTenant = {
  id: string; name: string; status: "active" | "suspended" | "archived"; created_at: string;
  members: number; subdomain: string | null; custom_domain: string | null;
  custom_domain_status: string | null; custom_domain_active: boolean;
  has_branding: boolean; modules_active: number;
};
export type PlatformMember = {
  user_id: string; full_name: string | null; email: string | null; agency_id: string;
  agency_name: string; tenant_role: string; is_active: boolean; created_at: string; platform_role: string | null;
};
export type PlatformDomain = {
  id: string; agency_id: string; agency_name: string; domain: string; domain_type: string;
  verification_status: string; verified_at: string | null; activated_at: string | null; created_at: string;
};
export type PlatformModule = { agency_id: string; agency_name: string; module: string; is_entitled: boolean; is_enabled: boolean };
export type PlatformActivity = { at: string; kind: string; agency_id: string | null; agency_name: string | null; label: string | null };
export type PlatformAdmin = { user_id: string; full_name: string | null; email: string | null; platform_role: string; created_at: string };

export const usePlatformOverview = () => useQuery({ queryKey: ["platform", "overview"], queryFn: () => rpc<PlatformOverview>("platform_overview") });
export const usePlatformTenants = () => useQuery({ queryKey: ["platform", "tenants"], queryFn: () => rpc<PlatformTenant[]>("platform_list_tenants") });
export const usePlatformMembers = (agencyId?: string) => useQuery({ queryKey: ["platform", "members", agencyId ?? null], queryFn: () => rpc<PlatformMember[]>("platform_list_members", { _agency_id: agencyId ?? null }) });
export const usePlatformDomains = (agencyId?: string) => useQuery({ queryKey: ["platform", "domains", agencyId ?? null], queryFn: () => rpc<PlatformDomain[]>("platform_list_domains", { _agency_id: agencyId ?? null }) });
export const usePlatformModules = (agencyId?: string) => useQuery({ queryKey: ["platform", "modules", agencyId ?? null], queryFn: () => rpc<PlatformModule[]>("platform_list_modules", { _agency_id: agencyId ?? null }) });
export const usePlatformActivity = (agencyId?: string, limit = 30) => useQuery({ queryKey: ["platform", "activity", agencyId ?? null, limit], queryFn: () => rpc<PlatformActivity[]>("platform_activity", { _agency_id: agencyId ?? null, _limit: limit }) });
export const usePlatformBranding = (agencyId: string) => useQuery({ queryKey: ["platform", "branding", agencyId], queryFn: () => rpc<Record<string, string | null> | null>("platform_tenant_branding", { _agency_id: agencyId }) });
export const usePlatformAdmins = () => useQuery({ queryKey: ["platform", "admins"], queryFn: () => rpc<PlatformAdmin[]>("platform_list_admins") });

export const TENANT_STATUS_LABEL: Record<string, string> = { active: "Aktiv", suspended: "Deaktiviert", archived: "Archiviert" };
export const ACTIVITY_LABEL: Record<string, string> = {
  tenant_created: "Unternehmen angelegt", domain_added: "Domain erfasst", domain_verified: "Domain verifiziert",
  domain_activated: "Domain aktiviert", member_added: "Mitglied hinzugefügt",
};
export const ROLE_LABEL: Record<string, string> = {
  owner: "Inhaber", admin: "Admin", manager: "Manager", agent: "Agent", assistant: "Assistenz", employee: "Mitarbeitende",
  system_owner: "System Owner", platform_admin: "Platform Admin", platform_support: "Platform Support",
};
export function domainStatusLabel(d: { verification_status: string | null; activated_at?: string | null; domain_type?: string }) {
  if (!d.verification_status) return "–";
  if (d.verification_status === "verified") return d.domain_type === "custom" && !d.activated_at ? "Verifiziert" : "Aktiv";
  return d.verification_status === "pending" ? "Ausstehend" : "Fehler";
}
export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("de-CH") : "–");
export const fmtDateTime = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" }) : "–");
