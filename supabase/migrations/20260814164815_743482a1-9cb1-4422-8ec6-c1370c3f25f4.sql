CREATE TABLE public.client_financial_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  person_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  area text NOT NULL CHECK (area IN ('income','expense','asset','liability','insurance','pension')),
  category text NOT NULL DEFAULT 'other',
  label text,
  amount numeric NOT NULL DEFAULT 0,
  periodicity text NOT NULL DEFAULT 'monthly' CHECK (periodicity IN ('monthly','yearly','once')),
  person_scope text NOT NULL DEFAULT 'main' CHECK (person_scope IN ('main','partner','joint')),
  available_as_equity numeric,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','self_disclosure','pdf','financing','client')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_financial_items_client ON public.client_financial_items(client_id, area);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_financial_items TO authenticated;
GRANT ALL ON public.client_financial_items TO service_role;

ALTER TABLE public.client_financial_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access financial items of accessible clients"
ON public.client_financial_items FOR ALL TO authenticated
USING (public.can_access_client(client_id))
WITH CHECK (public.can_access_client(client_id));

CREATE TRIGGER set_client_financial_items_updated_at
BEFORE UPDATE ON public.client_financial_items
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();