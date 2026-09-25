CREATE OR REPLACE FUNCTION public.user_can(_module text, _action text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE has_perm boolean := false;
BEGIN
  -- Ebene 1+2+3: Firma aktiv (current_agency_id), Modul freigeschaltet und aktiviert
  IF public.current_agency_id() IS NULL THEN RETURN false; END IF;
  IF NOT public.agency_module_enabled(_module) THEN RETURN false; END IF;
  -- Inhaber: volle Rechte innerhalb freigeschalteter Module
  IF EXISTS (SELECT 1 FROM public.agency_memberships m WHERE m.user_id = auth.uid() AND m.is_active
             AND m.agency_id = public.current_agency_id() AND m.role = 'owner') THEN
    RETURN _action IN ('view','create','edit_own','edit_all','delete');
  END IF;
  -- Ebene 4: Rollenrecht
  SELECT CASE _action
    WHEN 'view' THEN bool_or(mp.can_view)
    WHEN 'create' THEN bool_or(mp.can_create)
    WHEN 'edit_own' THEN bool_or(mp.can_edit_own)
    WHEN 'edit_all' THEN bool_or(mp.can_edit_all)
    WHEN 'delete' THEN bool_or(mp.can_delete)
    ELSE false END
  INTO has_perm
  FROM public.module_permissions mp
  JOIN public.agency_memberships m ON m.role = mp.role
  WHERE m.user_id = auth.uid() AND m.is_active AND m.agency_id = public.current_agency_id()
    AND mp.agency_id = m.agency_id AND mp.module = _module;
  RETURN COALESCE(has_perm, false);
END $function$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('leads','leads'),('clients','clients'),('properties','properties'),('property_media','properties'),
    ('appointments','appointments'),('tasks','tasks'),('documents','documents'),('generated_documents','documents'),
    ('financing_dossiers','financing'),('hypo_calculations','financing'),('mandates','mandates'),
    ('reservations','reservations'),('nda_agreements','ndas'),('matches','matching'),('checklists','checklists')
  ) v(tbl, module) LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.agency_module_enabled(%L))) WITH CHECK ((SELECT public.agency_module_enabled(%L)))',
      'module_gate_' || r.module, r.tbl, r.module, r.module);
  END LOOP;
END $$;

COMMENT ON TABLE public.agency_modules IS 'Produktzugriff: is_entitled (Plattform) + is_enabled (Firma). Gesperrte Module werden per RESTRICTIVE-Policy module_gate_* serverseitig blockiert.';
COMMENT ON TABLE public.module_permissions IS 'Rollenrechte INNERHALB eines verfügbaren Moduls. Kann ein gesperrtes Modul nie öffnen. Inhaber (owner) hat keine Zeilen und volle Rechte in freigeschalteten Modulen.';