REVOKE EXECUTE ON FUNCTION public.commercial_valid_entitlement_key(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.commercial_can_read(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.agency_active_plan_id(uuid) FROM authenticated;