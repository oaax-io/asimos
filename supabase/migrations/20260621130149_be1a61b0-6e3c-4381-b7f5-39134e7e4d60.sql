UPDATE public.clients c
SET full_name = TRIM(COALESCE(csd.first_name,'') || ' ' || COALESCE(csd.last_name,'')),
    contact_first_name = csd.first_name,
    contact_last_name = csd.last_name,
    updated_at = now()
FROM public.client_self_disclosures csd
WHERE csd.client_id = c.id
  AND csd.first_name IS NOT NULL
  AND csd.last_name IS NOT NULL
  AND length(trim(csd.first_name)) > 1
  AND length(trim(csd.last_name)) > 0
  AND (
    c.full_name IS NULL
    OR length(c.full_name) < length(trim(csd.first_name) || ' ' || trim(csd.last_name))
    OR c.full_name !~* ('^' || regexp_replace(trim(csd.first_name), '[^a-zA-ZäöüÄÖÜßéèà ]', '', 'g'))
  );