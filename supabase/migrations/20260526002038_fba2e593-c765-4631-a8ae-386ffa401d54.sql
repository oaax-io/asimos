
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.send_self_disclosure_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  sent_count integer := 0;
  target uuid;
  last_sent timestamptz;
BEGIN
  FOR rec IN
    SELECT c.id, c.full_name, c.assigned_to, c.owner_id
    FROM public.clients c
    LEFT JOIN public.client_self_disclosures d ON d.client_id = c.id
    WHERE COALESCE(c.is_archived, false) = false
      AND (d.id IS NULL OR COALESCE(d.status, 'draft') <> 'submitted')
  LOOP
    target := COALESCE(rec.assigned_to, rec.owner_id);
    IF target IS NULL THEN CONTINUE; END IF;

    SELECT MAX(created_at) INTO last_sent
    FROM public.notifications
    WHERE user_id = target
      AND type = 'task'
      AND related_type = 'client_self_disclosure'
      AND related_id = rec.id;

    IF last_sent IS NOT NULL AND last_sent > now() - interval '3 days' THEN
      CONTINUE;
    END IF;

    PERFORM public.create_notification(
      target,
      'task',
      'Selbstauskunft unvollständig',
      'Kunde ' || COALESCE(rec.full_name, '') || ' hat die Selbstauskunft noch nicht eingereicht. Bitte Daten vervollständigen.',
      '/clients/' || rec.id::text,
      'client_self_disclosure',
      rec.id
    );
    sent_count := sent_count + 1;
  END LOOP;

  RETURN sent_count;
END;
$$;

-- Falls bereits geplant: vorher entfernen
DO $$
BEGIN
  PERFORM cron.unschedule('self-disclosure-reminders-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'self-disclosure-reminders-daily',
  '0 8 * * *',
  $$ SELECT public.send_self_disclosure_reminders(); $$
);
