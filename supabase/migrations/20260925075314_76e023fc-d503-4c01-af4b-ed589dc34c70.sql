CREATE OR REPLACE FUNCTION public.can_access_client(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = _client_id AND public.is_agency_member(c.agency_id));
$$;
CREATE OR REPLACE FUNCTION public.can_access_property(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = _property_id AND public.is_agency_member(p.agency_id));
$$;