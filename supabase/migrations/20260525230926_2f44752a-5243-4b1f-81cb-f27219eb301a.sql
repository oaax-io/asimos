ALTER TABLE public.property_media ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE public.property_media ALTER COLUMN uploaded_by SET DEFAULT auth.uid();