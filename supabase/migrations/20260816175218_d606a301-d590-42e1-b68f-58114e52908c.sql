ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS reference_no text;

CREATE SEQUENCE IF NOT EXISTS public.property_reference_seq START WITH 100001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.format_property_reference(_n bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT 'IMO-' || to_char(_n / 1000, 'FM999999999') || '.' || lpad((_n % 1000)::text, 3, '0')
$$;

CREATE OR REPLACE FUNCTION public.tg_property_set_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.reference_no IS NULL OR NEW.reference_no = '' THEN
    NEW.reference_no := public.format_property_reference(nextval('public.property_reference_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_set_reference ON public.properties;
CREATE TRIGGER property_set_reference
BEFORE INSERT ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.tg_property_set_reference();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.properties WHERE reference_no IS NULL ORDER BY created_at NULLS LAST, id LOOP
    UPDATE public.properties
      SET reference_no = public.format_property_reference(nextval('public.property_reference_seq'))
      WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS properties_reference_no_key ON public.properties (reference_no);