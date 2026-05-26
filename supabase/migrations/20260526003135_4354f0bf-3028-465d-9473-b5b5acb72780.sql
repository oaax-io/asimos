
-- Generic property change logger -------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_log_property_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  old_j jsonb;
  new_j jsonb;
  k text;
  ignored text[] := ARRAY['updated_at','created_at','id'];
  act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (action, related_type, related_id, actor_id, metadata)
    VALUES ('Immobilie erstellt', 'property', NEW.id, auth.uid(),
            jsonb_build_object('title', NEW.title, 'status', NEW.status));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (action, related_type, related_id, actor_id, metadata)
    VALUES ('Immobilie gelöscht', 'property', OLD.id, auth.uid(),
            jsonb_build_object('title', OLD.title));
    RETURN OLD;
  ELSE
    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    FOR k IN SELECT jsonb_object_keys(new_j) LOOP
      IF k = ANY(ignored) THEN CONTINUE; END IF;
      IF (old_j->k) IS DISTINCT FROM (new_j->k) THEN
        changes := changes || jsonb_build_object(k, jsonb_build_object('from', old_j->k, 'to', new_j->k));
      END IF;
    END LOOP;
    IF changes = '{}'::jsonb THEN RETURN NEW; END IF;

    act := 'Immobilie aktualisiert';
    IF changes ? 'status' THEN act := 'Status geändert'; END IF;
    IF changes ? 'price' OR changes ? 'rent' THEN act := 'Preis geändert'; END IF;
    IF changes ? 'assigned_to' THEN act := 'Zuständigkeit geändert'; END IF;
    IF changes ? 'images' THEN act := 'Bilder aktualisiert'; END IF;

    INSERT INTO public.activity_logs (action, related_type, related_id, actor_id, metadata)
    VALUES (act, 'property', NEW.id, auth.uid(),
            jsonb_build_object('changes', changes));
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS log_properties_change ON public.properties;
CREATE TRIGGER log_properties_change
AFTER INSERT OR UPDATE OR DELETE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.tg_log_property_change();

-- Generic related-table logger ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_log_property_related()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  label text := TG_ARGV[0];
  changes jsonb := '{}'::jsonb;
  old_j jsonb;
  new_j jsonb;
  k text;
  ignored text[] := ARRAY['updated_at','created_at','id'];
  act text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := (to_jsonb(OLD)->>'property_id')::uuid;
    IF pid IS NULL THEN RETURN OLD; END IF;
    INSERT INTO public.activity_logs (action, related_type, related_id, actor_id, metadata)
    VALUES (label || ' entfernt', 'property', pid, auth.uid(),
            jsonb_build_object('snapshot', to_jsonb(OLD)));
    RETURN OLD;
  END IF;

  pid := (to_jsonb(NEW)->>'property_id')::uuid;
  IF pid IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (action, related_type, related_id, actor_id, metadata)
    VALUES (label || ' hinzugefügt', 'property', pid, auth.uid(),
            jsonb_build_object('snapshot', to_jsonb(NEW)));
    RETURN NEW;
  END IF;

  -- UPDATE
  old_j := to_jsonb(OLD);
  new_j := to_jsonb(NEW);
  FOR k IN SELECT jsonb_object_keys(new_j) LOOP
    IF k = ANY(ignored) THEN CONTINUE; END IF;
    IF (old_j->k) IS DISTINCT FROM (new_j->k) THEN
      changes := changes || jsonb_build_object(k, jsonb_build_object('from', old_j->k, 'to', new_j->k));
    END IF;
  END LOOP;
  IF changes = '{}'::jsonb THEN RETURN NEW; END IF;

  act := label || ' aktualisiert';
  IF changes ? 'status' THEN act := label || ' – Status geändert'; END IF;

  INSERT INTO public.activity_logs (action, related_type, related_id, actor_id, metadata)
  VALUES (act, 'property', pid, auth.uid(),
          jsonb_build_object('changes', changes));
  RETURN NEW;
END;
$$;

-- Attach to related tables
DROP TRIGGER IF EXISTS log_property_media_change ON public.property_media;
CREATE TRIGGER log_property_media_change
AFTER INSERT OR UPDATE OR DELETE ON public.property_media
FOR EACH ROW EXECUTE FUNCTION public.tg_log_property_related('Medium');

DROP TRIGGER IF EXISTS log_property_reservation_change ON public.reservations;
CREATE TRIGGER log_property_reservation_change
AFTER INSERT OR UPDATE OR DELETE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.tg_log_property_related('Reservation');

DROP TRIGGER IF EXISTS log_property_mandate_change ON public.mandates;
CREATE TRIGGER log_property_mandate_change
AFTER INSERT OR UPDATE OR DELETE ON public.mandates
FOR EACH ROW EXECUTE FUNCTION public.tg_log_property_related('Mandat');

DROP TRIGGER IF EXISTS log_property_appointment_change ON public.appointments;
CREATE TRIGGER log_property_appointment_change
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.tg_log_property_related('Termin');

DROP TRIGGER IF EXISTS log_property_ownership_change ON public.property_ownerships;
CREATE TRIGGER log_property_ownership_change
AFTER INSERT OR UPDATE OR DELETE ON public.property_ownerships
FOR EACH ROW EXECUTE FUNCTION public.tg_log_property_related('Eigentümer');

DROP TRIGGER IF EXISTS log_property_market_analysis_change ON public.property_market_analyses;
CREATE TRIGGER log_property_market_analysis_change
AFTER INSERT OR UPDATE OR DELETE ON public.property_market_analyses
FOR EACH ROW EXECUTE FUNCTION public.tg_log_property_related('Marktanalyse');

DROP TRIGGER IF EXISTS log_property_nda_change ON public.nda_agreements;
CREATE TRIGGER log_property_nda_change
AFTER INSERT OR UPDATE OR DELETE ON public.nda_agreements
FOR EACH ROW EXECUTE FUNCTION public.tg_log_property_related('NDA');

DROP TRIGGER IF EXISTS log_property_financing_change ON public.financing_dossiers;
CREATE TRIGGER log_property_financing_change
AFTER INSERT OR UPDATE OR DELETE ON public.financing_dossiers
FOR EACH ROW EXECUTE FUNCTION public.tg_log_property_related('Finanzierungsdossier');
