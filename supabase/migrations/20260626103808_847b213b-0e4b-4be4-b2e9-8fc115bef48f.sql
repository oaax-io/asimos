
-- Attach notification triggers (functions exist but triggers were missing)
DROP TRIGGER IF EXISTS trg_notify_task ON public.tasks;
CREATE TRIGGER trg_notify_task
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_task();

DROP TRIGGER IF EXISTS trg_notify_appointment ON public.appointments;
CREATE TRIGGER trg_notify_appointment
  AFTER INSERT OR UPDATE OF assigned_to ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_appointment();

DROP TRIGGER IF EXISTS trg_notify_lead ON public.leads;
CREATE TRIGGER trg_notify_lead
  AFTER INSERT OR UPDATE OF assigned_to ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_lead();

-- Backfill: create notifications for currently assigned open tasks that have no notification yet
INSERT INTO public.notifications (user_id, type, title, message, link, related_type, related_id)
SELECT t.assigned_to, 'task',
       'Zugewiesene Aufgabe',
       COALESCE(t.title, 'Aufgabe') ||
         CASE WHEN t.due_date IS NOT NULL
              THEN ' (fällig ' || to_char(t.due_date AT TIME ZONE 'Europe/Zurich','DD.MM.YYYY') || ')'
              ELSE '' END,
       '/tasks', 'task', t.id
FROM public.tasks t
WHERE t.assigned_to IS NOT NULL
  AND t.status NOT IN ('done','cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.related_type = 'task' AND n.related_id = t.id AND n.user_id = t.assigned_to
  );
