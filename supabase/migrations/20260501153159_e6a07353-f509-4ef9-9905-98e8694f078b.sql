CREATE TABLE public.client_search_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  role_type public.client_role_type NOT NULL DEFAULT 'buyer',
  listing_type public.listing_type,
  preferred_cities TEXT[],
  preferred_property_types public.property_type[],
  budget_min NUMERIC,
  budget_max NUMERIC,
  rooms_min NUMERIC,
  area_min NUMERIC,
  area_max NUMERIC,
  yield_target NUMERIC,
  usage_types TEXT[],
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_csp_client ON public.client_search_profiles(client_id);
CREATE INDEX idx_csp_role ON public.client_search_profiles(role_type);

ALTER TABLE public.client_search_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_search_profiles_authenticated_all
  ON public.client_search_profiles
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY superadmin_all_client_search_profiles
  ON public.client_search_profiles
  FOR ALL TO authenticated
  USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE TRIGGER trg_csp_updated_at
  BEFORE UPDATE ON public.client_search_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();