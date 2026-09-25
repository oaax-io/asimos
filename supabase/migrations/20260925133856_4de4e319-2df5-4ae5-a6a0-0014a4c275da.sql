CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_domain_lower_uidx ON public.tenant_domains (lower(domain));

CREATE OR REPLACE FUNCTION public.resolve_public_tenant_branding(_hostname text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  h text;
  a uuid;
BEGIN
  -- Nur Darstellung: liefert niemals Zugriff, IDs oder CRM-Daten.
  IF _hostname IS NULL OR length(_hostname) > 253 THEN RETURN NULL; END IF;
  h := lower(btrim(_hostname));
  h := regexp_replace(h, ':\d+$', '');   -- Port entfernen
  h := regexp_replace(h, '\.$', '');     -- abschliessenden Punkt entfernen
  IF h !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN RETURN NULL; END IF;

  SELECT d.agency_id INTO a
  FROM public.tenant_domains d
  WHERE lower(d.domain) = h AND d.verification_status = 'verified'
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
      'accent_color', COALESCE(b.app_accent_color, b.accent_color)
    )
    FROM public.agencies ag
    LEFT JOIN public.brand_settings b ON b.agency_id = ag.id
    LEFT JOIN public.company c ON c.agency_id = ag.id
    WHERE ag.id = a
    LIMIT 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_public_tenant_branding(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_branding(text) TO anon, authenticated, service_role;