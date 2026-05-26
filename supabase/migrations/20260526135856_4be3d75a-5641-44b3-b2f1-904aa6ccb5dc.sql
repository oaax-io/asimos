CREATE TABLE public.hypo_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by uuid,
  label text,
  purchase_price numeric NOT NULL,
  equity_pct numeric NOT NULL,
  interest_pct numeric NOT NULL,
  term_years integer NOT NULL,
  admin_pct numeric NOT NULL DEFAULT 0,
  start_date date,
  monthly_payment numeric,
  total_interest numeric,
  total_paid numeric,
  principal numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hypo_calculations TO authenticated;
GRANT ALL ON public.hypo_calculations TO service_role;

ALTER TABLE public.hypo_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY hypo_calc_access ON public.hypo_calculations
  FOR ALL TO authenticated
  USING (
    is_manager_or_above()
    OR created_by = auth.uid()
    OR (client_id IS NOT NULL AND can_access_client(client_id))
  )
  WITH CHECK (
    is_manager_or_above()
    OR created_by = auth.uid()
    OR (client_id IS NOT NULL AND can_access_client(client_id))
  );

CREATE POLICY hypo_calc_superadmin ON public.hypo_calculations
  FOR ALL TO authenticated
  USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE TRIGGER hypo_calc_updated_at
  BEFORE UPDATE ON public.hypo_calculations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_hypo_calc_client ON public.hypo_calculations(client_id);