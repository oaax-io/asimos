REVOKE ALL ON public.platform_audit_logs FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.platform_audit_logs FROM authenticated;