CREATE OR REPLACE FUNCTION public.can_see_profile(_profile_id uuid, _profile_agency uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _profile_id = auth.uid()
    OR (_profile_agency IS NOT NULL AND _profile_agency = public.current_agency_id())
    OR EXISTS (SELECT 1 FROM public.agency_memberships m
               WHERE m.user_id = _profile_id AND m.is_active AND m.agency_id = public.current_agency_id())
  );
$$;

CREATE OR REPLACE FUNCTION public.bank_package_share_active(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bank_package_shares s JOIN public.financing_dossiers d ON d.id = s.dossier_id
                 WHERE s.token = _token AND public.agency_is_active(d.agency_id));
$$;
REVOKE ALL ON FUNCTION public.bank_package_share_active(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_package_share_active(text) TO service_role;

DO $$
DECLARE r record; def text; newdef text;
  subs text[][] := ARRAY[
    ['financing_link_resolve','WHERE token = _token LIMIT 1','WHERE token = _token AND public.agency_is_active(financing_links.agency_id) LIMIT 1'],
    ['financing_link_save','WHERE token = _token LIMIT 1','WHERE token = _token AND public.agency_is_active(financing_links.agency_id) LIMIT 1'],
    ['financing_link_submit','WHERE token = _token LIMIT 1','WHERE token = _token AND public.agency_is_active(financing_links.agency_id) LIMIT 1'],
    ['self_disclosure_link_resolve','WHERE fl.token = _token AND','WHERE fl.token = _token AND public.agency_is_active(fl.agency_id) AND'],
    ['self_disclosure_link_save','WHERE token = _token AND link_type','WHERE token = _token AND public.agency_is_active(financing_links.agency_id) AND link_type'],
    ['self_disclosure_link_submit','WHERE token = _token AND link_type','WHERE token = _token AND public.agency_is_active(financing_links.agency_id) AND link_type'],
    ['self_disclosure_link_submit_full','WHERE token = _token AND link_type','WHERE token = _token AND public.agency_is_active(financing_links.agency_id) AND link_type'],
    ['public_property_view','WHERE public_token = _token AND public_enabled = true','WHERE public_token = _token AND public_enabled = true AND public.agency_is_active(properties.agency_id)'],
    ['bank_package_share_resolve','  b := COALESCE(', E'  IF a IS NULL OR NOT public.agency_is_active(a) THEN\n    RETURN QUERY SELECT ''invalid''::text, NULL::text, NULL::text, NULL::bigint, NULL::int, NULL::timestamptz, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;\n    RETURN;\n  END IF;\n  b := COALESCE(']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(subs,1) LOOP
    SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p WHERE p.proname = subs[i][1] AND p.pronamespace = 'public'::regnamespace;
    IF def IS NULL OR position(subs[i][2] in def) = 0 THEN RAISE EXCEPTION 'pattern not found in %', subs[i][1]; END IF;
    IF position('agency_is_active' in def) > 0 THEN CONTINUE; END IF;
    newdef := regexp_replace(def, regexp_replace(subs[i][2], '([().*+?\[\]\\|^$])', '\\\1', 'g'), replace(subs[i][3], '\', '\\'));
    EXECUTE newdef;
  END LOOP;
END $$;