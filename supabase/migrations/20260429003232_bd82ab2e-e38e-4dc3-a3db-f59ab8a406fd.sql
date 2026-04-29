
-- Reservation-Prozesslogik: bei signed -> Property auf reserved, bei cancelled -> active
-- Verhindert auch doppelte aktive Reservationen für dieselbe Immobilie

CREATE OR REPLACE FUNCTION public.tg_reservation_sync_property()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count integer;
BEGIN
  -- Bei INSERT/UPDATE auf signed/sent: pruefen, dass keine andere aktive Reservation existiert
  IF NEW.status IN ('signed', 'sent') AND NEW.property_id IS NOT NULL THEN
    SELECT COUNT(*) INTO active_count
    FROM public.reservations
    WHERE property_id = NEW.property_id
      AND status IN ('signed', 'sent')
      AND id <> NEW.id;
    IF active_count > 0 THEN
      RAISE EXCEPTION 'Diese Immobilie hat bereits eine aktive Reservation. Bitte zuerst stornieren oder als Warteliste markieren.';
    END IF;
  END IF;

  -- Wenn Reservation signed wird: Immobilie auf reserved
  IF NEW.status = 'signed' AND NEW.property_id IS NOT NULL THEN
    UPDATE public.properties
    SET status = 'reserved', updated_at = now()
    WHERE id = NEW.property_id
      AND status NOT IN ('sold', 'rented');
  END IF;

  -- Wenn Reservation storniert wird: Immobilie zurueck auf active (sofern sie reserved war)
  IF TG_OP = 'UPDATE' AND OLD.status IN ('signed', 'sent')
     AND NEW.status IN ('cancelled') AND NEW.property_id IS NOT NULL THEN
    UPDATE public.properties
    SET status = 'active', updated_at = now()
    WHERE id = NEW.property_id
      AND status = 'reserved';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_sync_property_trg ON public.reservations;
CREATE TRIGGER reservations_sync_property_trg
AFTER INSERT OR UPDATE OF status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.tg_reservation_sync_property();
