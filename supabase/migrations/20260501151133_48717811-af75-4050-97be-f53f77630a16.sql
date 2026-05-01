ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'person',
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS contact_first_name text,
  ADD COLUMN IF NOT EXISTS contact_last_name text;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_entity_type_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_entity_type_check CHECK (entity_type IN ('person','company'));