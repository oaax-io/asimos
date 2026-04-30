ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'person',
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS contact_first_name text,
  ADD COLUMN IF NOT EXISTS contact_last_name text,
  ADD COLUMN IF NOT EXISTS secondary_email text,
  ADD COLUMN IF NOT EXISTS phone_direct text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS old_crm_id text,
  ADD COLUMN IF NOT EXISTS old_crm_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS old_crm_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid;

-- Validation: entity_type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_entity_type_chk') THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_entity_type_chk CHECK (entity_type IN ('person','company'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_import_batch_idx ON public.leads (import_batch_id);
CREATE INDEX IF NOT EXISTS leads_old_crm_id_idx ON public.leads (old_crm_id);
CREATE INDEX IF NOT EXISTS leads_email_lower_idx ON public.leads (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS leads_import_source_old_id_uniq
  ON public.leads (import_source, old_crm_id)
  WHERE import_source IS NOT NULL AND old_crm_id IS NOT NULL;