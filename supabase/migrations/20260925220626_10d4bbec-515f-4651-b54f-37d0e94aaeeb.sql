CREATE OR REPLACE FUNCTION public.agency_is_active(_agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = _agency_id AND coalesce(a.status,'active') = 'active');
$$;
REVOKE ALL ON FUNCTION public.agency_is_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_is_active(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_agency_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.agency_is_active(x.a) THEN x.a END FROM (SELECT COALESCE(
    (SELECT p.agency_id FROM public.profiles p
       JOIN public.agency_memberships m ON m.user_id = p.id AND m.agency_id = p.agency_id AND m.is_active
      WHERE p.id = auth.uid()),
    (SELECT CASE WHEN count(*) = 1 THEN (array_agg(m.agency_id))[1] END
       FROM public.agency_memberships m WHERE m.user_id = auth.uid() AND m.is_active)
  ) AS a) x;
$function$;

CREATE OR REPLACE FUNCTION public.is_agency_member(_agency_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _agency_id IS NOT NULL AND auth.uid() IS NOT NULL AND public.agency_is_active(_agency_id) AND EXISTS (
    SELECT 1 FROM public.agency_memberships m
    WHERE m.user_id = auth.uid() AND m.agency_id = _agency_id AND m.is_active);
$function$;

CREATE OR REPLACE FUNCTION public.has_agency_role(_agency_id uuid, _roles app_role[])
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _agency_id IS NOT NULL AND auth.uid() IS NOT NULL AND public.agency_is_active(_agency_id) AND EXISTS (
    SELECT 1 FROM public.agency_memberships m
    WHERE m.user_id = auth.uid() AND m.agency_id = _agency_id AND m.is_active AND m.role = ANY(_roles));
$function$;

CREATE OR REPLACE FUNCTION public.is_agency_owner_or_admin(_agency_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _agency_id IS NOT NULL AND auth.uid() IS NOT NULL AND public.agency_is_active(_agency_id) AND EXISTS (
    SELECT 1 FROM public.agency_memberships m
    WHERE m.user_id = auth.uid() AND m.agency_id = _agency_id AND m.is_active
      AND m.role IN ('owner','admin'));
$function$;

-- 'active' | 'unavailable' | 'none' – nur Status, keine Daten
CREATE OR REPLACE FUNCTION public.my_workspace_status()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'none'
    WHEN public.current_agency_id() IS NOT NULL THEN 'active'
    WHEN EXISTS (SELECT 1 FROM public.agency_memberships m JOIN public.agencies a ON a.id = m.agency_id
                 WHERE m.user_id = auth.uid() AND m.is_active AND coalesce(a.status,'active') <> 'active') THEN 'unavailable'
    ELSE 'none' END;
$$;
REVOKE ALL ON FUNCTION public.my_workspace_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_workspace_status() TO authenticated, service_role;

CREATE TABLE public.platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  target_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_audit_logs TO authenticated;
GRANT ALL ON public.platform_audit_logs TO service_role;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_audit_logs_platform_read ON public.platform_audit_logs
  FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE INDEX platform_audit_logs_created_idx ON public.platform_audit_logs (created_at DESC);
CREATE INDEX platform_audit_logs_target_idx ON public.platform_audit_logs (target_id);

CREATE OR REPLACE FUNCTION public.platform_set_tenant_status(_agency_id uuid, _status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev text; nm text; act text;
BEGIN
  PERFORM public.platform_assert_admin();
  IF _status NOT IN ('active','suspended','archived') THEN
    RAISE EXCEPTION 'invalid' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(status,'active'), name INTO prev, nm FROM agencies WHERE id = _agency_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF prev = _status THEN RETURN prev; END IF;
  IF prev = 'archived' AND _status = 'suspended' THEN
    RAISE EXCEPTION 'invalid' USING ERRCODE = '22023';
  END IF;
  UPDATE agencies SET status = _status WHERE id = _agency_id;
  act := CASE _status WHEN 'suspended' THEN 'tenant_suspended' WHEN 'archived' THEN 'tenant_archived' ELSE 'tenant_reactivated' END;
  INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), act, 'tenant', _agency_id, nm, jsonb_build_object('previous_status', prev, 'new_status', _status));
  RETURN _status;
END $$;

CREATE OR REPLACE FUNCTION public.platform_update_tenant(_agency_id uuid, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text := btrim(coalesce(_name,'')); old text;
BEGIN
  PERFORM public.platform_assert_admin();
  IF n = '' OR length(n) > 120 THEN RAISE EXCEPTION 'invalid' USING ERRCODE = '22023'; END IF;
  SELECT name INTO old FROM agencies WHERE id = _agency_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF old = n THEN RETURN; END IF;
  UPDATE agencies SET name = n WHERE id = _agency_id;
  INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'tenant_updated', 'tenant', _agency_id, n, jsonb_build_object('changed_fields', jsonb_build_array('name')));
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_audit_logs(_agency_id uuid DEFAULT NULL, _limit integer DEFAULT 50)
RETURNS TABLE(id uuid, created_at timestamptz, action text, target_type text, target_id uuid, target_label text, metadata jsonb, actor_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY
  SELECT l.id, l.created_at, l.action, l.target_type, l.target_id, l.target_label, l.metadata,
         coalesce(p.full_name, u.email::text)
  FROM platform_audit_logs l
  LEFT JOIN profiles p ON p.id = l.actor_user_id
  LEFT JOIN auth.users u ON u.id = l.actor_user_id
  WHERE _agency_id IS NULL OR l.target_id = _agency_id
  ORDER BY l.created_at DESC
  LIMIT greatest(1, least(_limit, 200));
END $$;

REVOKE ALL ON FUNCTION public.platform_set_tenant_status(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_update_tenant(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_audit_logs(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_status(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_update_tenant(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_audit_logs(uuid,integer) TO authenticated, service_role;