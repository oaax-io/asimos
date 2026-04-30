-- brand_settings: header/footer HTML
ALTER TABLE public.brand_settings
  ADD COLUMN IF NOT EXISTS header_html text,
  ADD COLUMN IF NOT EXISTS footer_html text;

-- document_templates: layout type + custom CSS flag
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS layout_type text NOT NULL DEFAULT 'contract',
  ADD COLUMN IF NOT EXISTS allow_custom_css boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_css text;