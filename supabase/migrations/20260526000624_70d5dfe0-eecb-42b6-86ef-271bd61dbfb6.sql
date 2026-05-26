
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  related_type text,
  related_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_self_or_manager" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR is_manager_or_above());
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  appointments_enabled boolean NOT NULL DEFAULT true,
  appointment_reminder_minutes integer NOT NULL DEFAULT 60,
  tasks_enabled boolean NOT NULL DEFAULT true,
  task_due_reminder boolean NOT NULL DEFAULT true,
  task_overdue_reminder boolean NOT NULL DEFAULT true,
  leads_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  in_app_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs_select_own" ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_prefs_insert_own" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_prefs_update_own" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_notification_prefs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_notification_prefs_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
