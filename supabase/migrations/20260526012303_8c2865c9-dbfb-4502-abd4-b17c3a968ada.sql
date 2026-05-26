
CREATE POLICY "feedback_insert_superadmin_any" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin());
