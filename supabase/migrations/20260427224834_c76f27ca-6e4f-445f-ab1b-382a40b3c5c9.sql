
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'superadmin'::public.app_role)
$$;

CREATE POLICY "users_view_own_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin());

CREATE POLICY "superadmins_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_agency_id UUID;
DECLARE agency_name TEXT;
BEGIN
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'Meine Agentur');
  INSERT INTO public.agencies (name) VALUES (agency_name) RETURNING id INTO new_agency_id;
  INSERT INTO public.profiles (id, agency_id, full_name, email, role)
  VALUES (NEW.id, new_agency_id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, 'owner');

  IF LOWER(NEW.email) = 'bilel.chagra@oaase.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
DECLARE existing_user_id UUID;
BEGIN
  SELECT id INTO existing_user_id FROM auth.users WHERE LOWER(email) = 'bilel.chagra@oaase.com' LIMIT 1;
  IF existing_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (existing_user_id, 'superadmin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
