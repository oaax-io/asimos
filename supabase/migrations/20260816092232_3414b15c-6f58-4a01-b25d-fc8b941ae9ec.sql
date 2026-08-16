CREATE TABLE IF NOT EXISTS public.property_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  color text NOT NULL DEFAULT 'fuchsia',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_pins TO authenticated;
GRANT ALL ON public.property_pins TO service_role;

ALTER TABLE public.property_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own property pins" ON public.property_pins;
CREATE POLICY "Users manage their own property pins"
ON public.property_pins FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);