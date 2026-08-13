ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mentions jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP POLICY IF EXISTS "chat attachments read" ON storage.objects;
CREATE POLICY "chat attachments read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat attachments insert" ON storage.objects;
CREATE POLICY "chat attachments insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat attachments delete own" ON storage.objects;
CREATE POLICY "chat attachments delete own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND owner = auth.uid());