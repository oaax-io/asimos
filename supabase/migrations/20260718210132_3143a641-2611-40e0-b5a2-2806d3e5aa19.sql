
CREATE OR REPLACE FUNCTION public.tg_log_financing_dossier_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  changes jsonb := '{}'::jsonb;
  old_j jsonb;
  new_j jsonb;
  k text;
  ignored text[] := ARRAY['updated_at','created_at','id','last_calculated_at'];
  act text;
  field_labels jsonb := jsonb_build_object(
    'status','Status',
    'dossier_status','Dossier-Status',
    'financing_type','Finanzierungsart',
    'purchase_price','Kaufpreis',
    'property_value','Objektwert',
    'loan_amount','Kreditbetrag',
    'equity','Eigenmittel',
    'interest_rate','Zinssatz',
    'quick_check_status','Quick-Check Status',
    'quick_check_affordability','Tragbarkeit',
    'quick_check_ltv','Belehnung',
    'assigned_to','Zuständigkeit',
    'client_id','Hauptkunde',
    'co_applicant_client_id','Ehepartner',
    'property_id','Immobilie',
    'notes','Notizen',
    'completion_percent','Fortschritt',
    'submitted_at','Eingereicht am',
    'refi_purpose','Refi-Zweck',
    'existing_mortgage_amount','Bestehende Hypothek',
    'existing_mortgage_rate','Aktueller Zinssatz',
    'existing_mortgage_expiry','Ablauf Hypothek'
  );
  human_field text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (action, related_type, related_id, actor_id, metadata)
    VALUES ('Finanzierung erstellt', 'financing_dossier', NEW.id, auth.uid(),
            jsonb_build_object('type','system','status', NEW.status));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (action, related_type, related_id, actor_id, metadata)
    VALUES ('Finanzierung gelöscht', 'financing_dossier', OLD.id, auth.uid(),
            jsonb_build_object('type','system'));
    RETURN OLD;
  ELSE
    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    FOR k IN SELECT jsonb_object_keys(new_j) LOOP
      IF k = ANY(ignored) THEN CONTINUE; END IF;
      -- Skip large section_* jsonb blobs (they change constantly and are noisy)
      IF k LIKE 'section\_%' ESCAPE '\' THEN CONTINUE; END IF;
      IF (old_j->k) IS DISTINCT FROM (new_j->k) THEN
        changes := changes || jsonb_build_object(k, jsonb_build_object('from', old_j->k, 'to', new_j->k));
      END IF;
    END LOOP;
    IF changes = '{}'::jsonb THEN RETURN NEW; END IF;

    -- Build human-readable action label
    IF changes ? 'status' OR changes ? 'dossier_status' THEN
      act := 'Status geändert';
    ELSIF changes ? 'quick_check_status' THEN
      act := 'Quick-Check aktualisiert';
    ELSIF changes ? 'assigned_to' THEN
      act := 'Zuständigkeit geändert';
    ELSIF changes ? 'purchase_price' OR changes ? 'loan_amount' OR changes ? 'equity' OR changes ? 'property_value' THEN
      act := 'Finanzierungswerte angepasst';
    ELSE
      SELECT string_agg(COALESCE(field_labels->>key, key), ', ')
        INTO human_field
      FROM jsonb_object_keys(changes) key;
      act := 'Aktualisiert: ' || COALESCE(human_field, '');
    END IF;

    INSERT INTO public.activity_logs (action, related_type, related_id, actor_id, metadata)
    VALUES (act, 'financing_dossier', NEW.id, auth.uid(),
            jsonb_build_object('type','system','changes', changes));
    RETURN NEW;
  END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_financing_dossier_change ON public.financing_dossiers;
CREATE TRIGGER trg_log_financing_dossier_change
AFTER INSERT OR UPDATE OR DELETE ON public.financing_dossiers
FOR EACH ROW EXECUTE FUNCTION public.tg_log_financing_dossier_change();
