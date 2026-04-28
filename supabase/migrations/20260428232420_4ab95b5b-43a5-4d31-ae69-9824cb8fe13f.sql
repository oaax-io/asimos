-- =========================================================
-- Selbstauskunft (ASIMO) – Erweiterung Kundenmodul
-- =========================================================

-- 1) Beziehungen zwischen Kunden
CREATE TYPE public.client_relationship_type AS ENUM (
  'spouse',          -- Ehepartner
  'co_applicant',    -- Mitantragsteller
  'co_investor',     -- Mitinvestor
  'other'            -- sonstige Verbindung
);

CREATE TABLE public.client_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  related_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  relationship_type public.client_relationship_type NOT NULL DEFAULT 'other',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_relationships_no_self CHECK (client_id <> related_client_id),
  CONSTRAINT client_relationships_unique UNIQUE (client_id, related_client_id, relationship_type)
);

CREATE INDEX idx_client_relationships_client ON public.client_relationships(client_id);
CREATE INDEX idx_client_relationships_related ON public.client_relationships(related_client_id);

ALTER TABLE public.client_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_relationships_authenticated_all"
  ON public.client_relationships FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "superadmin_all_client_relationships"
  ON public.client_relationships FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- 2) Kinder
CREATE TABLE public.client_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name text,
  birth_date date,
  gender text,
  is_shared_child boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_children_client ON public.client_children(client_id);

ALTER TABLE public.client_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_children_authenticated_all"
  ON public.client_children FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "superadmin_all_client_children"
  ON public.client_children FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- 3) Selbstauskunft (eine Tabelle pro Kunde, 1:1)
CREATE TABLE public.client_self_disclosures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  advisor_id uuid,

  -- Erfassungs-Metadaten
  disclosure_date date,
  disclosure_place text,

  -- Stammdaten (ergänzend zu clients)
  salutation text,
  title text,
  first_name text,
  last_name text,
  birth_name text,
  street text,
  street_number text,
  postal_code text,
  city text,
  country text DEFAULT 'CH',
  resident_since date,
  phone text,
  mobile text,
  email text,
  birth_date date,
  nationality text,
  birth_place text,
  birth_country text,
  marital_status text,
  tax_id_ch text,

  -- Beruf
  employment_status text,
  employer_name text,
  employer_address text,
  employer_phone text,
  employed_as text,
  employed_since date,

  -- Einnahmen (CHF / Monat soweit nicht anders deklariert)
  salary_net_monthly numeric(12,2),
  salary_type text,                 -- Fixum / Provision
  additional_income numeric(12,2),
  income_job_two numeric(12,2),
  income_rental numeric(12,2),
  annual_net_salary numeric(12,2),
  total_income_monthly numeric(12,2),

  -- Ausgaben monatlich
  mortgage_expense numeric(12,2),
  rent_expense numeric(12,2),
  leasing_expense numeric(12,2),
  credit_expense numeric(12,2),
  life_insurance_expense numeric(12,2),
  alimony_expense numeric(12,2),
  health_insurance_expense numeric(12,2),
  property_insurance_expense numeric(12,2),
  utilities_expense numeric(12,2),
  telecom_expense numeric(12,2),
  living_costs_expense numeric(12,2),
  taxes_expense numeric(12,2),
  miscellaneous_expense numeric(12,2),
  total_expenses_monthly numeric(12,2),

  -- Reserve & Benchmark
  reserve_total numeric(12,2),
  reserve_ratio numeric(5,2),       -- Prozent
  benchmark_status text,            -- strong / solid / tight / critical

  internal_notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_self_disclosures_client ON public.client_self_disclosures(client_id);

ALTER TABLE public.client_self_disclosures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_self_disclosures_authenticated_all"
  ON public.client_self_disclosures FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "superadmin_all_client_self_disclosures"
  ON public.client_self_disclosures FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- updated_at Trigger
CREATE TRIGGER tg_client_self_disclosures_updated_at
  BEFORE UPDATE ON public.client_self_disclosures
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
