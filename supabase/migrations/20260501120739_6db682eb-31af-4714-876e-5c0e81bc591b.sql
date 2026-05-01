
-- Enums
DO $$ BEGIN
  CREATE TYPE public.client_role_type AS ENUM (
    'buyer','seller','owner','former_owner','tenant','landlord',
    'financing_applicant','co_applicant','investor','contact_person','general_contact'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_role_status AS ENUM ('active','inactive','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ownership_type AS ENUM ('owner','co_owner','former_owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- client_roles
CREATE TABLE IF NOT EXISTS public.client_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role_type public.client_role_type NOT NULL,
  related_type text,
  related_id uuid,
  status public.client_role_status NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_roles_client_id ON public.client_roles(client_id);
CREATE INDEX IF NOT EXISTS idx_client_roles_related ON public.client_roles(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_client_roles_role_type ON public.client_roles(role_type);

ALTER TABLE public.client_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_roles_authenticated_all" ON public.client_roles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "superadmin_all_client_roles" ON public.client_roles
  FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE TRIGGER tg_client_roles_updated_at
  BEFORE UPDATE ON public.client_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- property_ownerships
CREATE TABLE IF NOT EXISTS public.property_ownerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ownership_type public.ownership_type NOT NULL DEFAULT 'owner',
  share_percent numeric,
  start_date date,
  end_date date,
  acquisition_type text,
  acquisition_price numeric,
  sale_price numeric,
  land_register_entry text,
  is_primary_contact boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ownerships_property ON public.property_ownerships(property_id);
CREATE INDEX IF NOT EXISTS idx_property_ownerships_client ON public.property_ownerships(client_id);

ALTER TABLE public.property_ownerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_ownerships_authenticated_all" ON public.property_ownerships
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "superadmin_all_property_ownerships" ON public.property_ownerships
  FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE TRIGGER tg_property_ownerships_updated_at
  BEFORE UPDATE ON public.property_ownerships
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Backfill: client_type -> client_roles
INSERT INTO public.client_roles (client_id, role_type, status)
SELECT c.id,
  CASE c.client_type::text
    WHEN 'buyer' THEN 'buyer'::public.client_role_type
    WHEN 'seller' THEN 'seller'::public.client_role_type
    WHEN 'owner' THEN 'owner'::public.client_role_type
    WHEN 'tenant' THEN 'tenant'::public.client_role_type
    WHEN 'landlord' THEN 'landlord'::public.client_role_type
    WHEN 'investor' THEN 'investor'::public.client_role_type
    ELSE 'general_contact'::public.client_role_type
  END,
  'active'::public.client_role_status
FROM public.clients c
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_roles cr WHERE cr.client_id = c.id
);

-- Backfill: properties.owner_client_id -> property_ownerships + client_roles(owner)
INSERT INTO public.property_ownerships (property_id, client_id, ownership_type, is_primary_contact)
SELECT p.id, p.owner_client_id, 'owner'::public.ownership_type, true
FROM public.properties p
WHERE p.owner_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.property_ownerships po
    WHERE po.property_id = p.id AND po.client_id = p.owner_client_id
  );

INSERT INTO public.client_roles (client_id, role_type, related_type, related_id, status)
SELECT p.owner_client_id, 'owner'::public.client_role_type, 'property', p.id, 'active'::public.client_role_status
FROM public.properties p
WHERE p.owner_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_roles cr
    WHERE cr.client_id = p.owner_client_id
      AND cr.role_type = 'owner'::public.client_role_type
      AND cr.related_type = 'property'
      AND cr.related_id = p.id
  );

-- Backfill: properties.seller_client_id -> client_roles(seller)
INSERT INTO public.client_roles (client_id, role_type, related_type, related_id, status)
SELECT p.seller_client_id, 'seller'::public.client_role_type, 'property', p.id, 'active'::public.client_role_status
FROM public.properties p
WHERE p.seller_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_roles cr
    WHERE cr.client_id = p.seller_client_id
      AND cr.role_type = 'seller'::public.client_role_type
      AND cr.related_type = 'property'
      AND cr.related_id = p.id
  );
