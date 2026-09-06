ALTER TABLE public.video_calls ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ringing';
ALTER TABLE public.video_calls ADD CONSTRAINT video_calls_status_check CHECK (status IN ('ringing','accepted','declined','ended','missed'));

CREATE INDEX IF NOT EXISTS video_calls_participants_idx ON public.video_calls USING gin (participants);
CREATE INDEX IF NOT EXISTS video_calls_status_started_idx ON public.video_calls (status, started_at DESC);

ALTER TABLE public.video_calls REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'video_calls'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.video_calls';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.video_calls TO authenticated;
GRANT ALL ON public.video_calls TO service_role;

-- Benachrichtigung bei neuer Direktnachricht
CREATE OR REPLACE FUNCTION public.tg_notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(full_name, email, 'Kollege') INTO sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  PERFORM public.create_notification(
    NEW.recipient_id,
    'chat_message',
    COALESCE(sender_name, 'Neue Nachricht'),
    LEFT(COALESCE(NEW.body, ''), 160),
    NULL,
    'direct_message',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_direct_message ON public.direct_messages;
CREATE TRIGGER trg_notify_direct_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_direct_message();