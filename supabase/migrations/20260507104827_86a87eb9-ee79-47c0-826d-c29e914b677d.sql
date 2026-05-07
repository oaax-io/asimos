
-- Feedback feature
CREATE TYPE public.feedback_type AS ENUM ('idea','bug','question','other');
CREATE TYPE public.feedback_status AS ENUM ('new','planned','in_progress','done','rejected');
CREATE TYPE public.feedback_priority AS ENUM ('low','medium','high','critical');

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type public.feedback_type NOT NULL DEFAULT 'idea',
  status public.feedback_status NOT NULL DEFAULT 'new',
  priority public.feedback_priority NOT NULL DEFAULT 'medium',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  page_url text,
  created_by uuid,
  assigned_to uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_read_all" ON public.feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "feedback_insert_self" ON public.feedback FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "feedback_update_admin_or_owner" ON public.feedback FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_owner_or_admin() OR public.is_superadmin())
  WITH CHECK (created_by = auth.uid() OR public.is_owner_or_admin() OR public.is_superadmin());
CREATE POLICY "feedback_delete_admin" ON public.feedback FOR DELETE TO authenticated
  USING (public.is_owner_or_admin() OR public.is_superadmin());

CREATE TRIGGER tg_feedback_updated_at BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  author_id uuid,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_comments_read_all" ON public.feedback_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "feedback_comments_insert_self" ON public.feedback_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "feedback_comments_update_self" ON public.feedback_comments FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "feedback_comments_delete_self_or_admin" ON public.feedback_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_owner_or_admin() OR public.is_superadmin());

CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_comments_feedback ON public.feedback_comments(feedback_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback', 'feedback', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "feedback_storage_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback');
CREATE POLICY "feedback_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback');
CREATE POLICY "feedback_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feedback' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_owner_or_admin() OR public.is_superadmin()));
