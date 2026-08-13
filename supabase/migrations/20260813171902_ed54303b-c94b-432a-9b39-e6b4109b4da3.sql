ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS presence_status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS presence_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_presence_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_presence_status_check
  CHECK (presence_status IN ('available','busy','away','meeting','offline'));