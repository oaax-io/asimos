CREATE TABLE public.trash_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  label text,
  subtitle text,
  payload jsonb NOT NULL,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trash_items TO authenticated;
GRANT ALL ON public.trash_items TO service_role;

ALTER TABLE public.trash_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trash_items_select" ON public.trash_items FOR SELECT TO authenticated
  USING (agency_id = public.current_agency_id() OR public.is_superadmin());
CREATE POLICY "trash_items_insert" ON public.trash_items FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_agency_id() OR public.is_superadmin());
CREATE POLICY "trash_items_update" ON public.trash_items FOR UPDATE TO authenticated
  USING (agency_id = public.current_agency_id() OR public.is_superadmin());
CREATE POLICY "trash_items_delete" ON public.trash_items FOR DELETE TO authenticated
  USING (agency_id = public.current_agency_id() OR public.is_superadmin());

CREATE INDEX idx_trash_items_agency ON public.trash_items (agency_id, deleted_at DESC);

CREATE OR REPLACE FUNCTION public.trash_restore(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item public.trash_items%ROWTYPE;
  _allowed text[] := ARRAY['properties','clients','leads','tasks','appointments','documents','mandates','reservations','checklists','nda_agreements','financing_dossiers','property_media','generated_documents','client_financial_items','matches'];
BEGIN
  SELECT * INTO _item FROM public.trash_items WHERE id = _id;
  IF _item.id IS NULL THEN
    RAISE EXCEPTION 'Eintrag nicht gefunden';
  END IF;
  IF _item.agency_id IS DISTINCT FROM public.current_agency_id() AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  IF NOT (_item.table_name = ANY(_allowed)) THEN
    RAISE EXCEPTION 'Wiederherstellung für % nicht unterstützt', _item.table_name;
  END IF;

  EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1) ON CONFLICT (id) DO NOTHING', _item.table_name, _item.table_name)
    USING _item.payload;

  DELETE FROM public.trash_items WHERE id = _id;
END;
$$;