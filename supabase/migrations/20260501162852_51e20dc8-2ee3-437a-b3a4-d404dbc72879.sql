CREATE OR REPLACE FUNCTION public.self_disclosure_link_resolve(_token text)
RETURNS TABLE(client_id uuid, status text, client_name text, disclosure jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  link_row public.financing_links%ROWTYPE;
  disc_row public.client_self_disclosures%ROWTYPE;
  client_row public.clients%ROWTYPE;
BEGIN
  SELECT * INTO link_row FROM public.financing_links fl
    WHERE fl.token = _token AND fl.link_type = 'self_disclosure' LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'invalid'::text, NULL::text, '{}'::jsonb;
    RETURN;
  END IF;
  IF link_row.expires_at < now() THEN
    RETURN QUERY SELECT link_row.client_id, 'expired'::text, NULL::text, '{}'::jsonb;
    RETURN;
  END IF;
  IF link_row.used_at IS NOT NULL THEN
    RETURN QUERY SELECT link_row.client_id, 'submitted'::text, NULL::text, '{}'::jsonb;
    RETURN;
  END IF;

  SELECT * INTO client_row FROM public.clients c WHERE c.id = link_row.client_id;
  SELECT * INTO disc_row FROM public.client_self_disclosures csd WHERE csd.client_id = link_row.client_id;

  RETURN QUERY SELECT
    link_row.client_id,
    'open'::text,
    client_row.full_name,
    COALESCE(to_jsonb(disc_row), '{}'::jsonb);
END;
$function$;