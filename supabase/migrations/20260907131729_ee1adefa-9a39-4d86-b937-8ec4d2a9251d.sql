
CREATE OR REPLACE FUNCTION public.is_client_assignee(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_assignees ca WHERE ca.client_id = _client_id AND ca.user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_property_assignee(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.property_assignees pa WHERE pa.property_id = _property_id AND pa.user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_access_client(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_manager_or_above()
    OR public.is_client_assignee(_client_id)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = _client_id AND (c.owner_id = auth.uid() OR c.assigned_to = auth.uid())
    )
$$;

CREATE OR REPLACE FUNCTION public.can_access_property(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_manager_or_above() OR public.is_agent()
    OR public.is_property_assignee(_property_id)
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = _property_id
        AND (
          p.owner_id = auth.uid()
          OR p.assigned_to = auth.uid()
          OR (p.owner_client_id IS NOT NULL AND public.can_access_client(p.owner_client_id))
        )
    )
$$;

DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
USING (is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid() OR public.is_client_assignee(id));

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
USING (is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid() OR public.is_client_assignee(id))
WITH CHECK (is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid() OR public.is_client_assignee(id));

DROP POLICY IF EXISTS properties_update ON public.properties;
CREATE POLICY properties_update ON public.properties FOR UPDATE TO authenticated
USING (is_manager_or_above() OR is_agent() OR owner_id = auth.uid() OR assigned_to = auth.uid() OR public.is_property_assignee(id))
WITH CHECK (is_manager_or_above() OR is_agent() OR owner_id = auth.uid() OR assigned_to = auth.uid() OR public.is_property_assignee(id));
