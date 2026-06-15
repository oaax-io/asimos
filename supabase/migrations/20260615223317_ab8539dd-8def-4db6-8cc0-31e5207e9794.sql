ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de'
  CHECK (language IN ('de', 'fr', 'it'));