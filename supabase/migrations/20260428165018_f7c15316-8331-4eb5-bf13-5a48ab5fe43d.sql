-- Erweitere resolve um Dossier-Inhalte
DROP FUNCTION IF EXISTS public.financing_link_resolve(text);

CREATE OR REPLACE FUNCTION public.financing_link_resolve(_token text)
RETURNS TABLE (
  dossier_id uuid,
  status text,
  client_name text,
  completion_percent integer,
  section_customer jsonb,
  section_financing jsonb,
  section_property_docs jsonb,
  section_income jsonb,
  section_tax jsonb,
  section_self_employed jsonb,
  section_affordability jsonb,
  section_additional jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.financing_links%ROWTYPE;
  dossier_row public.financing_dossiers%ROWTYPE;
  client_row public.clients%ROWTYPE;
BEGIN
  SELECT * INTO link_row FROM public.financing_links WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'invalid'::text, NULL::text, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb;
    RETURN;
  END IF;
  IF link_row.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, 'expired'::text, NULL::text, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb;
    RETURN;
  END IF;
  IF link_row.used_at IS NOT NULL THEN
    RETURN QUERY SELECT link_row.dossier_id, 'submitted'::text, NULL::text, 100, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb;
    RETURN;
  END IF;

  SELECT * INTO dossier_row FROM public.financing_dossiers WHERE id = link_row.dossier_id;
  SELECT * INTO client_row FROM public.clients WHERE id = dossier_row.client_id;

  RETURN QUERY SELECT
    dossier_row.id,
    'open'::text,
    client_row.full_name,
    dossier_row.completion_percent,
    dossier_row.section_customer,
    dossier_row.section_financing,
    dossier_row.section_property_docs,
    dossier_row.section_income,
    dossier_row.section_tax,
    dossier_row.section_self_employed,
    dossier_row.section_affordability,
    dossier_row.section_additional;
END;
$$;

GRANT EXECUTE ON FUNCTION public.financing_link_resolve(text) TO anon, authenticated;

-- Speichert Sektionen über den Token (kein Auth nötig)
CREATE OR REPLACE FUNCTION public.financing_link_save(
  _token text,
  _payload jsonb,
  _completion integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.financing_links%ROWTYPE;
BEGIN
  SELECT * INTO link_row FROM public.financing_links WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF link_row.expires_at < now() THEN RAISE EXCEPTION 'expired_token'; END IF;
  IF link_row.used_at IS NOT NULL THEN RAISE EXCEPTION 'already_submitted'; END IF;

  UPDATE public.financing_dossiers SET
    section_customer       = COALESCE(_payload->'section_customer',       section_customer),
    section_financing      = COALESCE(_payload->'section_financing',      section_financing),
    section_property_docs  = COALESCE(_payload->'section_property_docs',  section_property_docs),
    section_income         = COALESCE(_payload->'section_income',         section_income),
    section_tax            = COALESCE(_payload->'section_tax',            section_tax),
    section_self_employed  = COALESCE(_payload->'section_self_employed',  section_self_employed),
    section_affordability  = COALESCE(_payload->'section_affordability',  section_affordability),
    section_additional     = COALESCE(_payload->'section_additional',     section_additional),
    completion_percent     = GREATEST(0, LEAST(100, _completion)),
    updated_at             = now()
  WHERE id = link_row.dossier_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.financing_link_save(text, jsonb, integer) TO anon, authenticated;

-- Einreichen
CREATE OR REPLACE FUNCTION public.financing_link_submit(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.financing_links%ROWTYPE;
BEGIN
  SELECT * INTO link_row FROM public.financing_links WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF link_row.expires_at < now() THEN RAISE EXCEPTION 'expired_token'; END IF;
  IF link_row.used_at IS NOT NULL THEN RAISE EXCEPTION 'already_submitted'; END IF;

  UPDATE public.financing_dossiers
    SET status = 'submitted', submitted_at = now(), completion_percent = 100, updated_at = now()
  WHERE id = link_row.dossier_id;

  UPDATE public.financing_links SET used_at = now() WHERE id = link_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.financing_link_submit(text) TO anon, authenticated;