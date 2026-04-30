
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_provider text;

-- Storage policies for documents bucket, generated/ prefix
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='documents_generated_read_auth') THEN
    CREATE POLICY "documents_generated_read_auth" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'generated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='documents_generated_write_auth') THEN
    CREATE POLICY "documents_generated_write_auth" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'generated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='documents_generated_update_auth') THEN
    CREATE POLICY "documents_generated_update_auth" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'generated');
  END IF;
END $$;
