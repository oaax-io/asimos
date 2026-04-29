-- 1. Extend company table with full profile fields
ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS uid_number text,
  ADD COLUMN IF NOT EXISTS commercial_register text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS default_signatory_name text,
  ADD COLUMN IF NOT EXISTS default_signatory_role text,
  ADD COLUMN IF NOT EXISTS default_place text;

-- 2. Bank accounts
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  bank_name text,
  account_holder text,
  iban text,
  bic text,
  purpose text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_accounts_authenticated_all ON public.bank_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY superadmin_all_bank_accounts ON public.bank_accounts
  FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE TRIGGER bank_accounts_set_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. NDA agreements
CREATE TABLE IF NOT EXISTS public.nda_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  property_id uuid,
  nda_type text NOT NULL DEFAULT 'mutual',
  status text NOT NULL DEFAULT 'draft',
  valid_from date,
  valid_until date,
  notes text,
  generated_document_id uuid,
  template_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nda_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY nda_agreements_authenticated_all ON public.nda_agreements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY superadmin_all_nda_agreements ON public.nda_agreements
  FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE TRIGGER nda_agreements_set_updated_at
  BEFORE UPDATE ON public.nda_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_nda_client ON public.nda_agreements(client_id);
CREATE INDEX IF NOT EXISTS idx_nda_property ON public.nda_agreements(property_id);

-- 4. Extend document_templates
-- Add 'nda' to document_type enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'document_type' AND e.enumlabel = 'nda'
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'nda';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'document_type' AND e.enumlabel = 'reservation_receipt'
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'reservation_receipt';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'document_type' AND e.enumlabel = 'mandate_partial'
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'mandate_partial';
  END IF;
END $$;

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_variables jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 5. Extend generated_documents for e-sign + status
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS esign_provider text,
  ADD COLUMN IF NOT EXISTS esign_envelope_id text,
  ADD COLUMN IF NOT EXISTS esign_status text,
  ADD COLUMN IF NOT EXISTS esign_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS esign_url text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recipients jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_generated_documents_related
  ON public.generated_documents(related_type, related_id);
