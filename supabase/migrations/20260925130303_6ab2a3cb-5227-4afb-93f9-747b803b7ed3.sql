ALTER TABLE public.brand_settings
  ADD COLUMN IF NOT EXISTS app_primary_color text NULL,
  ADD COLUMN IF NOT EXISTS app_secondary_color text NULL,
  ADD COLUMN IF NOT EXISTS app_accent_color text NULL;

UPDATE public.brand_settings
SET app_primary_color = COALESCE(app_primary_color, '#6B6994'),
    app_secondary_color = COALESCE(app_secondary_color, '#434242')
WHERE agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224';

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
    'app_primary_color', b.app_primary_color,
    'app_secondary_color', b.app_secondary_color,
    'app_accent_color', b.app_accent_color,
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