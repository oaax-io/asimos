-- Phase 1: Finanzierungsmodul - Datenmodell erweitern

-- Neue Enum-Typen
DO $$ BEGIN
  CREATE TYPE public.financing_type AS ENUM (
    'purchase', 'renovation', 'increase', 'refinance', 'new_build', 'mortgage_increase'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.financing_quick_check_status AS ENUM (
    'realistic', 'critical', 'not_financeable', 'incomplete'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.financing_dossier_status AS ENUM (
    'draft', 'quick_check', 'documents_missing', 'ready_for_bank',
    'submitted_to_bank', 'approved', 'rejected', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Spalten zu financing_dossiers hinzufügen
ALTER TABLE public.financing_dossiers
  ADD COLUMN IF NOT EXISTS financing_type public.financing_type DEFAULT 'purchase',
  ADD COLUMN IF NOT EXISTS property_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS purchase_price numeric,
  ADD COLUMN IF NOT EXISTS renovation_costs numeric,
  ADD COLUMN IF NOT EXISTS total_investment numeric,
  ADD COLUMN IF NOT EXISTS requested_mortgage numeric,
  ADD COLUMN IF NOT EXISTS own_funds_total numeric,
  ADD COLUMN IF NOT EXISTS own_funds_liquid numeric,
  ADD COLUMN IF NOT EXISTS own_funds_pillar_3a numeric,
  ADD COLUMN IF NOT EXISTS own_funds_pension_fund numeric,
  ADD COLUMN IF NOT EXISTS own_funds_vested_benefits numeric,
  ADD COLUMN IF NOT EXISTS own_funds_gift numeric,
  ADD COLUMN IF NOT EXISTS own_funds_inheritance numeric,
  ADD COLUMN IF NOT EXISTS own_funds_private_loan numeric,
  ADD COLUMN IF NOT EXISTS loan_to_value_ratio numeric,
  ADD COLUMN IF NOT EXISTS gross_income_yearly numeric,
  ADD COLUMN IF NOT EXISTS calculated_interest_rate numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ancillary_costs_yearly numeric,
  ADD COLUMN IF NOT EXISTS amortisation_yearly numeric,
  ADD COLUMN IF NOT EXISTS affordability_ratio numeric,
  ADD COLUMN IF NOT EXISTS quick_check_status public.financing_quick_check_status,
  ADD COLUMN IF NOT EXISTS quick_check_reasons jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dossier_status public.financing_dossier_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS bank_type text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_contact text,
  ADD COLUMN IF NOT EXISTS bank_email text,
  ADD COLUMN IF NOT EXISTS internal_notes text;

CREATE INDEX IF NOT EXISTS idx_fin_dossiers_client ON public.financing_dossiers(client_id);
CREATE INDEX IF NOT EXISTS idx_fin_dossiers_property ON public.financing_dossiers(property_id);
CREATE INDEX IF NOT EXISTS idx_fin_dossiers_status ON public.financing_dossiers(dossier_status);
