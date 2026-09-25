CREATE OR REPLACE FUNCTION public.tenant_branding_of(_agency uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'agency_id', _agency,
    'company_name', COALESCE(b.company_name, c.name),
    'logo_url', COALESCE(b.logo_url, c.logo_url),
    'logo_alt_url', b.logo_alt_url,
    'primary_color', b.primary_color,
    'secondary_color', b.secondary_color,
    'accent_color', b.accent_color,
    'favicon_url', b.favicon_url,
    'font_family', b.font_family,
    'company_email', COALESCE(b.company_email, c.email),
    'company_website', COALESCE(b.company_website, c.website),
    'company_address', b.company_address,
    'company', CASE WHEN c.row_id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', c.name, 'legal_name', c.legal_name, 'address', c.address,
      'postal_code', c.postal_code, 'city', c.city, 'country', c.country,
      'phone', c.phone, 'email', c.email, 'website', c.website, 'logo_url', c.logo_url) END)
  FROM (SELECT _agency AS a) x
  LEFT JOIN public.brand_settings b ON b.agency_id = x.a
  LEFT JOIN public.company c ON c.agency_id = x.a
  WHERE _agency IS NOT NULL
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.tenant_branding_of(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_tenant_config() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := public.current_agency_id();
BEGIN
  IF a IS NULL OR NOT public.is_agency_member(a) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'agency_id', a,
    'agency_name', (SELECT name FROM public.agencies WHERE id = a),
    'branding', public.tenant_branding_of(a),
    'modules', COALESCE((SELECT jsonb_object_agg(module, is_entitled AND is_enabled) FROM public.agency_modules WHERE agency_id = a), '{}'::jsonb),
    'module_states', COALESCE((SELECT jsonb_object_agg(module, jsonb_build_object('unlocked', is_entitled, 'enabled', is_enabled)) FROM public.agency_modules WHERE agency_id = a), '{}'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.get_tenant_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_config() TO authenticated;