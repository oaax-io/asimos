CREATE TABLE public.direct_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_dm_pair ON public.direct_messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_dm_recipient_unread ON public.direct_messages (recipient_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_select_own" ON public.direct_messages FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "dm_insert_own" ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "dm_update_recipient" ON public.direct_messages FOR UPDATE TO authenticated
USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;