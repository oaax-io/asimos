
-- ========== 1. Tenant role helpers ==========
CREATE OR REPLACE FUNCTION public.has_agency_role(_agency_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _agency_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.agency_memberships m
    WHERE m.user_id = auth.uid() AND m.agency_id = _agency_id AND m.is_active AND m.role = ANY(_roles));
$$;
CREATE OR REPLACE FUNCTION public.is_agency_manager(_agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_agency_role(_agency_id, ARRAY['manager','admin','owner']::public.app_role[]);
$$;
CREATE OR REPLACE FUNCTION public.is_agency_commission_admin(_agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_agency_role(_agency_id, ARRAY['owner','admin']::public.app_role[]);
$$;
CREATE OR REPLACE FUNCTION public.is_user_agency_member(_user_id uuid, _agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.agency_memberships m
    WHERE m.user_id = _user_id AND m.agency_id = _agency_id AND m.is_active);
$$;
CREATE OR REPLACE FUNCTION public.single_agency_of(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(m.agency_id))[1] END
  FROM public.agency_memberships m WHERE m.user_id = _user_id AND m.is_active;
$$;

-- Legacy helper names: now scoped to the caller's current agency membership
CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_agency_owner_or_admin(public.current_agency_id());
$$;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_agency_owner_or_admin(public.current_agency_id());
$$;
CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_agency_manager(public.current_agency_id());
$$;
CREATE OR REPLACE FUNCTION public.is_commission_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_agency_commission_admin(public.current_agency_id());
$$;
CREATE OR REPLACE FUNCTION public.is_agent()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_agency_role(public.current_agency_id(), ARRAY['agent']::public.app_role[]);
$$;
CREATE OR REPLACE FUNCTION public.user_can(_module text, _action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE has_perm boolean := false;
BEGIN
  SELECT CASE _action
    WHEN 'view' THEN bool_or(mp.can_view)
    WHEN 'create' THEN bool_or(mp.can_create)
    WHEN 'edit_own' THEN bool_or(mp.can_edit_own)
    WHEN 'edit_all' THEN bool_or(mp.can_edit_all)
    WHEN 'delete' THEN bool_or(mp.can_delete)
    ELSE false END
  INTO has_perm
  FROM public.module_permissions mp
  JOIN public.agency_memberships m ON m.role = mp.role
  WHERE m.user_id = auth.uid() AND m.is_active AND m.agency_id = public.current_agency_id()
    AND mp.module = _module;
  RETURN COALESCE(has_perm, false);
END $function$;

-- ========== 2. agency_id columns ==========
ALTER TABLE public.property_media ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.mandates ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.property_ownerships ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.generated_documents ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.nda_agreements ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.property_market_analyses ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.commission_record_splits ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.mandate_commission_splits ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.commission_targets ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);
ALTER TABLE public.hypo_calculations ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id);

-- ========== 3. Parent resolver + guard trigger ==========
CREATE OR REPLACE FUNCTION public.tenant_parent_agencies(j jsonb)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid[] := '{}'; a uuid; rt text := j->>'related_type'; rid uuid;
BEGIN
  IF nullif(j->>'property_id','') IS NOT NULL THEN a := NULL; SELECT agency_id INTO a FROM properties WHERE id = (j->>'property_id')::uuid; r := r || a; END IF;
  IF nullif(j->>'client_id','') IS NOT NULL THEN a := NULL; SELECT agency_id INTO a FROM clients WHERE id = (j->>'client_id')::uuid; r := r || a; END IF;
  IF nullif(j->>'lead_id','') IS NOT NULL THEN a := NULL; SELECT agency_id INTO a FROM leads WHERE id = (j->>'lead_id')::uuid; r := r || a; END IF;
  IF nullif(j->>'mandate_id','') IS NOT NULL THEN a := NULL; SELECT agency_id INTO a FROM mandates WHERE id = (j->>'mandate_id')::uuid; r := r || a; END IF;
  IF nullif(j->>'reservation_id','') IS NOT NULL THEN a := NULL; SELECT agency_id INTO a FROM reservations WHERE id = (j->>'reservation_id')::uuid; r := r || a; END IF;
  IF nullif(j->>'commission_record_id','') IS NOT NULL THEN a := NULL; SELECT agency_id INTO a FROM commission_records WHERE id = (j->>'commission_record_id')::uuid; r := r || a; END IF;
  IF nullif(j->>'dossier_id','') IS NOT NULL THEN a := NULL; SELECT agency_id INTO a FROM financing_dossiers WHERE id = (j->>'dossier_id')::uuid; r := r || a; END IF;
  IF rt IS NOT NULL AND nullif(j->>'related_id','') IS NOT NULL THEN
    rid := (j->>'related_id')::uuid; a := NULL;
    CASE rt
      WHEN 'property' THEN SELECT agency_id INTO a FROM properties WHERE id = rid;
      WHEN 'client' THEN SELECT agency_id INTO a FROM clients WHERE id = rid;
      WHEN 'lead' THEN SELECT agency_id INTO a FROM leads WHERE id = rid;
      WHEN 'mandate' THEN SELECT agency_id INTO a FROM mandates WHERE id = rid;
      WHEN 'reservation' THEN SELECT agency_id INTO a FROM reservations WHERE id = rid;
      WHEN 'nda' THEN SELECT agency_id INTO a FROM nda_agreements WHERE id = rid;
      WHEN 'financing' THEN SELECT agency_id INTO a FROM financing_dossiers WHERE id = rid;
      WHEN 'financing_dossier' THEN SELECT agency_id INTO a FROM financing_dossiers WHERE id = rid;
      ELSE a := NULL;
    END CASE;
    r := r || a;
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.tg_tenant_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE j jsonb := to_jsonb(NEW); jo jsonb; n int; derived uuid; ucol text; uid uuid;
BEGIN
  SELECT count(DISTINCT x), (array_agg(x) FILTER (WHERE x IS NOT NULL))[1]
    INTO n, derived FROM unnest(public.tenant_parent_agencies(j)) x WHERE x IS NOT NULL;
  IF n > 1 THEN
    RAISE EXCEPTION 'Verknüpfung über Firmengrenzen ist nicht erlaubt' USING ERRCODE = '42501';
  END IF;
  IF NEW.agency_id IS NULL THEN
    NEW.agency_id := COALESCE(derived, public.current_agency_id());
  ELSIF derived IS NOT NULL AND derived <> NEW.agency_id THEN
    RAISE EXCEPTION 'Verknüpfung über Firmengrenzen ist nicht erlaubt' USING ERRCODE = '42501';
  END IF;
  IF TG_NARGS > 0 AND NEW.agency_id IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN jo := to_jsonb(OLD); END IF;
    FOREACH ucol IN ARRAY TG_ARGV LOOP
      uid := nullif(j->>ucol,'')::uuid;
      IF uid IS NOT NULL
         AND (TG_OP = 'INSERT' OR uid IS DISTINCT FROM nullif(jo->>ucol,'')::uuid OR NEW.agency_id IS DISTINCT FROM OLD.agency_id)
         AND NOT public.is_user_agency_member(uid, NEW.agency_id) THEN
        RAISE EXCEPTION 'Zugewiesene Person gehört nicht zu dieser Firma' USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_assignee_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a uuid;
BEGIN
  IF TG_TABLE_NAME = 'property_assignees' THEN
    SELECT agency_id INTO a FROM properties WHERE id = NEW.property_id;
  ELSE
    SELECT agency_id INTO a FROM clients WHERE id = NEW.client_id;
  END IF;
  IF a IS NOT NULL AND NOT public.is_user_agency_member(NEW.user_id, a) THEN
    RAISE EXCEPTION 'Zugewiesene Person gehört nicht zu dieser Firma' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- ========== 4. Backfill (user triggers disabled so updated_at/logs/notifications stay untouched) ==========
DO $$
DECLARE t text; creator text; sole uuid;
  spec text[][] := ARRAY[
    ARRAY['mandates',''], ARRAY['reservations',''], ARRAY['nda_agreements','created_by'],
    ARRAY['property_ownerships',''], ARRAY['property_media',''], ARRAY['property_market_analyses','created_by'],
    ARRAY['tasks','created_by'], ARRAY['checklists',''], ARRAY['commission_records','created_by'],
    ARRAY['commission_record_splits','user_id'], ARRAY['mandate_commission_splits','user_id'],
    ARRAY['commission_targets','user_id'], ARRAY['documents','uploaded_by'],
    ARRAY['generated_documents','created_by'], ARRAY['activity_logs','actor_id'],
    ARRAY['hypo_calculations','created_by'], ARRAY['appointments','assigned_to'], ARRAY['matches',''],
    ARRAY['financing_dossiers',''], ARRAY['financing_links','created_by']];
  i int;
BEGIN
  SELECT CASE WHEN count(*) = 1 THEN min(id::text)::uuid END INTO sole FROM public.agencies;
  FOR i IN 1..array_length(spec,1) LOOP
    t := spec[i][1]; creator := spec[i][2];
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
    EXECUTE format('UPDATE public.%I x SET agency_id = (SELECT (array_agg(a) FILTER (WHERE a IS NOT NULL))[1] FROM unnest(public.tenant_parent_agencies(to_jsonb(x))) a) WHERE agency_id IS NULL', t);
    IF creator <> '' THEN
      EXECUTE format('UPDATE public.%I SET agency_id = public.single_agency_of(%I) WHERE agency_id IS NULL AND %I IS NOT NULL', t, creator, creator);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
  END LOOP;
  -- Company-level settings without parent: created while only one agency existed
  IF sole IS NOT NULL THEN
    ALTER TABLE public.bank_accounts DISABLE TRIGGER USER;
    UPDATE public.bank_accounts SET agency_id = sole WHERE agency_id IS NULL;
    ALTER TABLE public.bank_accounts ENABLE TRIGGER USER;
    ALTER TABLE public.livekit_settings DISABLE TRIGGER USER;
    UPDATE public.livekit_settings SET agency_id = sole WHERE agency_id IS NULL;
    ALTER TABLE public.livekit_settings ENABLE TRIGGER USER;
  END IF;
END $$;

-- ========== 5. Attach guards ==========
DO $$
DECLARE t text; args text;
  spec text[][] := ARRAY[
    ARRAY['property_media',''], ARRAY['tasks','assigned_to'], ARRAY['mandates',''], ARRAY['reservations',''],
    ARRAY['property_ownerships',''], ARRAY['documents',''], ARRAY['generated_documents',''],
    ARRAY['nda_agreements',''], ARRAY['property_market_analyses',''], ARRAY['commission_records',''],
    ARRAY['commission_record_splits','user_id'], ARRAY['mandate_commission_splits','user_id'],
    ARRAY['commission_targets','user_id'], ARRAY['activity_logs',''], ARRAY['checklists',''],
    ARRAY['bank_accounts',''], ARRAY['hypo_calculations',''], ARRAY['appointments','assigned_to'],
    ARRAY['matches',''], ARRAY['financing_dossiers',''], ARRAY['financing_links',''], ARRAY['livekit_settings','']];
  i int;
BEGIN
  FOR i IN 1..array_length(spec,1) LOOP
    t := spec[i][1]; args := CASE WHEN spec[i][2] = '' THEN '' ELSE quote_literal(spec[i][2]) END;
    EXECUTE format('DROP TRIGGER IF EXISTS tg_tenant_guard ON public.%I', t);
    EXECUTE format('CREATE TRIGGER tg_tenant_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_tenant_guard(%s)', t, args);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(agency_id)', t || '_agency_id_idx', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS tg_assignee_guard ON public.property_assignees;
CREATE TRIGGER tg_assignee_guard BEFORE INSERT OR UPDATE ON public.property_assignees FOR EACH ROW EXECUTE FUNCTION public.tg_assignee_guard();
DROP TRIGGER IF EXISTS tg_assignee_guard ON public.client_assignees;
CREATE TRIGGER tg_assignee_guard BEFORE INSERT OR UPDATE ON public.client_assignees FOR EACH ROW EXECUTE FUNCTION public.tg_assignee_guard();

-- ========== 6. Policies ==========
CREATE OR REPLACE FUNCTION public.is_commission_split_member(_record_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.commission_record_splits s WHERE s.commission_record_id = _record_id AND s.user_id = auth.uid());
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN (
    'property_media','tasks','mandates','reservations','property_ownerships','documents','generated_documents',
    'nda_agreements','property_market_analyses','commission_records','commission_record_splits',
    'mandate_commission_splits','commission_targets','activity_logs','checklists','checklist_items',
    'bank_accounts','hypo_calculations','appointments','matches','financing_checklist_items',
    'financing_dossiers_scenarios','financing_links','livekit_settings','search_profile_subscriptions')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Standard: members read/create/edit, owner/admin delete
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['property_media','tasks','mandates','reservations','property_ownerships','documents',
    'generated_documents','checklists','hypo_calculations','appointments','matches','mandate_commission_splits','financing_links']
  LOOP
    EXECUTE format('CREATE POLICY tenant_select ON public.%I FOR SELECT TO authenticated USING (public.is_agency_member(agency_id))', t);
    EXECUTE format('CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_agency_member(agency_id))', t);
    EXECUTE format('CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id))', t);
    EXECUTE format('CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated USING (public.is_agency_owner_or_admin(agency_id))', t);
  END LOOP;
END $$;

-- NDA: delete manager+
CREATE POLICY tenant_select ON public.nda_agreements FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY tenant_insert ON public.nda_agreements FOR INSERT TO authenticated WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tenant_update ON public.nda_agreements FOR UPDATE TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tenant_delete ON public.nda_agreements FOR DELETE TO authenticated USING (public.is_agency_manager(agency_id));

-- Market analyses
CREATE POLICY tenant_select ON public.property_market_analyses FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY tenant_insert ON public.property_market_analyses FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.is_agency_member(agency_id));
CREATE POLICY tenant_delete ON public.property_market_analyses FOR DELETE TO authenticated USING (public.is_agency_member(agency_id) AND (created_by = auth.uid() OR public.is_agency_owner_or_admin(agency_id)));

-- Commissions
CREATE POLICY tenant_select ON public.commission_records FOR SELECT TO authenticated USING (public.is_agency_member(agency_id) AND (public.is_agency_commission_admin(agency_id) OR created_by = auth.uid() OR public.is_commission_split_member(id)));
CREATE POLICY tenant_insert ON public.commission_records FOR INSERT TO authenticated WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tenant_update ON public.commission_records FOR UPDATE TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tenant_delete ON public.commission_records FOR DELETE TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY tenant_select ON public.commission_record_splits FOR SELECT TO authenticated USING (public.is_agency_member(agency_id) AND (public.is_agency_commission_admin(agency_id) OR user_id = auth.uid()));
CREATE POLICY tenant_insert ON public.commission_record_splits FOR INSERT TO authenticated WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tenant_update ON public.commission_record_splits FOR UPDATE TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY tenant_delete ON public.commission_record_splits FOR DELETE TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY tenant_select ON public.commission_targets FOR SELECT TO authenticated USING (public.is_agency_member(agency_id) AND (public.is_agency_commission_admin(agency_id) OR user_id = auth.uid()));
CREATE POLICY tenant_manage ON public.commission_targets FOR ALL TO authenticated USING (public.is_agency_member(agency_id) AND (user_id = auth.uid() OR public.is_agency_manager(agency_id))) WITH CHECK (public.is_agency_member(agency_id) AND (user_id = auth.uid() OR public.is_agency_manager(agency_id)));

-- Activity logs
CREATE POLICY tenant_select ON public.activity_logs FOR SELECT TO authenticated USING (public.is_agency_member(agency_id) AND (actor_id = auth.uid() OR public.is_agency_manager(agency_id)));
CREATE POLICY tenant_insert ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (public.is_agency_member(agency_id) AND (actor_id = auth.uid() OR public.is_agency_owner_or_admin(agency_id)));
CREATE POLICY tenant_delete ON public.activity_logs FOR DELETE TO authenticated USING (public.is_agency_owner_or_admin(agency_id));

-- Bank accounts: manager+
CREATE POLICY tenant_manage ON public.bank_accounts FOR ALL TO authenticated USING (public.is_agency_manager(agency_id)) WITH CHECK (public.is_agency_manager(agency_id));

-- LiveKit settings: owner/admin of the agency
CREATE POLICY tenant_manage ON public.livekit_settings FOR ALL TO authenticated USING (public.is_agency_owner_or_admin(agency_id)) WITH CHECK (public.is_agency_owner_or_admin(agency_id));

-- Parent-based child tables
CREATE POLICY tenant_access ON public.checklist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklists c WHERE c.id = checklist_items.checklist_id AND public.is_agency_member(c.agency_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.checklists c WHERE c.id = checklist_items.checklist_id AND public.is_agency_member(c.agency_id)));
CREATE POLICY tenant_access ON public.financing_checklist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.financing_dossiers d WHERE d.id = financing_checklist_items.dossier_id AND public.is_agency_member(d.agency_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.financing_dossiers d WHERE d.id = financing_checklist_items.dossier_id AND public.is_agency_member(d.agency_id)));
CREATE POLICY tenant_access ON public.financing_dossiers_scenarios FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.financing_dossiers d WHERE d.id = financing_dossiers_scenarios.dossier_id AND public.is_agency_member(d.agency_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.financing_dossiers d WHERE d.id = financing_dossiers_scenarios.dossier_id AND public.is_agency_member(d.agency_id)));

-- Search profile subscriptions: own + colleagues of the same agency
CREATE POLICY tenant_select ON public.search_profile_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_user_agency_member(user_id, public.current_agency_id()));
CREATE POLICY own_insert ON public.search_profile_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY own_delete ON public.search_profile_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Profiles management scoped to the managed profile's agency
DROP POLICY IF EXISTS profiles_owner_admin_manage ON public.profiles;
CREATE POLICY profiles_owner_admin_manage ON public.profiles FOR ALL TO authenticated
  USING (public.is_agency_owner_or_admin(agency_id)) WITH CHECK (public.is_agency_owner_or_admin(agency_id));

-- ========== 7. Search-profile notifications only within the property's agency ==========
CREATE OR REPLACE FUNCTION public.tg_notify_search_profile_matches()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE p record; sub record; price numeric; cname text;
BEGIN
  IF NEW.status NOT IN ('available','active','preparation') OR COALESCE(NEW.is_unit, false) THEN RETURN NEW; END IF;
  IF NEW.agency_id IS NULL THEN RETURN NEW; END IF;
  price := COALESCE(NEW.price, NEW.rent);
  FOR p IN
    SELECT sp.*, c.full_name FROM public.client_search_profiles sp
    JOIN public.clients c ON c.id = sp.client_id
    WHERE sp.is_active = true AND c.agency_id = NEW.agency_id
  LOOP
    IF p.listing_type IS NOT NULL AND p.listing_type <> NEW.listing_type THEN CONTINUE; END IF;
    IF p.budget_min IS NOT NULL AND (price IS NULL OR price < p.budget_min) THEN CONTINUE; END IF;
    IF p.budget_max IS NOT NULL AND (price IS NULL OR price > p.budget_max) THEN CONTINUE; END IF;
    IF p.rooms_min IS NOT NULL AND (NEW.rooms IS NULL OR NEW.rooms < p.rooms_min) THEN CONTINUE; END IF;
    IF p.area_min IS NOT NULL AND (COALESCE(NEW.living_area, NEW.area) IS NULL OR COALESCE(NEW.living_area, NEW.area) < p.area_min) THEN CONTINUE; END IF;
    IF p.area_max IS NOT NULL AND (COALESCE(NEW.living_area, NEW.area) IS NULL OR COALESCE(NEW.living_area, NEW.area) > p.area_max) THEN CONTINUE; END IF;
    IF COALESCE(cardinality(p.preferred_property_types), 0) > 0 AND NOT (NEW.property_type = ANY(p.preferred_property_types)) THEN CONTINUE; END IF;
    IF COALESCE(cardinality(p.preferred_cities), 0) > 0 AND NOT EXISTS (
      SELECT 1 FROM unnest(p.preferred_cities) AS ct WHERE lower(COALESCE(NEW.city, '')) LIKE '%' || lower(ct) || '%') THEN CONTINUE; END IF;
    cname := COALESCE(p.full_name, 'Suchprofil');
    FOR sub IN SELECT s.user_id FROM public.search_profile_subscriptions s
      WHERE s.profile_id = p.id AND public.is_user_agency_member(s.user_id, NEW.agency_id)
    LOOP
      IF sub.user_id = auth.uid() THEN CONTINUE; END IF;
      PERFORM public.create_notification(sub.user_id, 'match', 'Neuer Treffer für Suchprofil',
        COALESCE(NEW.title, 'Immobilie') || ' passt zum Suchprofil von ' || cname,
        '/properties/' || NEW.id::text, 'property', NEW.id);
    END LOOP;
  END LOOP;
  RETURN NEW;
END; $function$;

-- ========== 8. Storage: legacy mapping + tenant-aware policies ==========
CREATE TABLE IF NOT EXISTS public.storage_object_tenants (
  bucket_id text NOT NULL,
  object_name text NOT NULL,
  agency_id uuid NOT NULL REFERENCES public.agencies(id),
  source text NOT NULL DEFAULT 'legacy_backfill',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_id, object_name)
);
GRANT ALL ON public.storage_object_tenants TO service_role;
ALTER TABLE public.storage_object_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY storage_object_tenants_platform_read ON public.storage_object_tenants FOR SELECT TO authenticated USING (public.is_platform_admin());
GRANT SELECT ON public.storage_object_tenants TO authenticated;

-- Existing files were all created while ASIMO was the only agency
INSERT INTO public.storage_object_tenants (bucket_id, object_name, agency_id)
SELECT o.bucket_id, o.name, (SELECT id FROM public.agencies)
FROM storage.objects o
WHERE o.bucket_id IN ('documents','generated-documents','chat-attachments','media','brand-assets')
  AND (SELECT count(*) FROM public.agencies) = 1
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.storage_object_agency(_bucket text, _name text, _owner uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s1 text := split_part(_name,'/',1); s2 text := split_part(_name,'/',2); a uuid;
BEGIN
  IF s1 = 'agency' AND s2 ~* '^[0-9a-f-]{36}$' THEN RETURN s2::uuid; END IF;
  SELECT agency_id INTO a FROM storage_object_tenants WHERE bucket_id = _bucket AND object_name = _name;
  IF a IS NOT NULL THEN RETURN a; END IF;
  IF s2 ~* '^[0-9a-f-]{36}$' THEN
    IF s1 = 'clients' THEN SELECT agency_id INTO a FROM clients WHERE id = s2::uuid;
    ELSIF s1 IN ('properties','property') THEN SELECT agency_id INTO a FROM properties WHERE id = s2::uuid;
    END IF;
    IF a IS NOT NULL THEN RETURN a; END IF;
  END IF;
  IF s1 ~* '^[0-9a-f-]{36}$' AND _bucket = 'media' THEN
    SELECT agency_id INTO a FROM properties WHERE id = s1::uuid;
    IF a IS NOT NULL THEN RETURN a; END IF;
  END IF;
  IF _owner IS NOT NULL THEN RETURN public.single_agency_of(_owner); END IF;
  RETURN NULL;
END $$;

DROP POLICY IF EXISTS documents_admin_delete ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_read ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS documents_generated_read_auth ON storage.objects;
DROP POLICY IF EXISTS documents_generated_update_auth ON storage.objects;
DROP POLICY IF EXISTS documents_generated_write_auth ON storage.objects;
DROP POLICY IF EXISTS generated_documents_admin_delete ON storage.objects;
DROP POLICY IF EXISTS generated_documents_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS generated_documents_authenticated_read ON storage.objects;
DROP POLICY IF EXISTS generated_documents_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS "chat attachments read" ON storage.objects;
DROP POLICY IF EXISTS "chat attachments insert" ON storage.objects;
DROP POLICY IF EXISTS media_authenticated_delete ON storage.objects;
DROP POLICY IF EXISTS media_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS media_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS brand_assets_authenticated_delete ON storage.objects;
DROP POLICY IF EXISTS brand_assets_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS brand_assets_authenticated_update ON storage.objects;

CREATE POLICY tenant_docs_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('documents','generated-documents') AND public.is_agency_member(public.storage_object_agency(bucket_id, name, owner)));
CREATE POLICY tenant_docs_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('documents','generated-documents') AND public.is_agency_member(COALESCE(public.storage_object_agency(bucket_id, name, owner), public.current_agency_id())));
CREATE POLICY tenant_docs_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('documents','generated-documents') AND public.is_agency_member(public.storage_object_agency(bucket_id, name, owner)));
CREATE POLICY tenant_docs_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('documents','generated-documents') AND public.is_agency_owner_or_admin(public.storage_object_agency(bucket_id, name, owner)));

CREATE POLICY tenant_chat_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND (owner = auth.uid() OR public.is_agency_member(public.storage_object_agency(bucket_id, name, owner))));
CREATE POLICY tenant_chat_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND public.current_agency_id() IS NOT NULL);

CREATE POLICY tenant_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.is_agency_member(COALESCE(public.storage_object_agency(bucket_id, name, owner), public.current_agency_id())));
CREATE POLICY tenant_media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.is_agency_member(public.storage_object_agency(bucket_id, name, owner)));
CREATE POLICY tenant_media_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.is_agency_member(public.storage_object_agency(bucket_id, name, owner)));

CREATE POLICY tenant_brand_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-assets' AND (public.is_owner_or_admin() OR (split_part(name,'/',1) = 'avatars' AND public.current_agency_id() IS NOT NULL)));
CREATE POLICY tenant_brand_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brand-assets' AND (owner = auth.uid() OR public.is_agency_owner_or_admin(public.storage_object_agency(bucket_id, name, owner))));
CREATE POLICY tenant_brand_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand-assets' AND (owner = auth.uid() OR public.is_agency_owner_or_admin(public.storage_object_agency(bucket_id, name, owner))));

-- ========== 9. Function exposure ==========
REVOKE EXECUTE ON FUNCTION public.has_agency_role(uuid, public.app_role[]), public.is_agency_manager(uuid),
  public.is_agency_commission_admin(uuid), public.is_user_agency_member(uuid, uuid), public.single_agency_of(uuid),
  public.tenant_parent_agencies(jsonb), public.tg_tenant_guard(), public.tg_assignee_guard(),
  public.is_commission_split_member(uuid), public.storage_object_agency(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, public.app_role[]), public.is_agency_manager(uuid),
  public.is_agency_commission_admin(uuid), public.is_user_agency_member(uuid, uuid), public.single_agency_of(uuid),
  public.is_commission_split_member(uuid), public.storage_object_agency(text, text, uuid) TO authenticated;
