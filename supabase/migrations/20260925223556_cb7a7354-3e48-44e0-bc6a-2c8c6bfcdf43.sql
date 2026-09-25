CREATE TABLE public.tenant_owner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','invited','accepted','cancelled')),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, email)
);
GRANT ALL ON public.tenant_owner_invitations TO service_role;
ALTER TABLE public.tenant_owner_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins read owner invitations" ON public.tenant_owner_invitations
  FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE TRIGGER tenant_owner_invitations_updated_at BEFORE UPDATE ON public.tenant_owner_invitations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.platform_check_subdomain(_slug text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s text := lower(btrim(coalesce(_slug,'')));
BEGIN
  PERFORM public.platform_assert_admin();
  IF length(s) < 2 OR length(s) > 40 OR s !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN RETURN 'invalid'; END IF;
  IF EXISTS (SELECT 1 FROM reserved_subdomains r WHERE r.name = s) THEN RETURN 'reserved'; END IF;
  IF EXISTS (SELECT 1 FROM agencies a WHERE a.slug = s) OR NOT public.tenant_subdomain_available(s) THEN RETURN 'taken'; END IF;
  RETURN 'available';
END $$;

CREATE OR REPLACE FUNCTION public.platform_check_owner_email(_email text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(btrim(coalesce(_email,''))));
END $$;

CREATE OR REPLACE FUNCTION public.platform_create_tenant(
  _name text, _slug text, _owner_first_name text, _owner_last_name text, _owner_email text, _modules text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  nm text := btrim(coalesce(_name,''));
  s text := lower(btrim(coalesce(_slug,'')));
  fn text := btrim(coalesce(_owner_first_name,''));
  ln text := btrim(coalesce(_owner_last_name,''));
  em text := lower(btrim(coalesce(_owner_email,'')));
  all_modules text[] := ARRAY['dashboard','leads','clients','properties','appointments','tasks','documents','employees','company_settings',
    'matching','exposes','reservations','mandates','ndas','financing','checklists','media','docs','analytics','feedback'];
  mods text[];
  chk text; ag uuid; dom text; owner_id uuid; owner_status text; m text; r app_role;
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
    INSERT INTO tenant_owner_invitations (agency_id, first_name, last_name, email, created_by)
    VALUES (ag, fn, ln, em, auth.uid());
    owner_status := 'pending_invitation';
  END IF;

  INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'tenant_created', 'agency', ag, nm, jsonb_build_object(
    'subdomain', dom, 'modules_count', coalesce(array_length(mods,1),0),
    'owner_user_exists', owner_id IS NOT NULL, 'owner_status', owner_status));

  RETURN jsonb_build_object('agency_id', ag, 'name', nm, 'domain', dom, 'owner_status', owner_status,
    'owner_user_exists', owner_id IS NOT NULL, 'modules', to_jsonb(mods));
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_owner_invitations(_agency_id uuid)
RETURNS TABLE(first_name text, last_name text, email text, status text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY SELECT i.first_name, i.last_name, i.email, i.status, i.created_at
  FROM tenant_owner_invitations i WHERE i.agency_id = _agency_id ORDER BY i.created_at;
END $$;

REVOKE ALL ON FUNCTION public.platform_check_subdomain(text), public.platform_check_owner_email(text),
  public.platform_create_tenant(text,text,text,text,text,text[]), public.platform_list_owner_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_check_subdomain(text), public.platform_check_owner_email(text),
  public.platform_create_tenant(text,text,text,text,text,text[]), public.platform_list_owner_invitations(uuid) TO authenticated, service_role;