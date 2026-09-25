CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  is_system_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_admins_read_self_or_admin" ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin());

CREATE TABLE public.agency_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL CHECK (role <> 'superadmin'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_memberships TO authenticated;
GRANT ALL ON public.agency_memberships TO service_role;
ALTER TABLE public.agency_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_read" ON public.agency_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR agency_id = public.current_agency_id() OR public.is_superadmin());
CREATE POLICY "memberships_manage" ON public.agency_memberships FOR ALL TO authenticated
  USING ((agency_id = public.current_agency_id() AND public.is_owner_or_admin()) OR public.is_superadmin())
  WITH CHECK ((agency_id = public.current_agency_id() AND public.is_owner_or_admin()) OR public.is_superadmin());
CREATE TRIGGER agency_memberships_updated_at BEFORE UPDATE ON public.agency_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Alle bestehenden Profile gehören zu ASIMO
UPDATE public.profiles SET agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224' WHERE agency_id IS NULL;

-- Tenant-Mitgliedschaften aus operativer Rolle (ohne superadmin)
INSERT INTO public.agency_memberships (agency_id, user_id, role)
SELECT DISTINCT ON (p.id) '69eb3646-8b0e-4f96-b3c9-143e5739d224'::uuid, p.id, ur.role
FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role <> 'superadmin'
ORDER BY p.id, CASE ur.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 WHEN 'agent' THEN 4 ELSE 5 END
ON CONFLICT DO NOTHING;

-- Plattform-Admins getrennt
INSERT INTO public.platform_admins (user_id, is_system_owner)
SELECT ur.user_id, p.email = 'bilel.chagra@oaase.com'
FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'superadmin' ON CONFLICT DO NOTHING;

-- Löschregel: nur Owner/Admin/Superadmin
DROP POLICY IF EXISTS clients_delete ON public.clients;
DROP POLICY IF EXISTS leads_delete ON public.leads;
DROP POLICY IF EXISTS properties_delete ON public.properties;