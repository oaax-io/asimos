REVOKE EXECUTE ON FUNCTION public.agency_module_enabled(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_agency_modules_guard() FROM PUBLIC, anon, authenticated;