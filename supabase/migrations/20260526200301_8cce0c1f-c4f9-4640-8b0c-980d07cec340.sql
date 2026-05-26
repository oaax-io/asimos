
CREATE OR REPLACE FUNCTION public.can_access_property(_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_manager_or_above() OR public.is_agent() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id
      AND (
        p.owner_id = auth.uid()
        OR p.assigned_to = auth.uid()
        OR (p.owner_client_id IS NOT NULL AND public.can_access_client(p.owner_client_id))
      )
  )
$function$;

DROP POLICY IF EXISTS property_media_access ON public.property_media;

CREATE POLICY property_media_select ON public.property_media
  FOR SELECT TO authenticated
  USING (public.can_access_property(property_id));

CREATE POLICY property_media_insert ON public.property_media
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_property(property_id));

CREATE POLICY property_media_update ON public.property_media
  FOR UPDATE TO authenticated
  USING (public.can_access_property(property_id))
  WITH CHECK (public.can_access_property(property_id));

CREATE POLICY property_media_delete ON public.property_media
  FOR DELETE TO authenticated
  USING (public.is_manager_or_above() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.owner_id = auth.uid() OR p.assigned_to = auth.uid())
  ));
