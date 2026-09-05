CREATE OR REPLACE FUNCTION public.is_commission_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) OR public.has_role(auth.uid(), 'superadmin');
$$;

DROP POLICY IF EXISTS "View commission records" ON public.commission_records;
CREATE POLICY "View commission records" ON public.commission_records
  FOR SELECT TO authenticated
  USING (
    public.is_commission_admin()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.commission_record_splits s
      WHERE s.commission_record_id = commission_records.id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "View commission record splits" ON public.commission_record_splits;
CREATE POLICY "View commission record splits" ON public.commission_record_splits
  FOR SELECT TO authenticated
  USING (public.is_commission_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "View commission targets" ON public.commission_targets;
CREATE POLICY "View commission targets" ON public.commission_targets
  FOR SELECT TO authenticated
  USING (public.is_commission_admin() OR user_id = auth.uid());