
CREATE OR REPLACE FUNCTION public.is_agent()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'agent'::public.app_role)
$$;

DROP POLICY IF EXISTS properties_select ON public.properties;
DROP POLICY IF EXISTS properties_insert ON public.properties;
DROP POLICY IF EXISTS properties_update ON public.properties;
DROP POLICY IF EXISTS properties_delete ON public.properties;

CREATE POLICY properties_select ON public.properties FOR SELECT TO authenticated
USING (is_manager_or_above() OR is_agent() OR owner_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY properties_insert ON public.properties FOR INSERT TO authenticated
WITH CHECK (is_manager_or_above() OR is_agent() OR owner_id = auth.uid());

CREATE POLICY properties_update ON public.properties FOR UPDATE TO authenticated
USING (is_manager_or_above() OR is_agent() OR owner_id = auth.uid() OR assigned_to = auth.uid())
WITH CHECK (is_manager_or_above() OR is_agent() OR owner_id = auth.uid() OR assigned_to = auth.uid());

-- Makler dürfen NICHT löschen
CREATE POLICY properties_delete ON public.properties FOR DELETE TO authenticated
USING (is_manager_or_above() OR owner_id = auth.uid());
