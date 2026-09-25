REVOKE EXECUTE ON FUNCTION public.is_platform_admin(), public.is_system_owner(), public.platform_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(), public.is_system_owner(), public.platform_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sync_membership_from_role() FROM PUBLIC, anon, authenticated;