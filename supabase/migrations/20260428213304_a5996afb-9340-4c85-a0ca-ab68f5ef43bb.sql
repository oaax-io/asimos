
-- 1) Single-Company-Pointer
CREATE TABLE IF NOT EXISTS public.company (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  agency_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Meine Firma',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;

INSERT INTO public.company (id, agency_id, name)
SELECT true, a.id, COALESCE(a.name, 'Meine Firma')
FROM public.agencies a
ORDER BY a.created_at ASC
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 2) current_agency_id() neutralisieren
CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT agency_id FROM public.company WHERE id = true $$;

-- 3) handle_new_user umbauen
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  the_company_id uuid;
BEGIN
  SELECT agency_id INTO the_company_id FROM public.company WHERE id = true;

  IF the_company_id IS NULL THEN
    INSERT INTO public.agencies (name) VALUES ('Meine Firma') RETURNING id INTO the_company_id;
    INSERT INTO public.company (id, agency_id, name) VALUES (true, the_company_id, 'Meine Firma')
    ON CONFLICT (id) DO UPDATE SET agency_id = EXCLUDED.agency_id;
  END IF;

  INSERT INTO public.profiles (id, agency_id, full_name, email, role)
  VALUES (
    NEW.id, the_company_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email, 'employee'::public.app_role
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
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) Helfer-Funktionen
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'owner'::public.app_role, 'superadmin'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('manager'::public.app_role, 'admin'::public.app_role, 'owner'::public.app_role, 'superadmin'::public.app_role)
  )
$$;

-- 5) Module-Permissions
CREATE TABLE IF NOT EXISTS public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  role public.app_role NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit_own boolean NOT NULL DEFAULT false,
  can_edit_all boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, role)
);

ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS module_permissions_read_all ON public.module_permissions;
CREATE POLICY module_permissions_read_all
  ON public.module_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS module_permissions_admin_write ON public.module_permissions;
CREATE POLICY module_permissions_admin_write
  ON public.module_permissions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.module_permissions (module, role, can_view, can_create, can_edit_own, can_edit_all, can_delete) VALUES
  ('dashboard', 'admin', true, false, false, false, false),
  ('dashboard', 'manager', true, false, false, false, false),
  ('dashboard', 'employee', true, false, false, false, false),
  ('leads', 'admin', true, true, true, true, true),
  ('leads', 'manager', true, true, true, true, true),
  ('leads', 'employee', true, true, true, false, false),
  ('clients', 'admin', true, true, true, true, true),
  ('clients', 'manager', true, true, true, true, true),
  ('clients', 'employee', true, true, true, false, false),
  ('properties', 'admin', true, true, true, true, true),
  ('properties', 'manager', true, true, true, true, true),
  ('properties', 'employee', true, true, true, false, false),
  ('appointments', 'admin', true, true, true, true, true),
  ('appointments', 'manager', true, true, true, true, false),
  ('appointments', 'employee', true, true, true, false, false),
  ('financing', 'admin', true, true, true, true, true),
  ('financing', 'manager', true, true, true, true, false),
  ('financing', 'employee', true, true, true, false, false),
  ('matching', 'admin', true, true, true, true, true),
  ('matching', 'manager', true, true, true, true, false),
  ('matching', 'employee', true, true, true, false, false),
  ('documents', 'admin', true, true, true, true, true),
  ('documents', 'manager', true, true, true, true, false),
  ('documents', 'employee', true, true, true, false, false),
  ('tasks', 'admin', true, true, true, true, true),
  ('tasks', 'manager', true, true, true, true, true),
  ('tasks', 'employee', true, true, true, false, false),
  ('employees', 'admin', true, true, true, true, true),
  ('employees', 'manager', true, false, false, false, false),
  ('employees', 'employee', false, false, false, false, false),
  ('company_settings', 'admin', true, false, false, true, false),
  ('company_settings', 'manager', false, false, false, false, false),
  ('company_settings', 'employee', false, false, false, false, false)
ON CONFLICT (module, role) DO NOTHING;

-- 6) Permission-Check Helfer
CREATE OR REPLACE FUNCTION public.user_can(_module text, _action text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  has_perm boolean := false;
BEGIN
  SELECT CASE _action
    WHEN 'view'      THEN bool_or(mp.can_view)
    WHEN 'create'    THEN bool_or(mp.can_create)
    WHEN 'edit_own'  THEN bool_or(mp.can_edit_own)
    WHEN 'edit_all'  THEN bool_or(mp.can_edit_all)
    WHEN 'delete'    THEN bool_or(mp.can_delete)
    ELSE false
  END
  INTO has_perm
  FROM public.module_permissions mp
  JOIN public.user_roles ur ON ur.role = mp.role
  WHERE ur.user_id = auth.uid() AND mp.module = _module;

  RETURN COALESCE(has_perm, false);
END $$;

-- 7) Company-RLS
DROP POLICY IF EXISTS company_read_all ON public.company;
CREATE POLICY company_read_all
  ON public.company FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS company_admin_write ON public.company;
CREATE POLICY company_admin_write
  ON public.company FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8) agency_id-Defaults
ALTER TABLE public.clients      ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();
ALTER TABLE public.leads        ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();
ALTER TABLE public.properties   ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();
ALTER TABLE public.appointments ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();
ALTER TABLE public.matches      ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();
ALTER TABLE public.financing_dossiers ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();
ALTER TABLE public.financing_links    ALTER COLUMN agency_id SET DEFAULT public.current_agency_id();

-- 9) Bestehenden ersten User automatisch zum admin machen
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role
)
ORDER BY p.created_at ASC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;
