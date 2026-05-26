
-- Helper: insert notification respecting prefs
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _type text,
  _title text,
  _message text,
  _link text,
  _related_type text,
  _related_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs public.notification_preferences%ROWTYPE;
  channel_ok boolean := true;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  SELECT * INTO prefs FROM public.notification_preferences WHERE user_id = _user_id;

  -- Default: enabled when no prefs row
  IF FOUND THEN
    IF NOT COALESCE(prefs.in_app_enabled, true) THEN RETURN; END IF;
    channel_ok := CASE _type
      WHEN 'appointment' THEN COALESCE(prefs.appointments_enabled, true)
      WHEN 'task' THEN COALESCE(prefs.tasks_enabled, true)
      WHEN 'lead' THEN COALESCE(prefs.leads_enabled, true)
      ELSE true
    END;
    IF NOT channel_ok THEN RETURN; END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, related_type, related_id)
  VALUES (_user_id, _type, _title, _message, _link, _related_type, _related_id);
END;
$$;

-- Tasks
CREATE OR REPLACE FUNCTION public.tg_notify_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  target uuid;
  msg text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target := NEW.assigned_to;
  ELSIF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    target := NEW.assigned_to;
  ELSE
    RETURN NEW;
  END IF;

  IF target IS NULL OR target = actor THEN RETURN NEW; END IF;

  msg := COALESCE(NEW.title, 'Aufgabe');
  IF NEW.due_date IS NOT NULL THEN
    msg := msg || ' (fällig ' || to_char(NEW.due_date AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY') || ')';
  END IF;

  PERFORM public.create_notification(
    target, 'task',
    'Neue Aufgabe zugewiesen', msg,
    '/tasks', 'task', NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_task ON public.tasks;
CREATE TRIGGER notify_task
AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_task();

-- Appointments
CREATE OR REPLACE FUNCTION public.tg_notify_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  target uuid;
  msg text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target := COALESCE(NEW.assigned_to, NEW.owner_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    target := NEW.assigned_to;
  ELSE
    RETURN NEW;
  END IF;

  IF target IS NULL OR target = actor THEN RETURN NEW; END IF;

  msg := COALESCE(NEW.title, 'Termin') || ' am ' ||
         to_char(NEW.starts_at AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY HH24:MI');

  PERFORM public.create_notification(
    target, 'appointment',
    'Neuer Termin', msg,
    '/appointments', 'appointment', NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_appointment ON public.appointments;
CREATE TRIGGER notify_appointment
AFTER INSERT OR UPDATE OF assigned_to ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_appointment();

-- Leads
CREATE OR REPLACE FUNCTION public.tg_notify_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  target uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target := COALESCE(NEW.assigned_to, NEW.owner_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    target := NEW.assigned_to;
  ELSE
    RETURN NEW;
  END IF;

  IF target IS NULL OR target = actor THEN RETURN NEW; END IF;

  PERFORM public.create_notification(
    target, 'lead',
    'Neuer Lead', COALESCE(NEW.full_name, 'Neuer Lead eingegangen'),
    '/leads/' || NEW.id::text, 'lead', NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_lead ON public.leads;
CREATE TRIGGER notify_lead
AFTER INSERT OR UPDATE OF assigned_to ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_lead();
