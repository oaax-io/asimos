ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.platform_admins FROM anon, authenticated;
REVOKE ALL ON public.platform_admins FROM anon;

CREATE OR REPLACE FUNCTION public.platform_assert_system_owner()
 RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_system_owner() THEN
    RAISE EXCEPTION 'Nur der System Owner darf Plattformrollen verwalten' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_platform_users()
 RETURNS TABLE(user_id uuid, full_name text, email text, platform_role text, created_at timestamptz, updated_at timestamptz, has_membership boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY SELECT pa.user_id, p.full_name, u.email::text, pa.platform_role, pa.created_at, pa.updated_at,
    EXISTS (SELECT 1 FROM agency_memberships m WHERE m.user_id = pa.user_id AND m.is_active)
  FROM platform_admins pa LEFT JOIN profiles p ON p.id = pa.user_id LEFT JOIN auth.users u ON u.id = pa.user_id
  ORDER BY pa.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.platform_find_user_by_email(_email text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE e text := lower(btrim(coalesce(_email,''))); r record;
BEGIN
  PERFORM public.platform_assert_system_owner();
  IF e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(e) > 254 THEN RAISE EXCEPTION 'Ungültige E-Mail-Adresse'; END IF;
  SELECT u.id, u.email::text AS email, p.full_name, pa.platform_role INTO r
  FROM auth.users u LEFT JOIN profiles p ON p.id = u.id LEFT JOIN platform_admins pa ON pa.user_id = u.id
  WHERE lower(u.email) = e LIMIT 1;
  IF r.id IS NULL THEN RETURN jsonb_build_object('exists', false, 'email', e); END IF;
  RETURN jsonb_build_object('exists', true, 'user_id', r.id, 'name', r.full_name, 'email', r.email, 'platform_role', r.platform_role);
END $$;

CREATE OR REPLACE FUNCTION public.platform_set_user_role(_user_id uuid, _role text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE before text; em text; owners int;
BEGIN
  PERFORM public.platform_assert_system_owner();
  IF _role NOT IN ('system_owner','platform_admin','platform_support') THEN RAISE EXCEPTION 'Ungültige Plattformrolle'; END IF;
  SELECT u.email::text INTO em FROM auth.users u WHERE u.id = _user_id;
  IF em IS NULL THEN RAISE EXCEPTION 'Benutzer existiert nicht'; END IF;
  SELECT platform_role INTO before FROM platform_admins WHERE user_id = _user_id FOR UPDATE;
  IF before IS NOT DISTINCT FROM _role THEN RETURN _role; END IF;
  IF before = 'system_owner' THEN
    SELECT count(*) INTO owners FROM platform_admins WHERE platform_role = 'system_owner';
    IF owners <= 1 THEN RAISE EXCEPTION 'Der letzte System Owner kann nicht herabgestuft werden'; END IF;
  END IF;
  IF before IS NULL THEN
    INSERT INTO platform_admins(user_id, platform_role, is_system_owner, updated_at) VALUES (_user_id, _role, _role = 'system_owner', now());
  ELSE
    UPDATE platform_admins SET platform_role = _role, is_system_owner = (_role = 'system_owner'), updated_at = now() WHERE user_id = _user_id;
  END IF;
  INSERT INTO platform_audit_logs(actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), CASE WHEN before IS NULL THEN 'platform_role_granted' ELSE 'platform_role_changed' END,
          'platform_user', _user_id, em,
          jsonb_build_object('target_user_id', _user_id, 'role_before', before, 'role_after', _role, 'target_email', em));
  RETURN _role;
END $$;

CREATE OR REPLACE FUNCTION public.platform_remove_user_access(_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE before text; em text; owners int;
BEGIN
  PERFORM public.platform_assert_system_owner();
  SELECT platform_role INTO before FROM platform_admins WHERE user_id = _user_id FOR UPDATE;
  IF before IS NULL THEN RAISE EXCEPTION 'Kein Plattformzugang vorhanden'; END IF;
  IF before = 'system_owner' THEN
    SELECT count(*) INTO owners FROM platform_admins WHERE platform_role = 'system_owner';
    IF owners <= 1 THEN RAISE EXCEPTION 'Der letzte System Owner kann nicht entfernt werden'; END IF;
  END IF;
  SELECT u.email::text INTO em FROM auth.users u WHERE u.id = _user_id;
  DELETE FROM platform_admins WHERE user_id = _user_id;  -- nur Plattformrolle; Konto/Mitgliedschaften bleiben
  INSERT INTO platform_audit_logs(actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'platform_role_removed', 'platform_user', _user_id, em,
          jsonb_build_object('target_user_id', _user_id, 'role_before', before, 'role_after', NULL, 'target_email', em));
END $$;

REVOKE ALL ON FUNCTION public.platform_assert_system_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_platform_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_find_user_by_email(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_set_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_remove_user_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_assert_system_owner() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_platform_users() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_find_user_by_email(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_user_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_remove_user_access(uuid) TO authenticated, service_role;