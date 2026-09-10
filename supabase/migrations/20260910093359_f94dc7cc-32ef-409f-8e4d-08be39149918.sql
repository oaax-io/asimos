CREATE TABLE IF NOT EXISTS public.master_list_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_key text NOT NULL,
  value text NOT NULL,
  label_de text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_key, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_list_values TO authenticated;
GRANT ALL ON public.master_list_values TO service_role;

ALTER TABLE public.master_list_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_list_values_select" ON public.master_list_values
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "master_list_values_insert" ON public.master_list_values
  FOR INSERT TO authenticated WITH CHECK (public.is_owner_or_admin() OR public.is_superadmin());
CREATE POLICY "master_list_values_update" ON public.master_list_values
  FOR UPDATE TO authenticated USING (public.is_owner_or_admin() OR public.is_superadmin())
  WITH CHECK (public.is_owner_or_admin() OR public.is_superadmin());
CREATE POLICY "master_list_values_delete" ON public.master_list_values
  FOR DELETE TO authenticated USING (public.is_owner_or_admin() OR public.is_superadmin());

CREATE TRIGGER master_list_values_set_updated_at
  BEFORE UPDATE ON public.master_list_values
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.master_list_values (list_key, value, label_de, sort_order) VALUES
  ('condition','Neu','Neu',10),
  ('condition','Gepflegt','Gepflegt',20),
  ('condition','Renovationsbedürftig','Renovationsbedürftig',30),
  ('condition','Sanierungsbedürftig','Sanierungsbedürftig',40),
  ('marketing_type','Kaufen','Kaufen',10),
  ('marketing_type','Mieten','Mieten',20),
  ('vat_status','nicht optiert','nicht optiert',10),
  ('vat_status','optiert','optiert',20),
  ('sale_procedure','Festpreis','Festpreis',10),
  ('sale_procedure','Bieterverfahren','Bieterverfahren',20),
  ('sale_procedure','Auktion','Auktion',30),
  ('deal_type','Asset Deal','Asset Deal',10),
  ('deal_type','Share Deal','Share Deal',20)
ON CONFLICT (list_key, value) DO NOTHING;