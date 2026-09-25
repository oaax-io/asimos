ALTER TABLE public.tenant_domains
  ADD COLUMN IF NOT EXISTS verification_token text NULL,
  ADD COLUMN IF NOT EXISTS verification_checked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verification_error text NULL;

CREATE OR REPLACE FUNCTION public.tenant_custom_domain_request(_domain text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := public.current_agency_id(); d text; bare text;
BEGIN
  IF a IS NULL OR NOT public.is_agency_owner_or_admin(a) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  d := lower(btrim(COALESCE(_domain,'')));
  d := regexp_replace(regexp_replace(regexp_replace(regexp_replace(d, '^https?://', ''), '[/?#].*$', ''), ':\d+$', ''), '\.$', '');
  IF d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' OR length(d) > 253 THEN
    RAISE EXCEPTION 'Ungültige Domain'; END IF;
  IF d = public.tenant_subdomain_root() OR d LIKE '%.' || public.tenant_subdomain_root()
     OR d ~ '(^|\.)(lovable\.app|lovable\.dev|lovableproject\.com|oaase\.com|immolia\.com)$' OR d LIKE '%.localhost' THEN
    RAISE EXCEPTION 'Diese Domain kann nicht verwendet werden'; END IF;
  bare := regexp_replace(d, '^www\.', '');
  IF EXISTS (SELECT 1 FROM tenant_domains WHERE agency_id <> a
             AND regexp_replace(lower(domain), '^www\.', '') = bare) THEN
    RAISE EXCEPTION 'Diese Domain ist bereits vergeben'; END IF;
  IF EXISTS (SELECT 1 FROM tenant_domains WHERE agency_id = a AND domain_type='custom' AND verification_status='verified') THEN
    RAISE EXCEPTION 'Eine verifizierte Domain kann nur durch den Support geändert werden'; END IF;
  DELETE FROM tenant_domains WHERE agency_id = a AND domain_type = 'custom';
  INSERT INTO tenant_domains(agency_id, domain, domain_type, is_primary, verification_status, verification_token)
  VALUES (a, d, 'custom', false, 'pending',
          'immolia-verify=' || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''));
END $$;

-- Nur der Server (nach echter DNS-Prüfung) setzt den Prüfstatus.
CREATE OR REPLACE FUNCTION public.tenant_domain_record_check(_id uuid, _ok boolean, _error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE tenant_domains SET
    verification_status = CASE WHEN _ok THEN 'verified' ELSE 'failed' END,
    verified_at = CASE WHEN _ok THEN now() ELSE NULL END,
    verification_checked_at = now(),
    verification_error = CASE WHEN _ok THEN NULL ELSE left(_error, 300) END
  WHERE id = _id AND domain_type = 'custom' AND verification_status <> 'verified';
END $$;
REVOKE ALL ON FUNCTION public.tenant_domain_record_check(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_domain_record_check(uuid, boolean, text) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_public_tenant_branding(_hostname text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE h text; a uuid;
BEGIN
  IF _hostname IS NULL OR length(_hostname) > 253 THEN RETURN NULL; END IF;
  h := lower(btrim(_hostname));
  h := regexp_replace(h, ':\d+$', '');
  h := regexp_replace(h, '\.$', '');
  IF h !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN RETURN NULL; END IF;
  SELECT d.agency_id INTO a FROM public.tenant_domains d
  WHERE lower(d.domain) = h AND d.verification_status = 'verified'
    AND (d.domain_type = 'subdomain' OR d.activated_at IS NOT NULL)
  LIMIT 1;
  IF a IS NULL THEN RETURN NULL; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'company_name', COALESCE(NULLIF(b.company_name,''), c.name, ag.name),
      'logo_url', COALESCE(b.logo_url, c.logo_url),
      'logo_alt_url', b.logo_alt_url,
      'favicon_url', b.favicon_url,
      'primary_color', COALESCE(b.app_primary_color, b.primary_color),
      'secondary_color', COALESCE(b.app_secondary_color, b.secondary_color),
      'accent_color', COALESCE(b.app_accent_color, b.accent_color),
      'login_title', b.login_title,
      'login_subtitle', b.login_subtitle)
    FROM public.agencies ag
    LEFT JOIN public.brand_settings b ON b.agency_id = ag.id
    LEFT JOIN public.company c ON c.agency_id = ag.id
    WHERE ag.id = a LIMIT 1);
END $$;
REVOKE ALL ON FUNCTION public.resolve_public_tenant_branding(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_branding(text) TO service_role;