
CREATE TABLE public.bank_package_shares (
  token text PRIMARY KEY,
  dossier_id uuid NOT NULL,
  storage_path text NOT NULL,
  client_name text,
  package_title text,
  size_bytes bigint,
  attachment_count int,
  expires_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bank_package_shares TO authenticated;
GRANT ALL ON public.bank_package_shares TO service_role;
ALTER TABLE public.bank_package_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shares_insert_auth" ON public.bank_package_shares FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shares_select_auth" ON public.bank_package_shares FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.bank_package_share_resolve(_token text)
RETURNS TABLE(
  status text,
  client_name text,
  package_title text,
  size_bytes bigint,
  attachment_count int,
  expires_at timestamptz,
  company_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  company_email text,
  company_website text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.bank_package_shares%ROWTYPE;
  b public.brand_settings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.brand_settings ORDER BY updated_at DESC LIMIT 1;
  SELECT * INTO r FROM public.bank_package_shares WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::bigint, NULL::int, NULL::timestamptz,
      b.company_name, b.logo_url, b.primary_color, b.secondary_color, b.company_email, b.company_website;
    RETURN;
  END IF;
  IF r.expires_at < now() THEN
    RETURN QUERY SELECT 'expired'::text, r.client_name, r.package_title, r.size_bytes, r.attachment_count, r.expires_at,
      b.company_name, b.logo_url, b.primary_color, b.secondary_color, b.company_email, b.company_website;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'ok'::text, r.client_name, r.package_title, r.size_bytes, r.attachment_count, r.expires_at,
    b.company_name, b.logo_url, b.primary_color, b.secondary_color, b.company_email, b.company_website;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bank_package_share_resolve(text) TO anon, authenticated;
