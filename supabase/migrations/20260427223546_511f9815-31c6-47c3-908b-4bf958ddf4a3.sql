
REVOKE EXECUTE ON FUNCTION public.current_agency_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_agency_id() TO authenticated;
