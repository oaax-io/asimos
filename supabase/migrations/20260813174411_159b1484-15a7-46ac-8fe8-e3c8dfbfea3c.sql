CREATE TABLE public.search_profile_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.client_search_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_profile_subscriptions TO authenticated;
GRANT ALL ON public.search_profile_subscriptions TO service_role;

ALTER TABLE public.search_profile_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view subscriptions"
  ON public.search_profile_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own subscriptions insert"
  ON public.search_profile_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own subscriptions delete"
  ON public.search_profile_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_notify_search_profile_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p record;
  sub record;
  price numeric;
  cname text;
BEGIN
  IF NEW.status NOT IN ('available','active','preparation') OR COALESCE(NEW.is_unit,false) THEN
    RETURN NEW;
  END IF;

  price := COALESCE(NEW.price, NEW.rent);

  FOR p IN
    SELECT sp.*, c.full_name
    FROM public.client_search_profiles sp
    JOIN public.clients c ON c.id = sp.client_id
    WHERE sp.is_active = true
  LOOP
    IF p.listing_type IS NOT NULL AND p.listing_type <> NEW.listing_type THEN CONTINUE; END IF;
    IF p.budget_min IS NOT NULL AND (price IS NULL OR price < p.budget_min) THEN CONTINUE; END IF;
    IF p.budget_max IS NOT NULL AND (price IS NULL OR price > p.budget_max) THEN CONTINUE; END IF;
    IF p.rooms_min IS NOT NULL AND (NEW.rooms IS NULL OR NEW.rooms < p.rooms_min) THEN CONTINUE; END IF;
    IF p.area_min IS NOT NULL AND (COALESCE(NEW.living_area, NEW.area) IS NULL OR COALESCE(NEW.living_area, NEW.area) < p.area_min) THEN CONTINUE; END IF;
    IF p.area_max IS NOT NULL AND (COALESCE(NEW.living_area, NEW.area) IS NULL OR COALESCE(NEW.living_area, NEW.area) > p.area_max) THEN CONTINUE; END IF;
    IF p.preferred_property_types IS NOT NULL AND array_length(p.preferred_property_types, 1) > 0
       AND NOT (NEW.property_type::text = ANY(p.preferred_property_types)) THEN CONTINUE; END IF;
    IF p.preferred_cities IS NOT NULL AND array_length(p.preferred_cities, 1) > 0
       AND NOT EXISTS (
         SELECT 1 FROM unnest(p.preferred_cities) ct
         WHERE lower(COALESCE(NEW.city,'')) LIKE '%' || lower(ct) || '%'
       ) THEN CONTINUE; END IF;

    cname := COALESCE(p.full_name, 'Suchprofil');

    FOR sub IN SELECT user_id FROM public.search_profile_subscriptions WHERE profile_id = p.id LOOP
      IF sub.user_id = auth.uid() THEN CONTINUE; END IF;
      PERFORM public.create_notification(
        sub.user_id,
        'match',
        'Neuer Treffer für Suchprofil',
        COALESCE(NEW.title, 'Immobilie') || ' passt zum Suchprofil von ' || cname,
        '/properties/' || NEW.id::text,
        'property',
        NEW.id
      );
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_search_profile_matches ON public.properties;
CREATE TRIGGER trg_notify_search_profile_matches
AFTER INSERT OR UPDATE OF status, price, rent, rooms, living_area, area, city, property_type, listing_type
ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_search_profile_matches();