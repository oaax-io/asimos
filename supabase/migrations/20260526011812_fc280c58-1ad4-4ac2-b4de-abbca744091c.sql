
-- 1. Add new enum values
ALTER TYPE public.feedback_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.feedback_status ADD VALUE IF NOT EXISTS 'duplicate';
ALTER TYPE public.feedback_status ADD VALUE IF NOT EXISTS 'updated';

-- 2. Votes table
CREATE TABLE IF NOT EXISTS public.feedback_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feedback_id, user_id)
);

ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_votes_read_all" ON public.feedback_votes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "feedback_votes_insert_self" ON public.feedback_votes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_votes_delete_self" ON public.feedback_votes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback_id ON public.feedback_votes(feedback_id);

-- 3. Restrict status / priority changes to superadmin via trigger
CREATE OR REPLACE FUNCTION public.tg_feedback_restrict_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
      OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at)
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Nur der Systemowner darf Status, Priorität oder Zuständigkeit eines Feedbacks ändern';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_feedback_restrict_status ON public.feedback;
CREATE TRIGGER tg_feedback_restrict_status
BEFORE UPDATE ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.tg_feedback_restrict_status();

-- 4. Notify superadmins on new feedback & comments
CREATE OR REPLACE FUNCTION public.tg_notify_feedback_superadmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sa record;
  actor uuid := auth.uid();
BEGIN
  FOR sa IN SELECT user_id FROM public.user_roles WHERE role = 'superadmin'::public.app_role LOOP
    IF sa.user_id = actor THEN CONTINUE; END IF;
    PERFORM public.create_notification(
      sa.user_id, 'task',
      'Neues Feedback', COALESCE(NEW.title, 'Neues Feedback eingegangen'),
      '/feedback', 'feedback', NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_notify_feedback_superadmin ON public.feedback;
CREATE TRIGGER tg_notify_feedback_superadmin
AFTER INSERT ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_feedback_superadmin();

CREATE OR REPLACE FUNCTION public.tg_notify_feedback_comment_superadmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sa record;
  actor uuid := auth.uid();
  fb_title text;
  fb_author uuid;
BEGIN
  SELECT title, created_by INTO fb_title, fb_author FROM public.feedback WHERE id = NEW.feedback_id;
  -- notify superadmins
  FOR sa IN SELECT user_id FROM public.user_roles WHERE role = 'superadmin'::public.app_role LOOP
    IF sa.user_id = actor THEN CONTINUE; END IF;
    PERFORM public.create_notification(
      sa.user_id, 'task',
      'Neuer Feedback-Kommentar', COALESCE(fb_title, 'Feedback'),
      '/feedback', 'feedback', NEW.feedback_id
    );
  END LOOP;
  -- notify original author if not actor and not already superadmin
  IF fb_author IS NOT NULL AND fb_author <> actor
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = fb_author AND role = 'superadmin'::public.app_role) THEN
    PERFORM public.create_notification(
      fb_author, 'task',
      'Antwort auf dein Feedback', COALESCE(fb_title, 'Feedback'),
      '/feedback', 'feedback', NEW.feedback_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_notify_feedback_comment_superadmin ON public.feedback_comments;
CREATE TRIGGER tg_notify_feedback_comment_superadmin
AFTER INSERT ON public.feedback_comments
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_feedback_comment_superadmin();
