
-- Zentrale DB-Spiegelung der Module Registry (Quelle im Code: MODULE_REGISTRY)
CREATE OR REPLACE FUNCTION public.platform_module_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY['dashboard','leads','clients','properties','appointments','tasks','documents','employees','company_settings',
    'matching','exposes','reservations','mandates','ndas','financing','checklists','media','docs','analytics','feedback']::text[];
$$;
CREATE OR REPLACE FUNCTION public.platform_core_module_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT ARRAY['dashboard']::text[]; $$;
GRANT EXECUTE ON FUNCTION public.platform_module_keys(), public.platform_core_module_keys() TO authenticated, service_role;

-- Guard: Browser-Rollen dürfen is_entitled nie ändern; Plattform-RPC (SECURITY DEFINER) schon.
CREATE OR REPLACE FUNCTION public.tg_agency_modules_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.is_entitled IS DISTINCT FROM OLD.is_entitled OR NEW.agency_id IS DISTINCT FROM OLD.agency_id OR NEW.module IS DISTINCT FROM OLD.module THEN
      RAISE EXCEPTION 'Modul-Freischaltung kann nur durch die Plattform geändert werden';
    END IF;
    IF NEW.is_enabled AND NOT NEW.is_entitled THEN
      RAISE EXCEPTION 'Modul ist für diese Firma nicht freigeschaltet';
    END IF;
    IF NOT NEW.is_enabled AND NEW.module = ANY(public.platform_core_module_keys()) THEN
      RAISE EXCEPTION 'Kernmodul kann nicht ausgeschaltet werden';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;

-- Default-deny: fehlender Eintrag = nicht verfügbar (alle bestehenden Firmen haben 20 Einträge).
CREATE OR REPLACE FUNCTION public.agency_module_enabled(_module text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT COALESCE((SELECT am.is_entitled AND am.is_enabled FROM public.agency_modules am
                    WHERE am.agency_id = public.current_agency_id() AND am.module = _module), false);
$function$;
CREATE OR REPLACE FUNCTION public.agency_module_enabled_for(_agency_id uuid, _module text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT COALESCE((SELECT am.is_entitled AND am.is_enabled FROM public.agency_modules am
                    WHERE am.agency_id = _agency_id AND am.module = _module), false);
$function$;

CREATE OR REPLACE FUNCTION public.platform_set_module_entitlement(_agency_id uuid, _module text, _entitled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev boolean; nm text; is_core boolean;
BEGIN
  PERFORM public.platform_assert_admin();
  SELECT name INTO nm FROM agencies WHERE id = _agency_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF _module IS NULL OR NOT (_module = ANY(public.platform_module_keys())) THEN RAISE EXCEPTION 'invalid_module' USING ERRCODE='22023'; END IF;
  is_core := _module = ANY(public.platform_core_module_keys());
  IF is_core AND NOT _entitled THEN RAISE EXCEPTION 'core_module' USING ERRCODE='22023'; END IF;
  SELECT is_entitled INTO prev FROM agency_modules WHERE agency_id = _agency_id AND module = _module FOR UPDATE;
  IF FOUND AND prev = _entitled THEN RETURN; END IF;
  IF FOUND THEN
    UPDATE agency_modules SET is_entitled = _entitled, is_enabled = CASE WHEN is_core THEN true ELSE is_enabled END
    WHERE agency_id = _agency_id AND module = _module;
  ELSE
    prev := false;
    INSERT INTO agency_modules(agency_id, module, is_entitled, is_enabled) VALUES (_agency_id, _module, _entitled, is_core);
  END IF;
  INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), CASE WHEN _entitled THEN 'module_entitled' ELSE 'module_revoked' END, 'module', _agency_id, nm,
    jsonb_build_object('agency_id', _agency_id, 'module', _module, 'previous_entitled', prev, 'new_entitled', _entitled));
END $$;
REVOKE ALL ON FUNCTION public.platform_set_module_entitlement(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_set_module_entitlement(uuid, text, boolean) TO authenticated, service_role;

-- Zusätzliche Modul-Sperren (ergänzend, RESTRICTIVE)
CREATE POLICY module_gate_financing_links ON public.financing_links AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.agency_module_enabled_for(agency_id, 'financing')) WITH CHECK (public.agency_module_enabled_for(agency_id, 'financing'));
CREATE POLICY module_gate_mandate_commission_splits ON public.mandate_commission_splits AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.agency_module_enabled_for(agency_id, 'mandates')) WITH CHECK (public.agency_module_enabled_for(agency_id, 'mandates'));
CREATE POLICY module_gate_property_market_analyses ON public.property_market_analyses AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.agency_module_enabled_for(agency_id, 'properties')) WITH CHECK (public.agency_module_enabled_for(agency_id, 'properties'));
CREATE POLICY module_gate_checklist_templates ON public.checklist_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING (agency_id IS NULL OR public.agency_module_enabled_for(agency_id, 'checklists'))
  WITH CHECK (agency_id IS NULL OR public.agency_module_enabled_for(agency_id, 'checklists'));
