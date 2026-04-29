ALTER TABLE public.financing_dossiers
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'existing_property',
  ADD COLUMN IF NOT EXISTS property_snapshot jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS existing_mortgage numeric,
  ADD COLUMN IF NOT EXISTS property_value numeric,
  ADD COLUMN IF NOT EXISTS land_price numeric,
  ADD COLUMN IF NOT EXISTS construction_costs numeric,
  ADD COLUMN IF NOT EXISTS construction_additional_costs numeric,
  ADD COLUMN IF NOT EXISTS current_bank text,
  ADD COLUMN IF NOT EXISTS interest_rate_expiry date,
  ADD COLUMN IF NOT EXISTS requested_increase numeric,
  ADD COLUMN IF NOT EXISTS new_total_mortgage numeric;