ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS old_crm_id text,
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS raw_import jsonb;

CREATE INDEX IF NOT EXISTS idx_properties_old_crm_id ON public.properties(old_crm_id);
CREATE INDEX IF NOT EXISTS idx_properties_import_batch_id ON public.properties(import_batch_id);