REVOKE EXECUTE ON FUNCTION public.resolve_public_tenant_branding(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_branding(text) TO service_role;