CREATE TABLE public.client_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  color text NOT NULL DEFAULT 'fuchsia',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_pins TO authenticated;
GRANT ALL ON public.client_pins TO service_role;

ALTER TABLE public.client_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own client pins"
ON public.client_pins FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER client_pins_set_updated_at
BEFORE UPDATE ON public.client_pins
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();