CREATE OR REPLACE FUNCTION public.tenant_subdomain_root()
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT 'immolia.ch'::text $$;