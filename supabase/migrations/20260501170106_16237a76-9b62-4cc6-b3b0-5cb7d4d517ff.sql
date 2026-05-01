CREATE TABLE public.property_market_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL,
  created_by uuid,
  raw_markdown text,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pma_property ON public.property_market_analyses(property_id, created_at DESC);

ALTER TABLE public.property_market_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pma_select_authenticated" ON public.property_market_analyses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pma_insert_authenticated" ON public.property_market_analyses
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "pma_delete_owner_or_admin" ON public.property_market_analyses
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_owner_or_admin());
