
-- ENUMS
CREATE TYPE public.lead_status AS ENUM ('new','contacted','qualified','converted','lost');
CREATE TYPE public.client_type AS ENUM ('buyer','seller','tenant','landlord');
CREATE TYPE public.property_type AS ENUM ('apartment','house','commercial','land','other');
CREATE TYPE public.property_status AS ENUM ('draft','available','reserved','sold','rented','archived');
CREATE TYPE public.listing_type AS ENUM ('sale','rent');
CREATE TYPE public.appointment_type AS ENUM ('viewing','meeting','call','other');
CREATE TYPE public.appointment_status AS ENUM ('scheduled','completed','cancelled');
CREATE TYPE public.match_status AS ENUM ('suggested','contacted','interested','rejected','converted');
CREATE TYPE public.app_role AS ENUM ('owner','agent','assistant');

-- AGENCIES
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  role public.app_role NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer to read agency_id w/o recursion
CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT agency_id FROM public.profiles WHERE id = auth.uid() $$;

-- LEADS
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  status public.lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  client_type public.client_type NOT NULL DEFAULT 'buyer',
  notes TEXT,
  -- search profile
  budget_min NUMERIC,
  budget_max NUMERIC,
  rooms_min NUMERIC,
  area_min NUMERIC,
  area_max NUMERIC,
  preferred_cities TEXT[],
  preferred_types public.property_type[],
  preferred_listing public.listing_type,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- PROPERTIES
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  property_type public.property_type NOT NULL DEFAULT 'apartment',
  listing_type public.listing_type NOT NULL DEFAULT 'sale',
  status public.property_status NOT NULL DEFAULT 'draft',
  price NUMERIC,
  rooms NUMERIC,
  bathrooms NUMERIC,
  area NUMERIC,
  plot_area NUMERIC,
  year_built INT,
  energy_class TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'DE',
  features TEXT[],
  images TEXT[],
  seller_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  appointment_type public.appointment_type NOT NULL DEFAULT 'viewing',
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  notes TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- MATCHES
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  status public.match_status NOT NULL DEFAULT 'suggested',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, property_id)
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_leads_upd BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_clients_upd BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_properties_upd BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_appointments_upd BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto create agency + profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_agency_id UUID;
DECLARE agency_name TEXT;
BEGIN
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'Meine Agentur');
  INSERT INTO public.agencies (name) VALUES (agency_name) RETURNING id INTO new_agency_id;
  INSERT INTO public.profiles (id, agency_id, full_name, email, role)
  VALUES (NEW.id, new_agency_id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, 'owner');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES (multi-tenant: same agency)
-- agencies
CREATE POLICY "agency_select_own" ON public.agencies FOR SELECT TO authenticated USING (id = public.current_agency_id());
CREATE POLICY "agency_update_own" ON public.agencies FOR UPDATE TO authenticated USING (id = public.current_agency_id());

-- profiles
CREATE POLICY "profiles_select_same_agency" ON public.profiles FOR SELECT TO authenticated USING (agency_id = public.current_agency_id());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- generic helper macro pattern via repeated policies
-- LEADS
CREATE POLICY "leads_all_same_agency" ON public.leads FOR ALL TO authenticated
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

-- CLIENTS
CREATE POLICY "clients_all_same_agency" ON public.clients FOR ALL TO authenticated
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

-- PROPERTIES
CREATE POLICY "properties_all_same_agency" ON public.properties FOR ALL TO authenticated
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

-- APPOINTMENTS
CREATE POLICY "appointments_all_same_agency" ON public.appointments FOR ALL TO authenticated
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

-- MATCHES
CREATE POLICY "matches_all_same_agency" ON public.matches FOR ALL TO authenticated
  USING (agency_id = public.current_agency_id())
  WITH CHECK (agency_id = public.current_agency_id());

-- Indexes
CREATE INDEX ON public.leads(agency_id);
CREATE INDEX ON public.clients(agency_id);
CREATE INDEX ON public.properties(agency_id);
CREATE INDEX ON public.appointments(agency_id, starts_at);
CREATE INDEX ON public.matches(agency_id);
