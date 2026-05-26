DROP POLICY IF EXISTS properties_select ON public.properties;
CREATE POLICY properties_select ON public.properties
FOR SELECT TO authenticated
USING (true);