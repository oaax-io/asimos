DROP POLICY "Manage commission records" ON public.commission_records;
CREATE POLICY "Insert commission records" ON public.commission_records FOR INSERT TO authenticated WITH CHECK (is_manager_or_above() OR can_access_property(property_id));
CREATE POLICY "Update commission records" ON public.commission_records FOR UPDATE TO authenticated USING (is_manager_or_above() OR can_access_property(property_id)) WITH CHECK (is_manager_or_above() OR can_access_property(property_id));
CREATE POLICY "Delete commission records" ON public.commission_records FOR DELETE TO authenticated USING (is_manager_or_above() OR can_access_property(property_id));

DROP POLICY "Manage commission record splits" ON public.commission_record_splits;
CREATE POLICY "Insert commission record splits" ON public.commission_record_splits FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.commission_records r WHERE r.id = commission_record_id AND (is_manager_or_above() OR can_access_property(r.property_id))));
CREATE POLICY "Update commission record splits" ON public.commission_record_splits FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.commission_records r WHERE r.id = commission_record_id AND (is_manager_or_above() OR can_access_property(r.property_id))));
CREATE POLICY "Delete commission record splits" ON public.commission_record_splits FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.commission_records r WHERE r.id = commission_record_id AND (is_manager_or_above() OR can_access_property(r.property_id))));