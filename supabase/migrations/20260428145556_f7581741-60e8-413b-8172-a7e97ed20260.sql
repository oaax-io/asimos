
-- Allow superadmins full access to all tables
CREATE POLICY "superadmin_all_agencies" ON public.agencies
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "superadmin_all_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "superadmin_all_leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "superadmin_all_clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "superadmin_all_properties" ON public.properties
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "superadmin_all_appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "superadmin_all_matches" ON public.matches
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Allow superadmins to delete agencies
CREATE POLICY "superadmin_delete_agencies" ON public.agencies
  FOR DELETE TO authenticated
  USING (public.is_superadmin());

-- Function: assign or remove a role (superadmin only)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role public.app_role, _grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only superadmins can manage roles';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) TO authenticated;

-- Function: aggregated stats for superadmin dashboard
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS TABLE (
  agencies_count bigint,
  users_count bigint,
  leads_count bigint,
  clients_count bigint,
  properties_count bigint,
  appointments_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only superadmins can view stats';
  END IF;

  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM public.agencies),
    (SELECT COUNT(*) FROM public.profiles),
    (SELECT COUNT(*) FROM public.leads),
    (SELECT COUNT(*) FROM public.clients),
    (SELECT COUNT(*) FROM public.properties),
    (SELECT COUNT(*) FROM public.appointments);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;
