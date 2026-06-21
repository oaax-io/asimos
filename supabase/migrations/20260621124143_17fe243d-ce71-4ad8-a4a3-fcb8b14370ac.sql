ALTER TABLE public.financing_dossiers
  ADD COLUMN IF NOT EXISTS existing_mortgage_2 NUMERIC,
  ADD COLUMN IF NOT EXISTS interest_rate_current_2 NUMERIC,
  ADD COLUMN IF NOT EXISTS interest_rate_expiry_2 DATE;