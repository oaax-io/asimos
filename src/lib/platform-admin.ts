/**
 * Immolia Platform Admin – Lesezugriff ausschliesslich über begrenzte
 * platform_* RPCs (serverseitig durch is_platform_admin() geschützt).
 * Keine direkten Tabellenzugriffe, keine CRM-Daten.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MODULE_LABEL, MODULE_KEYS, DEFAULT_MODULES } from "@/lib/modules";

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

export const TENANT_STATUS_LABEL: Record<string, string> = { active: "Aktiv", suspended: "Gesperrt", archived: "Archiviert" };
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

// ---- Phase 4.2: Verwaltung (nur über begrenzte platform_* RPCs) ----
export type PlatformAuditLog = {
  id: string; created_at: string; action: string; target_type: string; target_id: string | null;
  target_label: string | null; metadata: Record<string, unknown>; actor_name: string | null;
};
export const usePlatformAuditLogs = (agencyId?: string, limit = 100) => useQuery({
  queryKey: ["platform", "audit", agencyId ?? null, limit],
  queryFn: () => rpc<PlatformAuditLog[]>("platform_list_audit_logs", { _agency_id: agencyId ?? null, _limit: limit }),
});
export const setTenantStatus = (agencyId: string, status: "active" | "suspended" | "archived") =>
  rpc<string>("platform_set_tenant_status", { _agency_id: agencyId, _status: status });
export const updateTenantName = (agencyId: string, name: string) =>
  rpc<void>("platform_update_tenant", { _agency_id: agencyId, _name: name });
export const AUDIT_LABEL: Record<string, string> = {
  tenant_suspended: "Unternehmen gesperrt", tenant_reactivated: "Unternehmen reaktiviert",
  tenant_archived: "Unternehmen archiviert", tenant_updated: "Unternehmen geändert", tenant_created: "Unternehmen erstellt",
  domain_added: "Domain hinzugefügt", domain_verified: "Domain bestätigt", domain_activated: "Domain aktiviert",
  domain_deactivated: "Domain deaktiviert", domain_primary_changed: "Bevorzugte Domain geändert", domain_removed: "Domain entfernt",
  module_entitled: "Modul freigeschaltet", module_revoked: "Modul gesperrt",
};
/** Erlaubte Statuswechsel (archived → suspended nicht vorgesehen). */
export const STATUS_TRANSITIONS: Record<string, Array<"active" | "suspended" | "archived">> = {
  active: ["suspended", "archived"], suspended: ["active", "archived"], archived: ["active"],
};

// ---- Phase 4.3: Unternehmen anlegen (nur über platform_create_tenant) ----
export { MODULE_LABEL };
export const ALL_MODULES = MODULE_KEYS;
export const CORE_MODULES = DEFAULT_MODULES; // Vorauswahl Assistent (Legacy-Name)
export type SubdomainCheck = "available" | "taken" | "reserved" | "invalid";
export const checkSubdomain = (slug: string) => rpc<SubdomainCheck>("platform_check_subdomain", { _slug: slug });
export const checkOwnerEmail = (email: string) => rpc<boolean>("platform_check_owner_email", { _email: email });
export type CreateTenantResult = { agency_id: string; name: string; domain: string; owner_status: string; owner_user_exists: boolean; modules: string[] };
export const createTenant = (a: { name: string; slug: string; firstName: string; lastName: string; email: string; modules: string[] }) =>
  rpc<CreateTenantResult>("platform_create_tenant", {
    _name: a.name, _slug: a.slug, _owner_first_name: a.firstName, _owner_last_name: a.lastName, _owner_email: a.email, _modules: a.modules,
  });
export type OwnerInvitation = { first_name: string; last_name: string; email: string; status: string; created_at: string };
export const useOwnerInvitations = (agencyId: string) => useQuery({
  queryKey: ["platform", "owner-invitations", agencyId],
  queryFn: () => rpc<OwnerInvitation[]>("platform_list_owner_invitations", { _agency_id: agencyId }),
});
export const OWNER_STATUS_LABEL: Record<string, string> = {
  active: "Aktiv (Konto vorhanden)", pending_invitation: "Einladung ausstehend – noch kein Konto",
  pending: "Einladung ausstehend – noch kein Konto", invited: "Eingeladen", accepted: "Angenommen", cancelled: "Abgebrochen",
};
export function slugify(s: string) {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ag|gmbh|sa|sarl|sàrl|kg|ug)\b/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}

// ---- Phase 4.4: Domain Center (nur über platform_* RPCs) ----
/**
 * Zentraler Schalter: Ist *.immolia.ch technisch (Wildcard-DNS + Hosting) eingerichtet?
 * Solange false, gilt eine Immolia-Adresse nur als «registriert», nicht als erreichbar.
 */
export const IMMOLIA_WILDCARD_READY = false;
export type DomainCenterRow = {
  id: string; agency_id: string; agency_name: string; agency_status: string; domain: string; domain_type: "subdomain" | "custom";
  is_primary: boolean; verification_status: string; verified_at: string | null; activated_at: string | null; created_at: string;
  verification_checked_at: string | null; verification_error: string | null; has_branding: boolean;
};
export const useDomainCenter = (agencyId?: string) => useQuery({
  queryKey: ["platform", "domain-center", agencyId ?? null],
  queryFn: () => rpc<DomainCenterRow[]>("platform_domain_center", { _agency_id: agencyId ?? null }),
});
export const useDomainDnsRecord = (id: string | null) => useQuery({
  queryKey: ["platform", "domain-dns", id], enabled: !!id,
  queryFn: () => rpc<{ type: string; name: string; value: string } | null>("platform_domain_dns_record", { _id: id }),
});
export const addCustomDomain = (agencyId: string, domain: string) => rpc<string>("platform_add_custom_domain", { _agency_id: agencyId, _domain: domain });
export const setDomainActive = (id: string, active: boolean) => rpc<void>("platform_set_domain_active", { _id: id, _active: active });
export const setPrimaryDomain = (id: string) => rpc<void>("platform_set_primary_domain", { _id: id });
export const removeDomain = (id: string) => rpc<void>("platform_remove_domain", { _id: id });
export const VERIFICATION_LABEL: Record<string, string> = { pending: "Ausstehend", verified: "Bestätigt", failed: "Fehler" };
export function domainActive(d: Pick<DomainCenterRow, "domain_type" | "verification_status" | "activated_at">) {
  return d.verification_status === "verified" && (d.domain_type === "subdomain" || !!d.activated_at);
}
export const DOMAIN_ERROR_LABEL: Record<string, string> = {
  invalid_domain: "Ungültige Domain.", blocked_domain: "Diese Domain kann nicht verwendet werden.",
  duplicate_domain: "Diese Domain ist bereits vergeben.", custom_exists: "Dieses Unternehmen hat bereits eine Custom Domain.",
  not_verified: "Erst nach bestätigter DNS-Prüfung möglich.", is_primary: "Zuerst eine andere bevorzugte Domain wählen.",
  only_custom: "Immolia-Adressen können hier nicht geändert oder entfernt werden.", not_usable: "Nur bestätigte und aktive Domains können bevorzugt werden.",
  forbidden: "Keine Berechtigung.",
};
export const domainErrorText = (e: unknown) => {
  const m = (e as { message?: string })?.message ?? "";
  return DOMAIN_ERROR_LABEL[m] ?? "Aktion fehlgeschlagen.";
};

// ---- Phase 4.5: Modul-Freischaltung (nur über platform_set_module_entitlement) ----
export const setModuleEntitlement = (agencyId: string, module: string, entitled: boolean) =>
  rpc<void>("platform_set_module_entitlement", { _agency_id: agencyId, _module: module, _entitled: entitled });
