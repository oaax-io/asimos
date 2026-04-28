-- ============================================================================
-- ASIMOS: Single-company mode — remove agency-based multi-tenancy
-- ============================================================================
-- Goal: drop agency-based RLS so authenticated users can use the CRM without
-- depending on current_agency_id(). Keep agency_id columns (nullable) for
-- backward compatibility with the /oaax superadmin center.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop all RLS policies that depend on current_agency_id()
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS appointments_all_same_agency        ON public.appointments;
DROP POLICY IF EXISTS clients_all_same_agency             ON public.clients;
DROP POLICY IF EXISTS leads_all_same_agency               ON public.leads;
DROP POLICY IF EXISTS matches_all_same_agency             ON public.matches;
DROP POLICY IF EXISTS properties_all_same_agency          ON public.properties;
DROP POLICY IF EXISTS financing_dossiers_all_same_agency  ON public.financing_dossiers;
DROP POLICY IF EXISTS financing_links_all_same_agency     ON public.financing_links;
DROP POLICY IF EXISTS profiles_select_same_agency         ON public.profiles;
DROP POLICY IF EXISTS agency_select_own                   ON public.agencies;
DROP POLICY IF EXISTS agency_update_own                   ON public.agencies;

-- ---------------------------------------------------------------------------
-- 2. Make agency_id nullable everywhere (so inserts no longer require it)
--    and drop the current_agency_id() default.
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointments        ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE public.appointments        ALTER COLUMN agency_id DROP DEFAULT;

ALTER TABLE public.clients             ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE public.clients             ALTER COLUMN agency_id DROP DEFAULT;

ALTER TABLE public.leads               ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE public.leads               ALTER COLUMN agency_id DROP DEFAULT;

ALTER TABLE public.matches             ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE public.matches             ALTER COLUMN agency_id DROP DEFAULT;

ALTER TABLE public.properties          ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE public.properties          ALTER COLUMN agency_id DROP DEFAULT;

ALTER TABLE public.financing_dossiers  ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE public.financing_dossiers  ALTER COLUMN agency_id DROP DEFAULT;

ALTER TABLE public.financing_links     ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE public.financing_links     ALTER COLUMN agency_id DROP DEFAULT;

ALTER TABLE public.profiles            ALTER COLUMN agency_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. New simple RLS — any authenticated user can read/write CRM data
-- ---------------------------------------------------------------------------
CREATE POLICY appointments_authenticated_all ON public.appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY clients_authenticated_all ON public.clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY leads_authenticated_all ON public.leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY matches_authenticated_all ON public.matches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY properties_authenticated_all ON public.properties
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY financing_dossiers_authenticated_all ON public.financing_dossiers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY financing_links_authenticated_all ON public.financing_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Profiles: every authenticated user can read all profiles (single company)
CREATE POLICY profiles_select_all_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Owner/admin can manage any profile (employee management)
-- (profiles_owner_admin_manage already exists from previous setup,
--  profiles_update_self & profiles_insert_self also still in place,
--  superadmin_all_profiles still in place)

-- Agencies: keep the table for the oaax admin center; superadmins manage it,
-- regular authenticated users can read it (used only by /oaax UI).
CREATE POLICY agencies_select_authenticated ON public.agencies
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. Replace handle_new_user trigger — single-company, no agency creation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'employee'::public.app_role
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF LOWER(NEW.email) = 'bilel.chagra@oaase.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END
$function$;

-- Re-attach trigger (safe-recreate)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
