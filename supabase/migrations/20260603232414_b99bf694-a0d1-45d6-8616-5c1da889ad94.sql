
-- Auto-update client status to 'finanzierung' when dossier reaches bank-ready stages
CREATE OR REPLACE FUNCTION public.sync_client_status_from_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trigger_statuses text[] := ARRAY['ready_for_bank','submitted_to_bank','approved'];
BEGIN
  IF NEW.dossier_status IS NOT NULL
     AND NEW.dossier_status::text = ANY(trigger_statuses)
     AND (TG_OP = 'INSERT' OR OLD.dossier_status IS DISTINCT FROM NEW.dossier_status)
  THEN
    -- Primary client
    IF NEW.client_id IS NOT NULL THEN
      UPDATE public.clients
      SET status = 'finanzierung'::client_status, updated_at = now()
      WHERE id = NEW.client_id
        AND status NOT IN ('abgeschlossen'::client_status, 'abgelehnt'::client_status, 'storniert'::client_status);
    END IF;
    -- Co-applicant (spouse/partner)
    IF NEW.co_applicant_client_id IS NOT NULL THEN
      UPDATE public.clients
      SET status = 'finanzierung'::client_status, updated_at = now()
      WHERE id = NEW.co_applicant_client_id
        AND status NOT IN ('abgeschlossen'::client_status, 'abgelehnt'::client_status, 'storniert'::client_status);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_status_from_dossier ON public.financing_dossiers;
CREATE TRIGGER trg_sync_client_status_from_dossier
AFTER INSERT OR UPDATE OF dossier_status ON public.financing_dossiers
FOR EACH ROW EXECUTE FUNCTION public.sync_client_status_from_dossier();
