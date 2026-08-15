CREATE TABLE public.chat_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  member_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_pins TO authenticated;
GRANT ALL ON public.chat_pins TO service_role;

ALTER TABLE public.chat_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own chat pins"
ON public.chat_pins FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());