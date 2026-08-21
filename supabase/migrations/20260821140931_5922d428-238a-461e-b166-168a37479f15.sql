REVOKE EXECUTE ON FUNCTION public.trash_restore(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.trash_restore(uuid) TO authenticated;