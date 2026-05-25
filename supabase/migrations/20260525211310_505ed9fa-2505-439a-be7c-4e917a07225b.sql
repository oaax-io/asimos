-- property_media: ownership-basiert
DROP POLICY IF EXISTS property_media_authenticated_all ON public.property_media;
CREATE POLICY property_media_access ON public.property_media
  FOR ALL TO authenticated
  USING (public.is_manager_or_above() OR public.can_access_property(property_id))
  WITH CHECK (public.is_manager_or_above() OR public.can_access_property(property_id));

-- property_market_analyses: tighten INSERT/SELECT
DROP POLICY IF EXISTS pma_insert_authenticated ON public.property_market_analyses;
DROP POLICY IF EXISTS pma_select_authenticated ON public.property_market_analyses;

CREATE POLICY pma_select_access ON public.property_market_analyses
  FOR SELECT TO authenticated
  USING (public.is_manager_or_above() OR public.can_access_property(property_id) OR created_by = auth.uid());

CREATE POLICY pma_insert_access ON public.property_market_analyses
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_manager_or_above() OR public.can_access_property(property_id))
  );

-- SECURITY DEFINER Funktionen vor anonymem Zugriff schützen (link-Funktionen bleiben öffentlich)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN ('set_default_template','user_can','tg_reservation_sync_property')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
  END LOOP;
END $$;