CREATE OR REPLACE FUNCTION public.agency_module_enabled_for(_agency_id uuid, _module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT am.is_entitled AND am.is_enabled FROM public.agency_modules am
                    WHERE am.agency_id = _agency_id AND am.module = _module), true);
$$;
REVOKE ALL ON FUNCTION public.agency_module_enabled_for(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_module_enabled_for(uuid, text) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('leads','leads'),('clients','clients'),('properties','properties'),('property_media','properties'),
    ('appointments','appointments'),('tasks','tasks'),('documents','documents'),('generated_documents','documents'),
    ('financing_dossiers','financing'),('hypo_calculations','financing'),('mandates','mandates'),
    ('reservations','reservations'),('nda_agreements','ndas'),('matches','matching'),('checklists','checklists')
  ) v(tbl, module) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'module_gate_' || r.module, r.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.agency_module_enabled_for(agency_id, %L)) WITH CHECK (public.agency_module_enabled_for(agency_id, %L))',
      'module_gate_' || r.module, r.tbl, r.module, r.module);
  END LOOP;
END $$;