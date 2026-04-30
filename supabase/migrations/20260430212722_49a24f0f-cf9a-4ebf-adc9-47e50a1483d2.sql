-- Add is_default column
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Ensure only one default per type
CREATE UNIQUE INDEX IF NOT EXISTS document_templates_one_default_per_type
  ON public.document_templates (type)
  WHERE is_default = true;

-- Helper function to atomically set the default for a type
CREATE OR REPLACE FUNCTION public.set_default_template(_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_type document_type;
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Only owners/admins can set default templates';
  END IF;

  SELECT type INTO t_type FROM public.document_templates WHERE id = _template_id;
  IF t_type IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  UPDATE public.document_templates
    SET is_default = false, updated_at = now()
    WHERE type = t_type AND is_default = true AND id <> _template_id;

  UPDATE public.document_templates
    SET is_default = true, updated_at = now()
    WHERE id = _template_id;
END;
$$;