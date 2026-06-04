-- Mediathek soll für alle authentifizierten Nutzer zentral lesbar sein.
-- Bilder bleiben mit Objekten verknüpft, aber jede:r darf sie sehen.
DROP POLICY IF EXISTS property_media_select ON public.property_media;
CREATE POLICY property_media_select_all_authenticated
  ON public.property_media
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE bleiben an Objektzugriff gebunden (unverändert).