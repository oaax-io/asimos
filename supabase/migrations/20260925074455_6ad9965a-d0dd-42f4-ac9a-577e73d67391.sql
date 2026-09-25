-- 1. Plattformrollen-Struktur
ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS platform_role text NULL;
UPDATE public.platform_admins SET platform_role = CASE WHEN is_system_owner THEN 'system_owner' ELSE 'platform_admin' END WHERE platform_role IS NULL;
ALTER TABLE public.platform_admins ALTER COLUMN platform_role SET DEFAULT 'platform_admin';
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_role_chk CHECK (platform_role IN ('system_owner','platform_admin','platform_support'));

CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND platform_role IN ('system_owner','platform_admin'))
$$;
CREATE OR REPLACE FUNCTION public.is_system_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND platform_role = 'system_owner')
$$;
CREATE OR REPLACE FUNCTION public.platform_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT platform_role FROM public.platform_admins WHERE user_id = auth.uid()
$$;

-- Legacy-Name bleibt, prüft aber nur noch die Plattform-Struktur
CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin()
$$;

-- 2. Tenantrollen: superadmin zählt nicht mehr
CREATE OR REPLACE FUNCTION public.is_owner_or_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin'))
$$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','owner'))
$$;
CREATE OR REPLACE FUNCTION public.is_manager_or_above() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('manager','admin','owner'))
$$;
CREATE OR REPLACE FUNCTION public.is_commission_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','owner'))
$$;

-- Membership folgt Rollenänderungen im Team (nie superadmin)
CREATE OR REPLACE FUNCTION public.tg_sync_membership_from_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ag uuid;
BEGIN
  IF NEW.role = 'superadmin' THEN RETURN NEW; END IF;
  SELECT agency_id INTO _ag FROM public.profiles WHERE id = NEW.user_id;
  IF _ag IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.agency_memberships (agency_id, user_id, role) VALUES (_ag, NEW.user_id, NEW.role)
  ON CONFLICT (agency_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  RETURN NEW;
END $$;
CREATE TRIGGER user_roles_sync_membership AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.tg_sync_membership_from_role();

-- 3. Kein automatischer Tenant-Zugriff für Plattform-Admins
DROP POLICY IF EXISTS superadmin_all_appointments ON public.appointments;
DROP POLICY IF EXISTS superadmin_all_bank_accounts ON public.bank_accounts;
DROP POLICY IF EXISTS superadmin_all_client_children ON public.client_children;
DROP POLICY IF EXISTS superadmin_all_client_relationships ON public.client_relationships;
DROP POLICY IF EXISTS superadmin_all_client_roles ON public.client_roles;
DROP POLICY IF EXISTS superadmin_all_client_search_profiles ON public.client_search_profiles;
DROP POLICY IF EXISTS superadmin_all_client_self_disclosures ON public.client_self_disclosures;
DROP POLICY IF EXISTS superadmin_all_clients ON public.clients;
DROP POLICY IF EXISTS superadmin_all_financing_checklist_items ON public.financing_checklist_items;
DROP POLICY IF EXISTS superadmin_all_financing_dossiers ON public.financing_dossiers;
DROP POLICY IF EXISTS scenarios_superadmin_all ON public.financing_dossiers_scenarios;
DROP POLICY IF EXISTS superadmin_all_financing_links ON public.financing_links;
DROP POLICY IF EXISTS hypo_calc_superadmin ON public.hypo_calculations;
DROP POLICY IF EXISTS superadmin_all_leads ON public.leads;
DROP POLICY IF EXISTS superadmin_all_matches ON public.matches;
DROP POLICY IF EXISTS superadmin_all_nda_agreements ON public.nda_agreements;
DROP POLICY IF EXISTS superadmin_all_properties ON public.properties;
DROP POLICY IF EXISTS superadmin_all_property_ownerships ON public.property_ownerships;

-- Tenant-Policies: "OR is_superadmin()" entfernen
DO $$
DECLARE r record; q text; c text;
BEGIN
  FOR r IN SELECT tablename, policyname, qual, with_check FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('appointments','checklist_items','checklists','clients','documents','leads','mandates','properties','property_media','reservations','tasks','trash_items','livekit_settings')
      AND (qual ILIKE '%is_superadmin()%' OR with_check ILIKE '%is_superadmin()%')
  LOOP
    q := regexp_replace(regexp_replace(coalesce(r.qual,''), '\s*OR\s+is_superadmin\(\)', '', 'g'), 'is_superadmin\(\)\s+OR\s*', '', 'g');
    c := regexp_replace(regexp_replace(coalesce(r.with_check,''), '\s*OR\s+is_superadmin\(\)', '', 'g'), 'is_superadmin\(\)\s+OR\s*', '', 'g');
    IF q ILIKE '%is_superadmin%' OR c ILIKE '%is_superadmin%' THEN
      RAISE NOTICE 'Nicht automatisch angepasst: %.%', r.tablename, r.policyname; CONTINUE;
    END IF;
    IF r.qual IS NOT NULL THEN EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, q); END IF;
    IF r.with_check IS NOT NULL THEN EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, c); END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trash_restore(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _item public.trash_items%ROWTYPE;
  _allowed text[] := ARRAY['properties','clients','leads','tasks','appointments','documents','mandates','reservations','checklists','nda_agreements','financing_dossiers','property_media','generated_documents','client_financial_items','matches'];
BEGIN
  SELECT * INTO _item FROM public.trash_items WHERE id = _id;
  IF _item.id IS NULL THEN RAISE EXCEPTION 'Eintrag nicht gefunden'; END IF;
  IF _item.agency_id IS DISTINCT FROM public.current_agency_id() THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF NOT (_item.table_name = ANY(_allowed)) THEN RAISE EXCEPTION 'Wiederherstellung für % nicht unterstützt', _item.table_name; END IF;
  EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1) ON CONFLICT (id) DO NOTHING', _item.table_name, _item.table_name) USING _item.payload;
  DELETE FROM public.trash_items WHERE id = _id;
END $$;

-- Neue Benutzer: keine automatische Superadmin-/Admin-Tenantrolle mehr
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, 'employee'::public.app_role)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;