CREATE OR REPLACE FUNCTION public.platform_create_tenant(_name text, _slug text, _owner_first_name text, _owner_last_name text, _owner_email text, _modules text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nm text := btrim(coalesce(_name,''));
  s text := lower(btrim(coalesce(_slug,'')));
  fn text := btrim(coalesce(_owner_first_name,''));
  ln text := btrim(coalesce(_owner_last_name,''));
  em text := lower(btrim(coalesce(_owner_email,'')));
  all_modules text[] := ARRAY['dashboard','leads','clients','properties','appointments','tasks','documents','employees','company_settings',
    'matching','exposes','reservations','mandates','ndas','financing','checklists','media','docs','analytics','feedback'];
  mods text[];
  inv_id uuid; inv_token text; chk text; ag uuid; dom text; owner_id uuid; owner_status text; m text; r app_role;
BEGIN
  PERFORM public.platform_assert_admin();
  IF nm = '' OR length(nm) > 120 THEN RAISE EXCEPTION 'invalid_name' USING ERRCODE='22023'; END IF;
  IF fn = '' OR ln = '' OR length(fn) > 80 OR length(ln) > 80 THEN RAISE EXCEPTION 'invalid_owner' USING ERRCODE='22023'; END IF;
  IF em !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' OR length(em) > 254 THEN RAISE EXCEPTION 'invalid_email' USING ERRCODE='22023'; END IF;
  chk := public.platform_check_subdomain(s);
  IF chk <> 'available' THEN RAISE EXCEPTION 'slug_%', chk USING ERRCODE='22023'; END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO mods FROM unnest(coalesce(_modules,'{}')) x WHERE x = ANY(all_modules);

  INSERT INTO agencies (name, slug, status) VALUES (nm, s, 'active') RETURNING id INTO ag;
  dom := s || '.' || public.tenant_subdomain_root();
  INSERT INTO tenant_domains (agency_id, domain, domain_type, is_primary, verification_status, verified_at)
  VALUES (ag, dom, 'subdomain', true, 'verified', now());
  INSERT INTO company (agency_id, name, country) VALUES (ag, nm, 'CH');
  INSERT INTO brand_settings (agency_id, company_name) VALUES (ag, nm);

  FOREACH m IN ARRAY all_modules LOOP
    INSERT INTO agency_modules (agency_id, module, is_entitled, is_enabled)
    VALUES (ag, m, m = ANY(mods), m = ANY(mods));
    FOREACH r IN ARRAY ARRAY['admin','manager','agent','assistant','employee']::app_role[] LOOP
      INSERT INTO module_permissions (agency_id, module, role, can_view, can_create, can_edit_own, can_edit_all, can_delete)
      VALUES (ag, m, r,
        true,
        r IN ('admin','manager','agent','assistant'),
        r IN ('admin','manager','agent','assistant'),
        r IN ('admin','manager'),
        r = 'admin');
    END LOOP;
  END LOOP;

  SELECT u.id INTO owner_id FROM auth.users u WHERE lower(u.email) = em LIMIT 1;
  IF owner_id IS NOT NULL THEN
    INSERT INTO agency_memberships (agency_id, user_id, role, is_active) VALUES (ag, owner_id, 'owner', true);
    owner_status := 'active';
  ELSE
    SELECT i.invitation_id, i.token INTO inv_id, inv_token
      FROM public._invitation_issue('tenant_owner', em, ag, 'owner'::app_role, NULL, fn, ln) i;
    owner_status := 'pending_invitation';
  END IF;

  INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'tenant_created', 'agency', ag, nm, jsonb_build_object(
    'subdomain', dom, 'modules_count', coalesce(array_length(mods,1),0),
    'owner_user_exists', owner_id IS NOT NULL, 'owner_status', owner_status, 'invitation_id', inv_id));

  RETURN jsonb_build_object('agency_id', ag, 'name', nm, 'domain', dom, 'owner_status', owner_status,
    'owner_user_exists', owner_id IS NOT NULL, 'modules', to_jsonb(mods), 'invitation_token', inv_token);
END $function$;