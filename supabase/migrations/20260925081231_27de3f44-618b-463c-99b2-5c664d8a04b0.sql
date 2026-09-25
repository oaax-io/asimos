DO $$
DECLARE asimo uuid := '69eb3646-8b0e-4f96-b3c9-143e5739d224'; n1 int; n2 int; n3 int; n4 int;
BEGIN
  SELECT count(*) INTO n1 FROM public.financing_dossiers WHERE agency_id IS NULL;
  SELECT count(*) INTO n2 FROM public.generated_documents WHERE agency_id IS NULL;
  SELECT count(*) INTO n3 FROM public.activity_logs WHERE agency_id IS NULL;
  SELECT count(*) INTO n4 FROM public.checklists WHERE agency_id IS NULL;
  IF (n1,n2,n3,n4) <> (3,26,59,2) THEN
    RAISE EXCEPTION 'Unerwartete Anzahl MIGRATION_UNCLEAR: % % % %', n1,n2,n3,n4;
  END IF;
  UPDATE public.financing_dossiers SET agency_id = asimo WHERE agency_id IS NULL;
  UPDATE public.generated_documents SET agency_id = asimo WHERE agency_id IS NULL;
  UPDATE public.activity_logs SET agency_id = asimo WHERE agency_id IS NULL;
  UPDATE public.checklists SET agency_id = asimo WHERE agency_id IS NULL;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('tasks','notify_task','trg_notify_task'),('appointments','notify_appointment','trg_notify_appointment'),('leads','notify_lead','trg_notify_lead')) v(tbl,keep,dup) LOOP
    IF (SELECT replace(pg_get_triggerdef(oid), r.keep, 'X') FROM pg_trigger WHERE tgrelid=('public.'||r.tbl)::regclass AND tgname=r.keep)
     = (SELECT replace(pg_get_triggerdef(oid), r.dup, 'X') FROM pg_trigger WHERE tgrelid=('public.'||r.tbl)::regclass AND tgname=r.dup) THEN
      EXECUTE format('DROP TRIGGER %I ON public.%I', r.dup, r.tbl);
    ELSE
      RAISE NOTICE 'Trigger % auf % nicht identisch – behalten', r.dup, r.tbl;
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS feedback_update_admin_or_owner ON public.feedback;
CREATE POLICY feedback_update_self_or_platform ON public.feedback FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_superadmin())
  WITH CHECK (created_by = auth.uid() OR public.is_superadmin());
DROP POLICY IF EXISTS feedback_delete_admin ON public.feedback;
CREATE POLICY feedback_delete_platform ON public.feedback FOR DELETE TO authenticated
  USING (public.is_superadmin());
DROP POLICY IF EXISTS feedback_comments_delete_self_or_admin ON public.feedback_comments;
CREATE POLICY feedback_comments_delete_self_or_platform ON public.feedback_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_superadmin());