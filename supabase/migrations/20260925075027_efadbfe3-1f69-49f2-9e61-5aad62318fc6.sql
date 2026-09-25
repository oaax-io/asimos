-- TEIL A: HIGH warnings
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid,text,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_search_profiles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_self_disclosure_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid,text,text,text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_search_profiles() TO service_role;
GRANT EXECUTE ON FUNCTION public.send_self_disclosure_reminders() TO service_role;

-- TEIL B/C: membership helpers
CREATE OR REPLACE FUNCTION public.is_agency_member(_agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _agency_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.agency_memberships m
    WHERE m.user_id = auth.uid() AND m.agency_id = _agency_id AND m.is_active);
$$;

CREATE OR REPLACE FUNCTION public.is_agency_owner_or_admin(_agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _agency_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.agency_memberships m
    WHERE m.user_id = auth.uid() AND m.agency_id = _agency_id AND m.is_active
      AND m.role IN ('owner','admin'));
$$;

-- current agency: preferred profiles.agency_id if backed by active membership,
-- else the single active membership, else NULL. Platform role grants nothing.
CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.agency_id FROM public.profiles p
       JOIN public.agency_memberships m ON m.user_id = p.id AND m.agency_id = p.agency_id AND m.is_active
      WHERE p.id = auth.uid()),
    (SELECT CASE WHEN count(*) = 1 THEN (array_agg(m.agency_id))[1] END
       FROM public.agency_memberships m WHERE m.user_id = auth.uid() AND m.is_active)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_agency_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_agency_owner_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_agency_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_agency_owner_or_admin(uuid) TO authenticated, service_role;

-- Default agency on insert (client need not send it); explicit values are checked by RLS
CREATE OR REPLACE FUNCTION public.tg_set_default_agency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.agency_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.agency_id := public.current_agency_id();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS set_default_agency ON public.properties;
DROP TRIGGER IF EXISTS set_default_agency ON public.leads;
DROP TRIGGER IF EXISTS set_default_agency ON public.clients;
CREATE TRIGGER set_default_agency BEFORE INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION public.tg_set_default_agency();
CREATE TRIGGER set_default_agency BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.tg_set_default_agency();
CREATE TRIGGER set_default_agency BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.tg_set_default_agency();

-- TEIL D/E: tenant policies
DROP POLICY IF EXISTS properties_select ON public.properties;
DROP POLICY IF EXISTS properties_insert ON public.properties;
DROP POLICY IF EXISTS properties_update ON public.properties;
DROP POLICY IF EXISTS properties_delete_admin_only ON public.properties;
CREATE POLICY properties_tenant_select ON public.properties FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY properties_tenant_insert ON public.properties FOR INSERT TO authenticated WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY properties_tenant_update ON public.properties FOR UPDATE TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY properties_tenant_delete ON public.properties FOR DELETE TO authenticated USING (public.is_agency_owner_or_admin(agency_id));

DROP POLICY IF EXISTS leads_select ON public.leads;
DROP POLICY IF EXISTS leads_insert ON public.leads;
DROP POLICY IF EXISTS leads_update ON public.leads;
DROP POLICY IF EXISTS leads_delete_admin_only ON public.leads;
CREATE POLICY leads_tenant_select ON public.leads FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY leads_tenant_insert ON public.leads FOR INSERT TO authenticated WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY leads_tenant_update ON public.leads FOR UPDATE TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY leads_tenant_delete ON public.leads FOR DELETE TO authenticated USING (public.is_agency_owner_or_admin(agency_id));

DROP POLICY IF EXISTS clients_select ON public.clients;
DROP POLICY IF EXISTS clients_insert ON public.clients;
DROP POLICY IF EXISTS clients_update ON public.clients;
DROP POLICY IF EXISTS clients_delete_admin_only ON public.clients;
CREATE POLICY clients_tenant_select ON public.clients FOR SELECT TO authenticated USING (public.is_agency_member(agency_id));
CREATE POLICY clients_tenant_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY clients_tenant_update ON public.clients FOR UPDATE TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id));
CREATE POLICY clients_tenant_delete ON public.clients FOR DELETE TO authenticated USING (public.is_agency_owner_or_admin(agency_id));

-- TEIL J: tenant_domains (data model only; domain grants no access)
CREATE TABLE public.tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  domain text NOT NULL,
  domain_type text NOT NULL CHECK (domain_type IN ('subdomain','custom')),
  is_primary boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','failed')),
  verified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_domains_domain_lower CHECK (domain = lower(domain))
);
CREATE UNIQUE INDEX tenant_domains_domain_key ON public.tenant_domains (domain);
CREATE UNIQUE INDEX tenant_domains_one_primary ON public.tenant_domains (agency_id) WHERE is_primary;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_domains TO authenticated;
GRANT ALL ON public.tenant_domains TO service_role;
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_domains_read ON public.tenant_domains FOR SELECT TO authenticated
  USING (public.is_agency_member(agency_id) OR public.is_platform_admin());
CREATE POLICY tenant_domains_platform_manage ON public.tenant_domains FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE TRIGGER tenant_domains_updated_at BEFORE UPDATE ON public.tenant_domains FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();