
-- Helper: client access for current user
CREATE OR REPLACE FUNCTION public.can_access_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_manager_or_above() OR EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND (c.owner_id = auth.uid() OR c.assigned_to = auth.uid())
  )
$$;

-- Drop overly permissive policies
DROP POLICY IF EXISTS leads_authenticated_all ON public.leads;
DROP POLICY IF EXISTS properties_authenticated_all ON public.properties;
DROP POLICY IF EXISTS clients_authenticated_all ON public.clients;
DROP POLICY IF EXISTS financing_dossiers_authenticated_all ON public.financing_dossiers;
DROP POLICY IF EXISTS financing_links_authenticated_all ON public.financing_links;
DROP POLICY IF EXISTS financing_profiles_authenticated_all ON public.financing_profiles;
DROP POLICY IF EXISTS financing_checklist_items_authenticated_all ON public.financing_checklist_items;
DROP POLICY IF EXISTS scenarios_authenticated_all ON public.financing_dossiers_scenarios;

-- LEADS
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated
  USING (public.is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY leads_insert ON public.leads FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_manager_or_above());
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated
  USING (public.is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid())
  WITH CHECK (public.is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY leads_delete ON public.leads FOR DELETE TO authenticated
  USING (public.is_manager_or_above() OR owner_id = auth.uid());

-- PROPERTIES
CREATE POLICY properties_select ON public.properties FOR SELECT TO authenticated
  USING (public.is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY properties_insert ON public.properties FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_manager_or_above());
CREATE POLICY properties_update ON public.properties FOR UPDATE TO authenticated
  USING (public.is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid())
  WITH CHECK (public.is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY properties_delete ON public.properties FOR DELETE TO authenticated
  USING (public.is_manager_or_above() OR owner_id = auth.uid());

-- CLIENTS
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
  USING (public.is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_manager_or_above());
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
  USING (public.is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid())
  WITH CHECK (public.is_manager_or_above() OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated
  USING (public.is_manager_or_above() OR owner_id = auth.uid());

-- FINANCING DOSSIERS (scoped via client)
CREATE POLICY financing_dossiers_rw ON public.financing_dossiers FOR ALL TO authenticated
  USING (public.can_access_client(client_id))
  WITH CHECK (public.can_access_client(client_id));

-- FINANCING LINKS
CREATE POLICY financing_links_rw ON public.financing_links FOR ALL TO authenticated
  USING (public.is_manager_or_above() OR public.can_access_client(client_id))
  WITH CHECK (public.is_manager_or_above() OR public.can_access_client(client_id));

-- FINANCING PROFILES
CREATE POLICY financing_profiles_rw ON public.financing_profiles FOR ALL TO authenticated
  USING (public.can_access_client(client_id))
  WITH CHECK (public.can_access_client(client_id));

-- FINANCING CHECKLIST ITEMS (scoped via dossier -> client)
CREATE POLICY financing_checklist_items_rw ON public.financing_checklist_items FOR ALL TO authenticated
  USING (
    public.is_manager_or_above() OR EXISTS (
      SELECT 1 FROM public.financing_dossiers d
      WHERE d.id = dossier_id AND public.can_access_client(d.client_id)
    )
  )
  WITH CHECK (
    public.is_manager_or_above() OR EXISTS (
      SELECT 1 FROM public.financing_dossiers d
      WHERE d.id = dossier_id AND public.can_access_client(d.client_id)
    )
  );

-- FINANCING SCENARIOS
CREATE POLICY scenarios_rw ON public.financing_dossiers_scenarios FOR ALL TO authenticated
  USING (
    public.is_manager_or_above() OR EXISTS (
      SELECT 1 FROM public.financing_dossiers d
      WHERE d.id = dossier_id AND public.can_access_client(d.client_id)
    )
  )
  WITH CHECK (
    public.is_manager_or_above() OR EXISTS (
      SELECT 1 FROM public.financing_dossiers d
      WHERE d.id = dossier_id AND public.can_access_client(d.client_id)
    )
  );
