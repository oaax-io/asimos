
ALTER TABLE public.property_ownerships
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_property_ownerships_property_current
  ON public.property_ownerships(property_id, end_date);
