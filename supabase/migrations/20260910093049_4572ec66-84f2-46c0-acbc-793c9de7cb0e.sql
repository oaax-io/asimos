ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS s_number text NULL,
  ADD COLUMN IF NOT EXISTS land_register_no text NULL,
  ADD COLUMN IF NOT EXISTS parcel_no text NULL,
  ADD COLUMN IF NOT EXISTS e_grid text NULL,
  ADD COLUMN IF NOT EXISTS egid text NULL,
  ADD COLUMN IF NOT EXISTS ewid text NULL,
  ADD COLUMN IF NOT EXISTS zone text NULL,
  ADD COLUMN IF NOT EXISTS room_height numeric NULL,
  ADD COLUMN IF NOT EXISTS separate_wc_count integer NULL,
  ADD COLUMN IF NOT EXISTS unit_count_residential integer NULL,
  ADD COLUMN IF NOT EXISTS unit_count_commercial integer NULL,
  ADD COLUMN IF NOT EXISTS building_count integer NULL,
  ADD COLUMN IF NOT EXISTS development_status text NULL,
  ADD COLUMN IF NOT EXISTS utilization_ratio numeric NULL,
  ADD COLUMN IF NOT EXISTS building_volume_ratio numeric NULL,
  ADD COLUMN IF NOT EXISTS hall_height numeric NULL,
  ADD COLUMN IF NOT EXISTS usage_types text[] NULL,
  ADD COLUMN IF NOT EXISTS gross_living_area numeric NULL,
  ADD COLUMN IF NOT EXISTS loggia_area numeric NULL,
  ADD COLUMN IF NOT EXISTS gross_floor_area numeric NULL,
  ADD COLUMN IF NOT EXISTS exterior_construction_area numeric NULL,
  ADD COLUMN IF NOT EXISTS building_volume numeric NULL,
  ADD COLUMN IF NOT EXISTS sia_416_area numeric NULL,
  ADD COLUMN IF NOT EXISTS value_quota numeric NULL,
  ADD COLUMN IF NOT EXISTS cellar_area numeric NULL,
  ADD COLUMN IF NOT EXISTS ancillary_costs_monthly numeric NULL,
  ADD COLUMN IF NOT EXISTS price_from numeric NULL,
  ADD COLUMN IF NOT EXISTS price_to numeric NULL,
  ADD COLUMN IF NOT EXISTS vat_status text NULL,
  ADD COLUMN IF NOT EXISTS sale_procedure text NULL,
  ADD COLUMN IF NOT EXISTS deal_type text NULL,
  ADD COLUMN IF NOT EXISTS sale_process_start date NULL,
  ADD COLUMN IF NOT EXISTS sale_process_end date NULL,
  ADD COLUMN IF NOT EXISTS rent_target numeric NULL,
  ADD COLUMN IF NOT EXISTS rent_actual numeric NULL,
  ADD COLUMN IF NOT EXISTS occupancy_rate numeric NULL,
  ADD COLUMN IF NOT EXISTS occupancy_rate_date date NULL,
  ADD COLUMN IF NOT EXISTS gross_yield numeric NULL,
  ADD COLUMN IF NOT EXISTS net_yield numeric NULL,
  ADD COLUMN IF NOT EXISTS owner_costs_yearly numeric NULL,
  ADD COLUMN IF NOT EXISTS land_price numeric NULL,
  ADD COLUMN IF NOT EXISTS building_insurance_value numeric NULL,
  ADD COLUMN IF NOT EXISTS official_tax_value numeric NULL,
  ADD COLUMN IF NOT EXISTS renovation_fund numeric NULL,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS deposit_date date NULL,
  ADD COLUMN IF NOT EXISTS energy_efficiency_envelope text NULL,
  ADD COLUMN IF NOT EXISTS energy_efficiency_overall text NULL,
  ADD COLUMN IF NOT EXISTS minergie_standard text NULL;

CREATE TABLE IF NOT EXISTS public.property_feature_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label_de text NOT NULL,
  category text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.property_feature_options TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.property_feature_options TO authenticated;
GRANT ALL ON public.property_feature_options TO service_role;

ALTER TABLE public.property_feature_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_options_select" ON public.property_feature_options
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "feature_options_insert" ON public.property_feature_options
  FOR INSERT TO authenticated WITH CHECK (public.is_owner_or_admin() OR public.is_superadmin());
CREATE POLICY "feature_options_update" ON public.property_feature_options
  FOR UPDATE TO authenticated USING (public.is_owner_or_admin() OR public.is_superadmin())
  WITH CHECK (public.is_owner_or_admin() OR public.is_superadmin());
CREATE POLICY "feature_options_delete" ON public.property_feature_options
  FOR DELETE TO authenticated USING (public.is_owner_or_admin() OR public.is_superadmin());

CREATE TRIGGER property_feature_options_set_updated_at
  BEFORE UPDATE ON public.property_feature_options
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.property_feature_options (key, label_de, sort_order) VALUES
  ('auslaenderkontingent','Ausländerkontingent',10),
  ('haustiere_erlaubt','Haustiere erlaubt',20),
  ('projektiert','Projektiert',30),
  ('balkon','Balkon',40),
  ('hochparterre','Hochparterre',50),
  ('rollstuhlgaengig','Rollstuhlgängig',60),
  ('bauland_erschlossen','Bauland erschlossen',70),
  ('im_baurecht','Im Baurecht',80),
  ('ruhig','Ruhig',90),
  ('bergsicht','Bergsicht',100),
  ('in_wohngemeinschaft','In Wohngemeinschaft',110),
  ('seesicht','Seesicht',120),
  ('carport','Carport',130),
  ('kabelfernsehen','Kabelfernsehen',140),
  ('sommerlaube','Sommerlaube',150),
  ('cheminee','Cheminée',160),
  ('kachelofen','Kachelofen',170),
  ('sonnig','Sonnig',180),
  ('doppelgarage','Doppelgarage',190),
  ('kinderfreundlich','Kinderfreundlich',200),
  ('suedhang','Südhang',210),
  ('eckhaus','Eckhaus',220),
  ('ladestation_elektroauto','Ladestation für Elektroauto',230),
  ('swimmingpool','Swimmingpool',240),
  ('erdgeschoss','Erdgeschoss',250),
  ('lift','Lift',260),
  ('tumbler','Tumbler',270),
  ('erstwohnsitz','Erstwohnsitz',280),
  ('mietkautionsgarantie','Mietkautionsgarantie',290),
  ('virtuelle_besichtigung','Virtuelle Besichtigung',300),
  ('garage','Garage',310),
  ('multimediale_verkabelung','Multimediale Verkabelung',320),
  ('waschmaschine','Waschmaschine',330),
  ('gasanschluss','Gasanschluss',340),
  ('nichtraucher','Nichtraucher',350),
  ('zweitwohnsitz','Zweitwohnsitz',360),
  ('hanglage','Hanglage',370),
  ('parkplatz','Parkplatz',380),
  ('zwischennutzung','Zwischennutzung',390)
ON CONFLICT (key) DO NOTHING;