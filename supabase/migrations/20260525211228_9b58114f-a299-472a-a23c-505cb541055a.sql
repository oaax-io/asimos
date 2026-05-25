-- 1) Vereinheitlichte Rollenprüfung: is_owner_or_admin nutzt user_roles
CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner'::public.app_role, 'admin'::public.app_role, 'superadmin'::public.app_role)
  )
$$;

-- 2) Helferfunktion: Zugriff auf eine Immobilie
CREATE OR REPLACE FUNCTION public.can_access_property(_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_manager_or_above() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id
      AND (
        p.owner_id = auth.uid()
        OR p.assigned_to = auth.uid()
        OR (p.owner_client_id IS NOT NULL AND public.can_access_client(p.owner_client_id))
      )
  )
$$;

-- 3) EXECUTE für anonyme/öffentliche Aufrufer entziehen
REVOKE EXECUTE ON FUNCTION public.is_owner_or_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager_or_above() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_client(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_property(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_above() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_property(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- 4) Alte permissive Policies entfernen
DROP POLICY IF EXISTS activity_logs_read ON public.activity_logs;
DROP POLICY IF EXISTS appointments_authenticated_all ON public.appointments;
DROP POLICY IF EXISTS bank_accounts_authenticated_all ON public.bank_accounts;
DROP POLICY IF EXISTS checklists_authenticated_all ON public.checklists;
DROP POLICY IF EXISTS checklist_items_authenticated_all ON public.checklist_items;
DROP POLICY IF EXISTS client_children_authenticated_all ON public.client_children;
DROP POLICY IF EXISTS client_relationships_authenticated_all ON public.client_relationships;
DROP POLICY IF EXISTS client_roles_authenticated_all ON public.client_roles;
DROP POLICY IF EXISTS client_search_profiles_authenticated_all ON public.client_search_profiles;
DROP POLICY IF EXISTS client_self_disclosures_authenticated_all ON public.client_self_disclosures;
DROP POLICY IF EXISTS documents_authenticated_all ON public.documents;
DROP POLICY IF EXISTS generated_documents_authenticated_all ON public.generated_documents;
DROP POLICY IF EXISTS mandates_authenticated_all ON public.mandates;
DROP POLICY IF EXISTS matches_authenticated_all ON public.matches;
DROP POLICY IF EXISTS nda_agreements_authenticated_all ON public.nda_agreements;
DROP POLICY IF EXISTS property_ownerships_authenticated_all ON public.property_ownerships;
DROP POLICY IF EXISTS reservations_authenticated_all ON public.reservations;
DROP POLICY IF EXISTS tasks_authenticated_all ON public.tasks;

-- 5) activity_logs: Lesen nur eigene Aktionen oder Manager+
CREATE POLICY activity_logs_read ON public.activity_logs
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR public.is_manager_or_above());

-- 6) appointments
CREATE POLICY appointments_access ON public.appointments
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR assigned_to = auth.uid()
    OR owner_id = auth.uid()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR assigned_to = auth.uid()
    OR owner_id = auth.uid()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  );

-- 7) bank_accounts: nur Manager+
CREATE POLICY bank_accounts_manager_only ON public.bank_accounts
  FOR ALL TO authenticated
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());

-- 8) checklists / checklist_items
CREATE POLICY checklists_access ON public.checklists
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR (related_type = 'client'   AND related_id IS NOT NULL AND public.can_access_client(related_id))
    OR (related_type = 'property' AND related_id IS NOT NULL AND public.can_access_property(related_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR (related_type = 'client'   AND related_id IS NOT NULL AND public.can_access_client(related_id))
    OR (related_type = 'property' AND related_id IS NOT NULL AND public.can_access_property(related_id))
  );

CREATE POLICY checklist_items_access ON public.checklist_items
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_items.checklist_id
        AND (
          (c.related_type = 'client'   AND c.related_id IS NOT NULL AND public.can_access_client(c.related_id))
          OR (c.related_type = 'property' AND c.related_id IS NOT NULL AND public.can_access_property(c.related_id))
        )
    )
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_items.checklist_id
        AND (
          (c.related_type = 'client'   AND c.related_id IS NOT NULL AND public.can_access_client(c.related_id))
          OR (c.related_type = 'property' AND c.related_id IS NOT NULL AND public.can_access_property(c.related_id))
        )
    )
  );

-- 9) client_children
CREATE POLICY client_children_access ON public.client_children
  FOR ALL TO authenticated
  USING (public.can_access_client(client_id))
  WITH CHECK (public.can_access_client(client_id));

-- 10) client_relationships
CREATE POLICY client_relationships_access ON public.client_relationships
  FOR ALL TO authenticated
  USING (public.can_access_client(client_id) OR public.can_access_client(related_client_id))
  WITH CHECK (public.can_access_client(client_id) OR public.can_access_client(related_client_id));

-- 11) client_roles
CREATE POLICY client_roles_access ON public.client_roles
  FOR ALL TO authenticated
  USING (public.can_access_client(client_id))
  WITH CHECK (public.can_access_client(client_id));

-- 12) client_search_profiles
CREATE POLICY client_search_profiles_access ON public.client_search_profiles
  FOR ALL TO authenticated
  USING (public.can_access_client(client_id))
  WITH CHECK (public.can_access_client(client_id));

-- 13) client_self_disclosures
CREATE POLICY client_self_disclosures_access ON public.client_self_disclosures
  FOR ALL TO authenticated
  USING (public.can_access_client(client_id))
  WITH CHECK (public.can_access_client(client_id));

-- 14) documents
CREATE POLICY documents_access ON public.documents
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR uploaded_by = auth.uid()
    OR (related_type = 'client'   AND related_id IS NOT NULL AND public.can_access_client(related_id))
    OR (related_type = 'property' AND related_id IS NOT NULL AND public.can_access_property(related_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR uploaded_by = auth.uid()
    OR (related_type = 'client'   AND related_id IS NOT NULL AND public.can_access_client(related_id))
    OR (related_type = 'property' AND related_id IS NOT NULL AND public.can_access_property(related_id))
  );

-- 15) generated_documents
CREATE POLICY generated_documents_access ON public.generated_documents
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR created_by = auth.uid()
    OR (related_type = 'client'   AND related_id IS NOT NULL AND public.can_access_client(related_id))
    OR (related_type = 'property' AND related_id IS NOT NULL AND public.can_access_property(related_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR created_by = auth.uid()
    OR (related_type = 'client'   AND related_id IS NOT NULL AND public.can_access_client(related_id))
    OR (related_type = 'property' AND related_id IS NOT NULL AND public.can_access_property(related_id))
  );

-- 16) mandates
CREATE POLICY mandates_access ON public.mandates
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  );

-- 17) matches
CREATE POLICY matches_access ON public.matches
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  );

-- 18) nda_agreements
CREATE POLICY nda_agreements_access ON public.nda_agreements
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR created_by = auth.uid()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR created_by = auth.uid()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  );

-- 19) property_ownerships
CREATE POLICY property_ownerships_access ON public.property_ownerships
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  );

-- 20) reservations
CREATE POLICY reservations_access ON public.reservations
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR (client_id IS NOT NULL AND public.can_access_client(client_id))
    OR (property_id IS NOT NULL AND public.can_access_property(property_id))
  );

-- 21) tasks
CREATE POLICY tasks_access ON public.tasks
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_above()
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (related_type = 'client'   AND related_id IS NOT NULL AND public.can_access_client(related_id))
    OR (related_type = 'property' AND related_id IS NOT NULL AND public.can_access_property(related_id))
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (related_type = 'client'   AND related_id IS NOT NULL AND public.can_access_client(related_id))
    OR (related_type = 'property' AND related_id IS NOT NULL AND public.can_access_property(related_id))
  );

-- 22) Feedback-Storage-Bucket privat schalten und Policies härten
UPDATE storage.buckets SET public = false WHERE id = 'feedback';

DROP POLICY IF EXISTS feedback_storage_read ON storage.objects;
DROP POLICY IF EXISTS feedback_storage_insert ON storage.objects;
DROP POLICY IF EXISTS feedback_storage_delete ON storage.objects;

CREATE POLICY feedback_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.is_owner_or_admin()
      OR public.is_superadmin()
    )
  );

CREATE POLICY feedback_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY feedback_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'feedback'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.is_owner_or_admin()
      OR public.is_superadmin()
    )
  );