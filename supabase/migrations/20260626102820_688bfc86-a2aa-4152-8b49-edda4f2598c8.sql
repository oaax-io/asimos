
-- Enable realtime for tasks
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks';
  END IF;
END $$;

-- Trigger: reassign open client tasks when client.assigned_to changes
CREATE OR REPLACE FUNCTION public.tg_reassign_client_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NEW.assigned_to IS NOT NULL THEN
    UPDATE public.tasks
       SET assigned_to = NEW.assigned_to,
           updated_at = now()
     WHERE related_type = 'client'
       AND related_id = NEW.id
       AND status NOT IN ('done', 'cancelled')
       AND (assigned_to IS DISTINCT FROM NEW.assigned_to);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reassign_client_tasks ON public.clients;
CREATE TRIGGER trg_reassign_client_tasks
AFTER UPDATE OF assigned_to ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.tg_reassign_client_tasks();
