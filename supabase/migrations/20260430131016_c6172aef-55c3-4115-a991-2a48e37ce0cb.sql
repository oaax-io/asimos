
-- 1. brand_settings table
CREATE TABLE IF NOT EXISTS public.brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  company_address text,
  company_email text,
  company_website text,
  logo_url text,
  primary_color text DEFAULT '#324642',
  secondary_color text DEFAULT '#6A9387',
  font_family text DEFAULT 'Helvetica Neue, Arial, sans-serif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_settings_read_authenticated"
  ON public.brand_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "brand_settings_admin_write"
  ON public.brand_settings FOR ALL
  TO authenticated
  USING (public.is_owner_or_admin())
  WITH CHECK (public.is_owner_or_admin());

CREATE TRIGGER brand_settings_set_updated_at
  BEFORE UPDATE ON public.brand_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Public storage bucket for brand assets (logo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "brand_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'brand-assets');
