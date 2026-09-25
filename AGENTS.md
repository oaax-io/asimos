
- Platform Admin Center (/platform) reads tenant metadata only via platform_* SECURITY DEFINER RPCs gated by is_platform_admin(); why: platform roles must never bypass tenant RLS or expose CRM data.
- Tenant status (agencies.status) is enforced centrally in current_agency_id()/is_agency_member()/has_agency_role()/is_agency_owner_or_admin() via agency_is_active(); why: one enforcement point instead of frontend checks, while public domain branding stays independent.
- Platform admin mutations go only through platform_* RPCs that write exactly one platform_audit_logs row; why: auditable, no direct table writes from the browser.
- Tenant provisioning runs only through the atomic platform_create_tenant RPC (platform admins), pending owners without an account go to tenant_owner_invitations; why: no half-built tenants, no browser inserts, no temp passwords.
- Module access = agency_modules (product access, enforced server-side by RESTRICTIVE module_gate_* policies via agency_module_enabled_for(row agency_id)); module_permissions = role rights inside an available module; owner has full rights in enabled modules without rows; why: a role permission can never open a locked module.
## Domain Center (4.4)
- Platform domain mutations only via platform_* RPCs (platform_add_custom_domain/set_domain_active/set_primary_domain/remove_domain) writing one audit row; DNS result stored only by server via platform_domain_record_check (service_role); why: no browser writes, no fake verification.
- Wildcard reachability of *.immolia.ch is one flag IMMOLIA_WILDCARD_READY in platform-admin.ts; why: registered ≠ reachable, remove hint centrally later.
## Modules (4.5)
- Single module registry src/lib/modules.ts (MODULE_REGISTRY), mirrored in DB by platform_module_keys()/platform_core_module_keys(); why: one list, server validates keys.
- is_entitled only via platform_set_module_entitlement (platform admins, one audit row); tenants change is_enabled only (guard trigger blocks browser roles from is_entitled/core-disable); missing agency_modules row = denied; why: default-deny for SaaS tenants.
