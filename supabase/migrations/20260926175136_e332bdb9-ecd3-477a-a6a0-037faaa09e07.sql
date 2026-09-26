CREATE OR REPLACE FUNCTION public.role_can(_agency_id uuid, _module text, _action text, _owner uuid DEFAULT NULL, _other uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND _agency_id IS NOT NULL
    AND _agency_id = public.current_agency_id()
    AND (
      public.is_agency_owner_or_admin(_agency_id)
      OR (_action = 'create' AND public.user_can(_module, 'create'))
      OR (_action = 'edit' AND (public.user_can(_module, 'edit_all')
            OR (public.user_can(_module, 'edit_own') AND auth.uid() IN (_owner, _other))))
    );
$$;
REVOKE ALL ON FUNCTION public.role_can(uuid, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_can(uuid, text, text, uuid, uuid) TO authenticated, service_role;

CREATE POLICY sec481_create ON public.leads AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'leads','create'));
CREATE POLICY sec481_create ON public.clients AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'clients','create'));
CREATE POLICY sec481_create ON public.properties AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'properties','create'));
CREATE POLICY sec481_create ON public.tasks AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'tasks','create'));
CREATE POLICY sec481_create ON public.appointments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'appointments','create'));
CREATE POLICY sec481_create ON public.documents AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'documents','create'));
CREATE POLICY sec481_create ON public.generated_documents AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'documents','create'));
CREATE POLICY sec481_create ON public.mandates AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'mandates','create'));
CREATE POLICY sec481_create ON public.reservations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'reservations','create'));
CREATE POLICY sec481_create ON public.nda_agreements AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'ndas','create'));
CREATE POLICY sec481_create ON public.matches AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'matching','create'));
CREATE POLICY sec481_create ON public.checklists AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'checklists','create'));
CREATE POLICY sec481_create ON public.property_media AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.role_can(agency_id,'media','create'));

CREATE POLICY sec481_edit ON public.leads AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.role_can(agency_id,'leads','edit',owner_id,assigned_to)) WITH CHECK (public.role_can(agency_id,'leads','edit',owner_id,assigned_to));
CREATE POLICY sec481_edit ON public.clients AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.role_can(agency_id,'clients','edit',owner_id,assigned_to)) WITH CHECK (public.role_can(agency_id,'clients','edit',owner_id,assigned_to));
CREATE POLICY sec481_edit ON public.properties AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.role_can(agency_id,'properties','edit',owner_id,assigned_to)) WITH CHECK (public.role_can(agency_id,'properties','edit',owner_id,assigned_to));
CREATE POLICY sec481_edit ON public.appointments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.role_can(agency_id,'appointments','edit',owner_id,assigned_to)) WITH CHECK (public.role_can(agency_id,'appointments','edit',owner_id,assigned_to));
CREATE POLICY sec481_edit ON public.tasks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.role_can(agency_id,'tasks','edit',created_by,assigned_to)) WITH CHECK (public.role_can(agency_id,'tasks','edit',created_by,assigned_to));
CREATE POLICY sec481_edit ON public.documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.role_can(agency_id,'documents','edit',uploaded_by)) WITH CHECK (public.role_can(agency_id,'documents','edit',uploaded_by));
CREATE POLICY sec481_edit ON public.nda_agreements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.role_can(agency_id,'ndas','edit',created_by)) WITH CHECK (public.role_can(agency_id,'ndas','edit',created_by));