ALTER TABLE public.brand_settings ADD COLUMN IF NOT EXISTS login_title text NULL, ADD COLUMN IF NOT EXISTS login_subtitle text NULL;
ALTER TABLE public.tenant_domains ADD COLUMN IF NOT EXISTS activated_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.tenant_custom_domain_request(_domain text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := public.current_agency_id(); d text;
BEGIN
  IF a IS NULL OR NOT public.is_agency_owner_or_admin(a) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  d := lower(btrim(COALESCE(_domain,'')));
  d := regexp_replace(regexp_replace(regexp_replace(d, '^https?://', ''), '/.*$', ''), '\.$', '');
  IF d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' OR length(d) > 253 THEN
    RAISE EXCEPTION 'Ungültige Domain'; END IF;
  IF d = public.tenant_subdomain_root() OR d LIKE '%.' || public.tenant_subdomain_root()
     OR d ~ '(^|\.)(lovable\.app|lovable\.dev|lovableproject\.com|oaase\.com|immolia\.com)$' OR d = 'localhost' OR d LIKE '%.localhost' THEN
    RAISE EXCEPTION 'Diese Domain kann nicht verwendet werden'; END IF;
  IF EXISTS (SELECT 1 FROM tenant_domains WHERE lower(domain) = d AND agency_id <> a) THEN
    RAISE EXCEPTION 'Diese Domain ist bereits vergeben'; END IF;
  IF EXISTS (SELECT 1 FROM tenant_domains WHERE agency_id = a AND domain_type='custom' AND verification_status='verified') THEN
    RAISE EXCEPTION 'Eine verifizierte Domain kann nur durch den Support geändert werden'; END IF;
  DELETE FROM tenant_domains WHERE agency_id = a AND domain_type = 'custom';
  INSERT INTO tenant_domains(agency_id, domain, domain_type, is_primary, verification_status)
  VALUES (a, d, 'custom', false, 'pending');
END $$;

CREATE OR REPLACE FUNCTION public.tenant_custom_domain_remove()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := public.current_agency_id();
BEGIN
  IF a IS NULL OR NOT public.is_agency_owner_or_admin(a) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF EXISTS (SELECT 1 FROM tenant_domains WHERE agency_id = a AND domain_type='custom' AND verification_status='verified') THEN
    RAISE EXCEPTION 'Eine verifizierte Domain kann nur durch den Support entfernt werden'; END IF;
  DELETE FROM tenant_domains WHERE agency_id = a AND domain_type = 'custom';
END $$;

CREATE OR REPLACE FUNCTION public.tenant_custom_domain_activate()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := public.current_agency_id();
BEGIN
  IF a IS NULL OR NOT public.is_agency_owner_or_admin(a) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  UPDATE tenant_domains SET activated_at = now()
  WHERE agency_id = a AND domain_type='custom' AND verification_status='verified' AND activated_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aktivierung erst nach Verifikation möglich'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.tenant_custom_domain_request(text), public.tenant_custom_domain_remove(), public.tenant_custom_domain_activate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_custom_domain_request(text), public.tenant_custom_domain_remove(), public.tenant_custom_domain_activate() TO authenticated;

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
  WHERE lower(d.domain) = h AND d.verification_status = 'verified' LIMIT 1;
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
      'login_subtitle', b.login_subtitle
    )
    FROM public.agencies ag
    LEFT JOIN public.brand_settings b ON b.agency_id = ag.id
    LEFT JOIN public.company c ON c.agency_id = ag.id
    WHERE ag.id = a LIMIT 1);
END $$;
REVOKE ALL ON FUNCTION public.resolve_public_tenant_branding(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_branding(text) TO service_role;