ALTER TABLE public.financing_dossiers
  ADD COLUMN IF NOT EXISTS usage_type text,
  ADD COLUMN IF NOT EXISTS refi_purpose text,
  ADD COLUMN IF NOT EXISTS monthly_obligations numeric,
  ADD COLUMN IF NOT EXISTS interest_rate_current numeric;