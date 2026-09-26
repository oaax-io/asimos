CREATE OR REPLACE FUNCTION public.can_see_profile(_profile_id uuid, _profile_agency uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _profile_id = auth.uid()
    OR public.is_platform_admin()
    OR (_profile_agency IS NOT NULL AND _profile_agency = public.current_agency_id())
    OR EXISTS (SELECT 1 FROM public.agency_memberships m
               WHERE m.user_id = _profile_id AND m.is_active AND m.agency_id = public.current_agency_id())
  );
$$;
REVOKE ALL ON FUNCTION public.can_see_profile(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_profile(uuid, uuid) TO authenticated, service_role;

-- agency_memberships: writes only by owner/admin of the active workspace (no platform backdoor)
CREATE POLICY sec48_memberships_insert ON public.agency_memberships AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_agency_id() AND public.is_owner_or_admin());
CREATE POLICY sec48_memberships_update ON public.agency_memberships AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (agency_id = public.current_agency_id() AND public.is_owner_or_admin())
  WITH CHECK (agency_id = public.current_agency_id() AND public.is_owner_or_admin());
CREATE POLICY sec48_memberships_delete ON public.agency_memberships AS RESTRICTIVE FOR DELETE TO authenticated
  USING (agency_id = public.current_agency_id() AND public.is_owner_or_admin());

-- agencies: no browser create/delete; update only own owner/admin; read only own memberships or platform
CREATE POLICY sec48_agencies_no_insert ON public.agencies AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY sec48_agencies_no_delete ON public.agencies AS RESTRICTIVE FOR DELETE TO authenticated USING (false);
CREATE POLICY sec48_agencies_update ON public.agencies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_agency_owner_or_admin(id)) WITH CHECK (public.is_agency_owner_or_admin(id));
CREATE POLICY sec48_agencies_select ON public.agencies AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.is_user_agency_member(auth.uid(), id) OR public.is_platform_admin());

-- profiles
CREATE POLICY sec48_profiles_select ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_see_profile(id, agency_id));
CREATE POLICY sec48_profiles_update ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_agency_owner_or_admin(agency_id))
  WITH CHECK ((id = auth.uid() OR public.is_agency_owner_or_admin(agency_id))
              AND (agency_id IS NULL OR public.is_user_agency_member(id, agency_id)));
CREATE POLICY sec48_profiles_delete ON public.profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_agency_owner_or_admin(agency_id));
CREATE POLICY sec48_profiles_insert ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- user_roles: legacy, no direct browser writes (trigger would create memberships)
CREATE POLICY sec48_user_roles_no_insert ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY sec48_user_roles_no_update ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY sec48_user_roles_no_delete ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- commissions: delete only owner/admin
CREATE POLICY sec48_commission_records_delete ON public.commission_records AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_agency_owner_or_admin(agency_id));
CREATE POLICY sec48_commission_splits_delete ON public.commission_record_splits AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_agency_owner_or_admin(agency_id));