ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS location_description text NULL,
  ADD COLUMN IF NOT EXISTS latitude double precision NULL,
  ADD COLUMN IF NOT EXISTS longitude double precision NULL;