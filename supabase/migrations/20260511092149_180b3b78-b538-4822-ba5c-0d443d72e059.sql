GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;