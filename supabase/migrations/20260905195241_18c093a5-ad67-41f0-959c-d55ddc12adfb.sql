-- Profile-Erweiterungen
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_tier text,
  ADD COLUMN IF NOT EXISTS commission_payout_rate numeric(5,2) DEFAULT 50;

-- Mandats-Erweiterungen
ALTER TABLE public.mandates
  ADD COLUMN IF NOT EXISTS cancellation_fee numeric(12,2),
  ADD COLUMN IF NOT EXISTS cancellation_fee_notes text;

-- 1) Geplanter Team-Split pro Objekt/Mandat
CREATE TABLE public.mandate_commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  mandate_id uuid REFERENCES public.mandates(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'listing_agent',
  split_percent numeric(5,2) NOT NULL CHECK (split_percent > 0 AND split_percent <= 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcs_property ON public.mandate_commission_splits(property_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mandate_commission_splits TO authenticated;
GRANT ALL ON public.mandate_commission_splits TO service_role;
ALTER TABLE public.mandate_commission_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View mandate commission splits" ON public.mandate_commission_splits
  FOR SELECT TO authenticated
  USING (public.is_manager_or_above() OR public.can_access_property(property_id));
CREATE POLICY "Manage mandate commission splits" ON public.mandate_commission_splits
  FOR ALL TO authenticated
  USING (public.is_manager_or_above() OR public.can_access_property(property_id))
  WITH CHECK (public.is_manager_or_above() OR public.can_access_property(property_id));

-- 2) Ledger
CREATE TABLE public.commission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  mandate_id uuid REFERENCES public.mandates(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  record_type text NOT NULL CHECK (record_type IN ('commission','reservation_fee','cancellation_fee','referral_fee','adjustment')),
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','invoiced','paid','void')),
  gross_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CHF',
  credited_reservation_record_id uuid REFERENCES public.commission_records(id) ON DELETE SET NULL,
  booked_at timestamptz NOT NULL DEFAULT now(),
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cr_property ON public.commission_records(property_id);
CREATE INDEX idx_cr_type ON public.commission_records(record_type);
CREATE INDEX idx_cr_reservation ON public.commission_records(reservation_id);
CREATE INDEX idx_cr_mandate ON public.commission_records(mandate_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_records TO authenticated;
GRANT ALL ON public.commission_records TO service_role;
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View commission records" ON public.commission_records
  FOR SELECT TO authenticated
  USING (public.is_manager_or_above() OR public.can_access_property(property_id));
CREATE POLICY "Manage commission records" ON public.commission_records
  FOR ALL TO authenticated
  USING (public.is_manager_or_above() OR public.can_access_property(property_id))
  WITH CHECK (public.is_manager_or_above() OR public.can_access_property(property_id));

-- 3) Split-Snapshot je Ledger-Eintrag
CREATE TABLE public.commission_record_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_record_id uuid NOT NULL REFERENCES public.commission_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  split_percent numeric(5,2) NOT NULL,
  gross_share numeric(12,2) NOT NULL,
  payout_rate numeric(5,2) NOT NULL,
  payout_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crs_record ON public.commission_record_splits(commission_record_id);
CREATE INDEX idx_crs_user ON public.commission_record_splits(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_record_splits TO authenticated;
GRANT ALL ON public.commission_record_splits TO service_role;
ALTER TABLE public.commission_record_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View commission record splits" ON public.commission_record_splits
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.commission_records r
      WHERE r.id = commission_record_id
        AND (public.is_manager_or_above() OR public.can_access_property(r.property_id))
    )
  );
CREATE POLICY "Manage commission record splits" ON public.commission_record_splits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commission_records r
      WHERE r.id = commission_record_id
        AND (public.is_manager_or_above() OR public.can_access_property(r.property_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commission_records r
      WHERE r.id = commission_record_id
        AND (public.is_manager_or_above() OR public.can_access_property(r.property_id))
    )
  );

-- 4) Ziele
CREATE TABLE public.commission_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('month','quarter','year')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_amount numeric(12,2),
  target_deals integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ct_user ON public.commission_targets(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_targets TO authenticated;
GRANT ALL ON public.commission_targets TO service_role;
ALTER TABLE public.commission_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View commission targets" ON public.commission_targets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_manager_or_above());
CREATE POLICY "Manage commission targets" ON public.commission_targets
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_manager_or_above())
  WITH CHECK (user_id = auth.uid() OR public.is_manager_or_above());

-- updated_at Trigger
CREATE TRIGGER trg_mcs_updated_at BEFORE UPDATE ON public.mandate_commission_splits
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_cr_updated_at BEFORE UPDATE ON public.commission_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_ct_updated_at BEFORE UPDATE ON public.commission_targets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();