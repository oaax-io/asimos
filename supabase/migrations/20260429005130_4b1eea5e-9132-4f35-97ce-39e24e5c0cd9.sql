-- Einheiten-Struktur (Mehrfamilienhaus -> Wohnungen)
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS parent_property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_unit boolean NOT NULL DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS unit_number text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS unit_type text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS unit_floor text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS unit_status text;

-- Gebäudetyp & Vermarktung
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS building_type text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS marketing_type text;

-- Erweiterte Flächen
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS usable_area numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS balcony_area numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS terrace_area numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS garden_area numeric;

-- Ausstattung
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS parking_spaces integer;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS cellar_available boolean;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS heating_type text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS energy_source text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS availability_date date;

-- Konditionen / intern
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS internal_minimum_price numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS reservation_amount_default numeric;

-- Index fuer Einheiten-Lookup
CREATE INDEX IF NOT EXISTS idx_properties_parent ON public.properties(parent_property_id) WHERE parent_property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_is_unit ON public.properties(is_unit) WHERE is_unit = true;