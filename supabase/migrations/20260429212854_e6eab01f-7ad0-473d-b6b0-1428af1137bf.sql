-- Phase A: Multi-Module + Plausibilitaet (Felder)
ALTER TABLE public.financing_dossiers
  ADD COLUMN IF NOT EXISTS financing_modules text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS purchase_additional_costs numeric,
  ADD COLUMN IF NOT EXISTS renovation_description text,
  ADD COLUMN IF NOT EXISTS renovation_value_increase numeric,
  ADD COLUMN IF NOT EXISTS valuation_provider text,
  ADD COLUMN IF NOT EXISTS valuation_external_id text,
  ADD COLUMN IF NOT EXISTS valuation_result jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS valuation_status text,
  ADD COLUMN IF NOT EXISTS valuation_price_per_sqm numeric;

-- Backfill: bestehende Dossiers bekommen ihren financing_type als einziges Modul
UPDATE public.financing_dossiers
   SET financing_modules = ARRAY[financing_type::text]
 WHERE (financing_modules IS NULL OR array_length(financing_modules, 1) IS NULL)
   AND financing_type IS NOT NULL;