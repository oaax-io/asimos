
-- =====================================================
-- 1) PROFILES: Neue Felder ergänzen
-- =====================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_role public.user_role NOT NULL DEFAULT 'agent';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Bestehenden ersten Eintrag zum Owner machen
UPDATE public.profiles SET user_role = 'owner'
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
  AND user_role = 'agent';

-- =====================================================
-- 2) LEADS: Neue Felder ergänzen
-- =====================================================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS interest_type text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget_min numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget_max numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS preferred_location text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS converted_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Migration: owner_id -> assigned_to (best-effort backfill)
UPDATE public.leads SET assigned_to = owner_id WHERE assigned_to IS NULL AND owner_id IS NOT NULL;

-- =====================================================
-- 3) CLIENTS: Neue Felder ergänzen
-- =====================================================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS country text DEFAULT 'DE';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS equity numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS financing_status text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_locations text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_property_types public.property_type[];

UPDATE public.clients SET assigned_to = owner_id WHERE assigned_to IS NULL AND owner_id IS NOT NULL;
-- Bestehende preferred_cities/preferred_types in neue Spalten kopieren
UPDATE public.clients SET preferred_locations = preferred_cities WHERE preferred_locations IS NULL AND preferred_cities IS NOT NULL;
UPDATE public.clients SET preferred_property_types = preferred_types WHERE preferred_property_types IS NULL AND preferred_types IS NOT NULL;

-- =====================================================
-- 4) PROPERTIES: Neue Felder ergänzen
-- =====================================================
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rent numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS living_area numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS renovated_at integer;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS floor integer;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS total_floors integer;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS internal_notes text;

UPDATE public.properties SET assigned_to = owner_id WHERE assigned_to IS NULL AND owner_id IS NOT NULL;
UPDATE public.properties SET owner_client_id = seller_client_id WHERE owner_client_id IS NULL AND seller_client_id IS NOT NULL;
UPDATE public.properties SET living_area = area WHERE living_area IS NULL AND area IS NOT NULL;

-- =====================================================
-- 5) APPOINTMENTS: Neue Felder ergänzen
-- =====================================================
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
UPDATE public.appointments SET assigned_to = owner_id WHERE assigned_to IS NULL AND owner_id IS NOT NULL;

-- =====================================================
-- 6) MATCHES: reasons jsonb
-- =====================================================
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS reasons jsonb;

-- =====================================================
-- 7) PROPERTY_MEDIA
-- =====================================================
CREATE TABLE IF NOT EXISTS public.property_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  file_type text,
  title text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 8) DOCUMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_type text NOT NULL,
  related_id uuid NOT NULL,
  document_type public.document_type NOT NULL DEFAULT 'other',
  file_url text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 9) TASKS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  due_date timestamptz,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_type text,
  related_id uuid,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 10) FINANCING_PROFILES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  budget numeric,
  equity numeric,
  income numeric,
  bank_name text,
  bank_contact text,
  approval_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 11) CHECKLISTS + ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  related_type text,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_done boolean NOT NULL DEFAULT false,
  due_date timestamptz,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 12) DOCUMENT_TEMPLATES (vor mandates/reservations wegen FK)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.document_type NOT NULL DEFAULT 'other',
  content text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 13) GENERATED_DOCUMENTS (vor mandates/reservations wegen FK)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  related_type text,
  related_id uuid,
  file_url text,
  html_content text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 14) MANDATES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  status public.mandate_status NOT NULL DEFAULT 'draft',
  template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  generated_document_id uuid REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  commission_model text,
  commission_value numeric,
  valid_from date,
  valid_until date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 15) RESERVATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  status public.reservation_status NOT NULL DEFAULT 'draft',
  reservation_fee numeric,
  valid_until date,
  generated_document_id uuid REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 16) ACTIVITY_LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  related_type text,
  related_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- HELFER: Owner/Admin Check (basierend auf profiles.user_role)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND user_role IN ('owner','admin')
      AND is_active = true
  )
$$;

-- =====================================================
-- RLS aktivieren
-- =====================================================
ALTER TABLE public.property_media       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs        ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS-Policies: authentifizierte Mitarbeiter dürfen Firmen-Daten lesen+schreiben
-- =====================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'property_media','documents','tasks','financing_profiles',
    'checklists','checklist_items','generated_documents',
    'mandates','reservations'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_authenticated_all ON public.%I', t, t);
    EXECUTE format($p$
      CREATE POLICY %I_authenticated_all ON public.%I
        FOR ALL TO authenticated
        USING (true) WITH CHECK (true)
    $p$, t, t);
  END LOOP;
END $$;

-- document_templates: lesen alle, schreiben nur owner/admin
DROP POLICY IF EXISTS document_templates_read ON public.document_templates;
CREATE POLICY document_templates_read
  ON public.document_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS document_templates_write ON public.document_templates;
CREATE POLICY document_templates_write
  ON public.document_templates FOR ALL TO authenticated
  USING (public.is_owner_or_admin()) WITH CHECK (public.is_owner_or_admin());

-- activity_logs: lesen alle, schreiben jeder authentifizierte (für eigene Aktionen), löschen nur admin
DROP POLICY IF EXISTS activity_logs_read ON public.activity_logs;
CREATE POLICY activity_logs_read
  ON public.activity_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS activity_logs_insert ON public.activity_logs;
CREATE POLICY activity_logs_insert
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.is_owner_or_admin());

DROP POLICY IF EXISTS activity_logs_admin_delete ON public.activity_logs;
CREATE POLICY activity_logs_admin_delete
  ON public.activity_logs FOR DELETE TO authenticated
  USING (public.is_owner_or_admin());

-- profiles: zusätzlich owner/admin-Schreibrechte für Mitarbeiterverwaltung
DROP POLICY IF EXISTS profiles_owner_admin_manage ON public.profiles;
CREATE POLICY profiles_owner_admin_manage
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_owner_or_admin()) WITH CHECK (public.is_owner_or_admin());

-- =====================================================
-- updated_at Triggers
-- =====================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tasks','financing_profiles','document_templates','mandates','reservations'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format($p$
      CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at()
    $p$, t);
  END LOOP;
END $$;

-- =====================================================
-- INDIZES
-- =====================================================
-- leads
CREATE INDEX IF NOT EXISTS idx_leads_status         ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to    ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at     ON public.leads(created_at DESC);

-- clients
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to  ON public.clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_client_type  ON public.clients(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_created_at   ON public.clients(created_at DESC);

-- properties
CREATE INDEX IF NOT EXISTS idx_properties_status         ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_assigned_to    ON public.properties(assigned_to);
CREATE INDEX IF NOT EXISTS idx_properties_owner_client   ON public.properties(owner_client_id);
CREATE INDEX IF NOT EXISTS idx_properties_created_at     ON public.properties(created_at DESC);

-- property_media
CREATE INDEX IF NOT EXISTS idx_property_media_property   ON public.property_media(property_id);

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_related         ON public.documents(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type   ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by     ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_created_at      ON public.documents(created_at DESC);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_status              ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to         ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date            ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_related             ON public.tasks(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority            ON public.tasks(priority);

-- appointments
CREATE INDEX IF NOT EXISTS idx_appointments_status       ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to  ON public.appointments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_client       ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_property     ON public.appointments(property_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at    ON public.appointments(starts_at);

-- financing_profiles
CREATE INDEX IF NOT EXISTS idx_financing_profiles_client ON public.financing_profiles(client_id);

-- checklists / items
CREATE INDEX IF NOT EXISTS idx_checklists_related        ON public.checklists(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON public.checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_assigned  ON public.checklist_items(assigned_to);

-- mandates
CREATE INDEX IF NOT EXISTS idx_mandates_status           ON public.mandates(status);
CREATE INDEX IF NOT EXISTS idx_mandates_property         ON public.mandates(property_id);
CREATE INDEX IF NOT EXISTS idx_mandates_client           ON public.mandates(client_id);

-- reservations
CREATE INDEX IF NOT EXISTS idx_reservations_status       ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_property     ON public.reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_client       ON public.reservations(client_id);

-- generated_documents
CREATE INDEX IF NOT EXISTS idx_generated_documents_related ON public.generated_documents(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_template ON public.generated_documents(template_id);

-- matches
CREATE INDEX IF NOT EXISTS idx_matches_status            ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_client            ON public.matches(client_id);
CREATE INDEX IF NOT EXISTS idx_matches_property          ON public.matches(property_id);

-- activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor       ON public.activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_related     ON public.activity_logs(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at  ON public.activity_logs(created_at DESC);
