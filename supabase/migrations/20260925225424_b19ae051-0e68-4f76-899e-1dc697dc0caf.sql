
CREATE OR REPLACE FUNCTION public.platform_domain_audit(_action text, _d public.tenant_domains, _actor uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (_actor, _action, 'domain', _d.id, _d.domain, jsonb_build_object(
    'domain', _d.domain, 'domain_type', _d.domain_type, 'agency_id', _d.agency_id, 'verification_status', _d.verification_status));
$$;
REVOKE ALL ON FUNCTION public.platform_domain_audit(text, public.tenant_domains, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_domain_audit(text, public.tenant_domains, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_domain_center(_agency_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, agency_id uuid, agency_name text, agency_status text, domain text, domain_type text, is_primary boolean,
  verification_status text, verified_at timestamptz, activated_at timestamptz, created_at timestamptz,
  verification_checked_at timestamptz, verification_error text, has_branding boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY
  SELECT d.id, d.agency_id, a.name, coalesce(a.status,'active'), d.domain, d.domain_type, d.is_primary,
    d.verification_status, d.verified_at, d.activated_at, d.created_at, d.verification_checked_at, d.verification_error,
    EXISTS (SELECT 1 FROM brand_settings b WHERE b.agency_id = d.agency_id
      AND (b.logo_url IS NOT NULL OR b.favicon_url IS NOT NULL OR b.app_primary_color IS NOT NULL OR b.primary_color IS NOT NULL))
  FROM tenant_domains d JOIN agencies a ON a.id = d.agency_id
  WHERE _agency_id IS NULL OR d.agency_id = _agency_id
  ORDER BY a.name, d.domain_type DESC, d.domain;
END $$;

CREATE OR REPLACE FUNCTION public.platform_domain_dns_record(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d tenant_domains;
BEGIN
  PERFORM public.platform_assert_admin();
  SELECT * INTO d FROM tenant_domains WHERE id = _id;
  IF NOT FOUND OR d.domain_type <> 'custom' THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('type','TXT','name','_immolia-verify.' || d.domain,'value', d.verification_token);
END $$;

CREATE OR REPLACE FUNCTION public.platform_add_custom_domain(_agency_id uuid, _domain text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d text; bare text; r tenant_domains;
BEGIN
  PERFORM public.platform_assert_admin();
  IF NOT EXISTS (SELECT 1 FROM agencies WHERE id = _agency_id) THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  d := lower(btrim(COALESCE(_domain,'')));
  d := regexp_replace(regexp_replace(regexp_replace(regexp_replace(d, '^https?://', ''), '[/?#].*$', ''), ':\d+$', ''), '\.$', '');
  IF d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' OR length(d) > 253 THEN
    RAISE EXCEPTION 'invalid_domain' USING ERRCODE='22023'; END IF;
  IF d = public.tenant_subdomain_root() OR d LIKE '%.' || public.tenant_subdomain_root()
     OR d ~ '(^|\.)(lovable\.app|lovable\.dev|lovableproject\.com|oaase\.com|immolia\.com)$' OR d LIKE '%.localhost' THEN
    RAISE EXCEPTION 'blocked_domain' USING ERRCODE='22023'; END IF;
  bare := regexp_replace(d, '^www\.', '');
  IF EXISTS (SELECT 1 FROM tenant_domains WHERE regexp_replace(lower(domain), '^www\.', '') = bare) THEN
    RAISE EXCEPTION 'duplicate_domain' USING ERRCODE='23505'; END IF;
  IF EXISTS (SELECT 1 FROM tenant_domains WHERE agency_id = _agency_id AND domain_type = 'custom') THEN
    RAISE EXCEPTION 'custom_exists' USING ERRCODE='23505'; END IF;
  INSERT INTO tenant_domains(agency_id, domain, domain_type, is_primary, verification_status, verification_token)
  VALUES (_agency_id, d, 'custom', false, 'pending',
    'immolia-verify=' || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''))
  RETURNING * INTO r;
  PERFORM public.platform_domain_audit('domain_added', r, auth.uid());
  RETURN r.id;
END $$;

CREATE OR REPLACE FUNCTION public.platform_set_domain_active(_id uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tenant_domains;
BEGIN
  PERFORM public.platform_assert_admin();
  SELECT * INTO r FROM tenant_domains WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF r.domain_type <> 'custom' THEN RAISE EXCEPTION 'only_custom' USING ERRCODE='22023'; END IF;
  IF _active THEN
    IF r.verification_status <> 'verified' THEN RAISE EXCEPTION 'not_verified' USING ERRCODE='22023'; END IF;
    IF r.activated_at IS NOT NULL THEN RETURN; END IF;
    UPDATE tenant_domains SET activated_at = now() WHERE id = _id RETURNING * INTO r;
    PERFORM public.platform_domain_audit('domain_activated', r, auth.uid());
  ELSE
    IF r.activated_at IS NULL THEN RETURN; END IF;
    IF r.is_primary THEN RAISE EXCEPTION 'is_primary' USING ERRCODE='22023'; END IF;
    UPDATE tenant_domains SET activated_at = NULL WHERE id = _id RETURNING * INTO r;
    PERFORM public.platform_domain_audit('domain_deactivated', r, auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.platform_set_primary_domain(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tenant_domains;
BEGIN
  PERFORM public.platform_assert_admin();
  SELECT * INTO r FROM tenant_domains WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF r.is_primary THEN RETURN; END IF;
  IF r.verification_status <> 'verified' OR (r.domain_type = 'custom' AND r.activated_at IS NULL) THEN
    RAISE EXCEPTION 'not_usable' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM tenant_domains WHERE agency_id = r.agency_id FOR UPDATE;
  UPDATE tenant_domains SET is_primary = false WHERE agency_id = r.agency_id AND is_primary;
  UPDATE tenant_domains SET is_primary = true WHERE id = _id RETURNING * INTO r;
  PERFORM public.platform_domain_audit('domain_primary_changed', r, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.platform_remove_domain(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tenant_domains;
BEGIN
  PERFORM public.platform_assert_admin();
  SELECT * INTO r FROM tenant_domains WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF r.domain_type <> 'custom' THEN RAISE EXCEPTION 'only_custom' USING ERRCODE='22023'; END IF;
  IF r.is_primary THEN RAISE EXCEPTION 'is_primary' USING ERRCODE='22023'; END IF;
  DELETE FROM tenant_domains WHERE id = _id;
  PERFORM public.platform_domain_audit('domain_removed', r, auth.uid());
END $$;

-- Nur vom Server (Service-Role) nach echter DNS-Abfrage aufrufbar.
CREATE OR REPLACE FUNCTION public.platform_domain_record_check(_actor uuid, _id uuid, _ok boolean, _error text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tenant_domains;
BEGIN
  SELECT * INTO r FROM tenant_domains WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR r.domain_type <> 'custom' THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF r.verification_status = 'verified' THEN RETURN 'verified'; END IF;
  PERFORM public.tenant_domain_record_check(_id, _ok, _error);
  SELECT * INTO r FROM tenant_domains WHERE id = _id;
  IF _ok THEN PERFORM public.platform_domain_audit('domain_verified', r, _actor); END IF;
  RETURN r.verification_status;
END $$;

REVOKE ALL ON FUNCTION public.platform_domain_center(uuid), public.platform_domain_dns_record(uuid),
  public.platform_add_custom_domain(uuid, text), public.platform_set_domain_active(uuid, boolean),
  public.platform_set_primary_domain(uuid), public.platform_remove_domain(uuid),
  public.platform_domain_record_check(uuid, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_domain_center(uuid), public.platform_domain_dns_record(uuid),
  public.platform_add_custom_domain(uuid, text), public.platform_set_domain_active(uuid, boolean),
  public.platform_set_primary_domain(uuid), public.platform_remove_domain(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.platform_domain_record_check(uuid, uuid, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.platform_domain_record_check(uuid, uuid, boolean, text) TO service_role;
