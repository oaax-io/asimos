
ALTER TABLE public.nda_agreements ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.nda_agreements ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.nda_agreements ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS nda_agreements_access ON public.nda_agreements;

CREATE POLICY "nda_select" ON public.nda_agreements FOR SELECT
  USING (
    is_manager_or_above()
    OR created_by = auth.uid()
    OR (client_id IS NOT NULL AND can_access_client(client_id))
    OR (property_id IS NOT NULL AND can_access_property(property_id))
  );

CREATE POLICY "nda_insert" ON public.nda_agreements FOR INSERT
  WITH CHECK (
    is_manager_or_above()
    OR created_by = auth.uid()
    OR (client_id IS NOT NULL AND can_access_client(client_id))
    OR (property_id IS NOT NULL AND can_access_property(property_id))
  );

CREATE POLICY "nda_update" ON public.nda_agreements FOR UPDATE
  USING (
    is_manager_or_above()
    OR created_by = auth.uid()
    OR (client_id IS NOT NULL AND can_access_client(client_id))
    OR (property_id IS NOT NULL AND can_access_property(property_id))
  );

-- Only managers/admins/owners/superadmins may delete NDAs
CREATE POLICY "nda_delete_managers_only" ON public.nda_agreements FOR DELETE
  USING (is_manager_or_above());
