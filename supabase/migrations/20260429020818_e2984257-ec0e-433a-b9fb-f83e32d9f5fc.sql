-- Phase 2: Checkliste + Bank-Einreichung

DO $$ BEGIN
  CREATE TYPE public.financing_checklist_status AS ENUM ('open', 'present', 'missing', 'not_relevant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.financing_checklist_section AS ENUM (
    'customer', 'financing_structure', 'property_docs', 'income_employment',
    'tax', 'self_employed', 'affordability', 'additional_check',
    'submission_quality', 'rejection_reasons'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financing_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.financing_dossiers(id) ON DELETE CASCADE,
  section public.financing_checklist_section NOT NULL,
  item_key text NOT NULL,
  label text NOT NULL,
  status public.financing_checklist_status NOT NULL DEFAULT 'open',
  is_present boolean NOT NULL DEFAULT false,
  note text,
  document_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, section, item_key)
);

CREATE INDEX IF NOT EXISTS idx_fci_dossier ON public.financing_checklist_items(dossier_id);
CREATE INDEX IF NOT EXISTS idx_fci_section ON public.financing_checklist_items(section);

ALTER TABLE public.financing_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY financing_checklist_items_authenticated_all
  ON public.financing_checklist_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY superadmin_all_financing_checklist_items
  ON public.financing_checklist_items
  FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE TRIGGER tg_fci_updated_at
  BEFORE UPDATE ON public.financing_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Bank-Einreichungsfelder
ALTER TABLE public.financing_dossiers
  ADD COLUMN IF NOT EXISTS bank_phone text,
  ADD COLUMN IF NOT EXISTS submitted_to_bank_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_notes text;
