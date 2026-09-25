ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_agency_id uuid NULL;

CREATE OR REPLACE FUNCTION public.current_agency_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH ms AS (
    SELECT m.agency_id FROM public.agency_memberships m
    WHERE auth.uid() IS NOT NULL AND m.user_id = auth.uid() AND m.is_active AND public.agency_is_active(m.agency_id))
  SELECT COALESCE(
    (SELECT p.active_agency_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.active_agency_id IN (SELECT agency_id FROM ms)),
    (SELECT CASE WHEN count(*) = 1 THEN (array_agg(agency_id))[1] END FROM ms));
$$;

CREATE OR REPLACE FUNCTION public.is_agency_member(_agency_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT _agency_id IS NOT NULL AND _agency_id = public.current_agency_id(); $$;

CREATE OR REPLACE FUNCTION public.has_agency_role(_agency_id uuid, _roles app_role[])
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _agency_id IS NOT NULL AND _agency_id = public.current_agency_id() AND EXISTS (
    SELECT 1 FROM public.agency_memberships m
    WHERE m.user_id = auth.uid() AND m.agency_id = _agency_id AND m.is_active AND m.role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.is_agency_owner_or_admin(_agency_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _agency_id IS NOT NULL AND _agency_id = public.current_agency_id() AND EXISTS (
    SELECT 1 FROM public.agency_memberships m
    WHERE m.user_id = auth.uid() AND m.agency_id = _agency_id AND m.is_active AND m.role IN ('owner','admin'));
$$;

CREATE OR REPLACE FUNCTION public.my_workspace_status()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'none'
    WHEN public.current_agency_id() IS NOT NULL THEN 'active'
    WHEN (SELECT count(*) FROM public.agency_memberships m
          WHERE m.user_id = auth.uid() AND m.is_active AND public.agency_is_active(m.agency_id)) > 1 THEN 'select'
    WHEN EXISTS (SELECT 1 FROM public.agency_memberships m JOIN public.agencies a ON a.id = m.agency_id
                 WHERE m.user_id = auth.uid() AND m.is_active AND coalesce(a.status,'active') <> 'active') THEN 'unavailable'
    ELSE 'none' END;
$$;

CREATE OR REPLACE FUNCTION public.my_workspaces()
 RETURNS TABLE(agency_id uuid, name text, role text, logo_url text, favicon_url text,
               custom_domain text, subdomain text, is_current boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT a.id,
         COALESCE(NULLIF(b.company_name,''), a.name)::text,
         m.role::text,
         b.logo_url, b.favicon_url,
         (SELECT d.domain FROM public.tenant_domains d WHERE d.agency_id = a.id AND d.domain_type = 'custom'
            AND d.verification_status = 'verified' AND d.activated_at IS NOT NULL
          ORDER BY d.is_primary DESC LIMIT 1),
         (SELECT d.domain FROM public.tenant_domains d WHERE d.agency_id = a.id AND d.domain_type = 'subdomain'
            AND d.verification_status = 'verified' ORDER BY d.is_primary DESC LIMIT 1),
         a.id = public.current_agency_id()
  FROM public.agency_memberships m
  JOIN public.agencies a ON a.id = m.agency_id
  LEFT JOIN public.brand_settings b ON b.agency_id = a.id
  WHERE auth.uid() IS NOT NULL AND m.user_id = auth.uid() AND m.is_active AND public.agency_is_active(a.id)
  ORDER BY 2;
$$;

CREATE OR REPLACE FUNCTION public.set_current_agency(_agency_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501'; END IF;
  IF _agency_id IS NULL OR NOT public.agency_is_active(_agency_id) OR NOT EXISTS (
     SELECT 1 FROM public.agency_memberships m
     WHERE m.user_id = auth.uid() AND m.agency_id = _agency_id AND m.is_active) THEN
    RAISE EXCEPTION 'Dieses Unternehmen kann nicht ausgewählt werden' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.workspace_switch', 'on', true);
  UPDATE public.profiles SET active_agency_id = _agency_id WHERE id = auth.uid();
  PERFORM set_config('app.workspace_switch', 'off', true);
  RETURN _agency_id;
END $$;

CREATE OR REPLACE FUNCTION public.tg_profiles_protect_active_agency()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('authenticated','anon')
     AND coalesce(current_setting('app.workspace_switch', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN NEW.active_agency_id := NULL;
    ELSIF NEW.active_agency_id IS DISTINCT FROM OLD.active_agency_id THEN
      RAISE EXCEPTION 'Das aktive Unternehmen kann nur über den Unternehmenswechsel gesetzt werden' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_protect_active_agency ON public.profiles;
CREATE TRIGGER profiles_protect_active_agency BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_protect_active_agency();

REVOKE ALL ON FUNCTION public.my_workspaces() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_current_agency(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tg_profiles_protect_active_agency() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_workspaces() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_current_agency(uuid) TO authenticated, service_role;