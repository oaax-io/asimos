
- Platform Admin Center (/platform) reads tenant metadata only via platform_* SECURITY DEFINER RPCs gated by is_platform_admin(); why: platform roles must never bypass tenant RLS or expose CRM data.
- Tenant status (agencies.status) is enforced centrally in current_agency_id()/is_agency_member()/has_agency_role()/is_agency_owner_or_admin() via agency_is_active(); why: one enforcement point instead of frontend checks, while public domain branding stays independent.
- Platform admin mutations go only through platform_* RPCs that write exactly one platform_audit_logs row; why: auditable, no direct table writes from the browser.
- Tenant provisioning runs only through the atomic platform_create_tenant RPC (platform admins), pending owners without an account go to tenant_owner_invitations; why: no half-built tenants, no browser inserts, no temp passwords.
- Module access = agency_modules (product access, enforced server-side by RESTRICTIVE module_gate_* policies via agency_module_enabled_for(row agency_id)); module_permissions = role rights inside an available module; owner has full rights in enabled modules without rows; why: a role permission can never open a locked module.
