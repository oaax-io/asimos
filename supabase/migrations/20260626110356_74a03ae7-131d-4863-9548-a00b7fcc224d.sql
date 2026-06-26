
CREATE OR REPLACE FUNCTION public.self_disclosure_link_submit_full(
  _token text,
  _coapplicants jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  link_row public.financing_links%ROWTYPE;
  primary_client public.clients%ROWTYPE;
  item jsonb;
  new_client_id uuid;
  full_nm text;
  rel text;
BEGIN
  SELECT * INTO link_row FROM public.financing_links
    WHERE token = _token AND link_type = 'self_disclosure' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF link_row.expires_at < now() THEN RAISE EXCEPTION 'expired_token'; END IF;
  IF link_row.used_at IS NOT NULL THEN RAISE EXCEPTION 'already_submitted'; END IF;

  SELECT * INTO primary_client FROM public.clients WHERE id = link_row.client_id;

  -- Create co-applicants
  IF _coapplicants IS NOT NULL AND jsonb_typeof(_coapplicants) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(_coapplicants) LOOP
      full_nm := trim(COALESCE(item->>'first_name', '') || ' ' || COALESCE(item->>'last_name', ''));
      IF full_nm = '' THEN CONTINUE; END IF;

      rel := COALESCE(item->>'relationship_type', 'co_applicant');
      IF rel NOT IN ('spouse','co_applicant','co_investor','other') THEN
        rel := 'co_applicant';
      END IF;

      INSERT INTO public.clients (
        agency_id, owner_id, assigned_to, full_name, email, phone,
        address, postal_code, city, country, client_type, status, entity_type, notes
      ) VALUES (
        primary_client.agency_id,
        primary_client.owner_id,
        primary_client.assigned_to,
        full_nm,
        NULLIF(item->>'email',''),
        NULLIF(item->>'phone',''),
        NULLIF(trim(COALESCE(item->>'street','') || ' ' || COALESCE(item->>'street_number','')), ''),
        NULLIF(item->>'postal_code',''),
        NULLIF(item->>'city',''),
        COALESCE(NULLIF(item->>'country',''), 'CH'),
        primary_client.client_type,
        'entwurf'::client_status,
        'person',
        'Erfasst über Selbstauskunft-Link von ' || COALESCE(primary_client.full_name, 'Hauptantragsteller')
      ) RETURNING id INTO new_client_id;

      INSERT INTO public.client_self_disclosures (
        client_id, status, submitted_at,
        salutation, first_name, last_name, birth_name, birth_date, nationality, marital_status,
        email, phone, mobile, street, street_number, postal_code, city, country,
        employment_status, employer_name, employed_as, employed_since,
        salary_net_monthly, additional_income, income_job_two, income_rental,
        mortgage_expense, rent_expense, leasing_expense, credit_expense,
        life_insurance_expense, alimony_expense, health_insurance_expense, property_insurance_expense,
        utilities_expense, telecom_expense, living_costs_expense, taxes_expense, miscellaneous_expense
      ) VALUES (
        new_client_id, 'submitted', now(),
        item->>'salutation', item->>'first_name', item->>'last_name', item->>'birth_name',
        NULLIF(item->>'birth_date','')::date, item->>'nationality', item->>'marital_status',
        item->>'email', item->>'phone', item->>'mobile',
        item->>'street', item->>'street_number', item->>'postal_code', item->>'city', item->>'country',
        item->>'employment_status', item->>'employer_name', item->>'employed_as',
        NULLIF(item->>'employed_since','')::date,
        NULLIF(item->>'salary_net_monthly','')::numeric,
        NULLIF(item->>'additional_income','')::numeric,
        NULLIF(item->>'income_job_two','')::numeric,
        NULLIF(item->>'income_rental','')::numeric,
        NULLIF(item->>'mortgage_expense','')::numeric,
        NULLIF(item->>'rent_expense','')::numeric,
        NULLIF(item->>'leasing_expense','')::numeric,
        NULLIF(item->>'credit_expense','')::numeric,
        NULLIF(item->>'life_insurance_expense','')::numeric,
        NULLIF(item->>'alimony_expense','')::numeric,
        NULLIF(item->>'health_insurance_expense','')::numeric,
        NULLIF(item->>'property_insurance_expense','')::numeric,
        NULLIF(item->>'utilities_expense','')::numeric,
        NULLIF(item->>'telecom_expense','')::numeric,
        NULLIF(item->>'living_costs_expense','')::numeric,
        NULLIF(item->>'taxes_expense','')::numeric,
        NULLIF(item->>'miscellaneous_expense','')::numeric
      );

      INSERT INTO public.client_relationships (client_id, related_client_id, relationship_type, notes)
      VALUES (primary_client.id, new_client_id, rel::client_relationship_type,
              'Über Selbstauskunft-Link erfasst');
    END LOOP;
  END IF;

  -- Submit primary
  UPDATE public.client_self_disclosures
    SET status = 'submitted', submitted_at = now(), updated_at = now()
    WHERE client_id = link_row.client_id;

  UPDATE public.financing_links SET used_at = now() WHERE id = link_row.id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.self_disclosure_link_submit_full(text, jsonb) TO anon, authenticated;
