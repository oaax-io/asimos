ALTER TABLE public.commission_records
  ADD COLUMN IF NOT EXISTS sale_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS financing_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS financing_dossier_id uuid REFERENCES public.financing_dossiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;