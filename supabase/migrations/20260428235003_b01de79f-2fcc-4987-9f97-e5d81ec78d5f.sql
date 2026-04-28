-- 1) client_self_disclosures: Status + Eindeutigkeit
ALTER TABLE public.client_self_disclosures
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_self_disclosures_client_id_key'
  ) THEN
    ALTER TABLE public.client_self_disclosures
      ADD CONSTRAINT client_self_disclosures_client_id_key UNIQUE (client_id);
  END IF;
END$$;

-- 2) financing_profiles erweitern
ALTER TABLE public.financing_profiles
  ADD COLUMN IF NOT EXISTS bank_type text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS bank_email text,
  ADD COLUMN IF NOT EXISTS bank_phone text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS profile_status text NOT NULL DEFAULT 'incomplete';

-- 3) financing_links: link_type + optionale client_id
ALTER TABLE public.financing_links
  ADD COLUMN IF NOT EXISTS link_type text NOT NULL DEFAULT 'financing',
  ADD COLUMN IF NOT EXISTS client_id uuid;

ALTER TABLE public.financing_links
  ALTER COLUMN dossier_id DROP NOT NULL;

-- 4) Public RPCs für Selbstauskunft via Token
CREATE OR REPLACE FUNCTION public.self_disclosure_link_resolve(_token text)
RETURNS TABLE(
  client_id uuid,
  status text,
  client_name text,
  disclosure jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.financing_links%ROWTYPE;
  disc_row public.client_self_disclosures%ROWTYPE;
  client_row public.clients%ROWTYPE;
BEGIN
  SELECT * INTO link_row FROM public.financing_links
    WHERE token = _token AND link_type = 'self_disclosure' LIMIT 1;
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

  SELECT * INTO client_row FROM public.clients WHERE id = link_row.client_id;
  SELECT * INTO disc_row FROM public.client_self_disclosures WHERE client_id = link_row.client_id;

  RETURN QUERY SELECT
    link_row.client_id,
    'open'::text,
    client_row.full_name,
    COALESCE(to_jsonb(disc_row), '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.self_disclosure_link_save(_token text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.financing_links%ROWTYPE;
BEGIN
  SELECT * INTO link_row FROM public.financing_links
    WHERE token = _token AND link_type = 'self_disclosure' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF link_row.expires_at < now() THEN RAISE EXCEPTION 'expired_token'; END IF;
  IF link_row.used_at IS NOT NULL THEN RAISE EXCEPTION 'already_submitted'; END IF;

  INSERT INTO public.client_self_disclosures (client_id, status)
    VALUES (link_row.client_id, 'sent')
  ON CONFLICT (client_id) DO NOTHING;

  UPDATE public.client_self_disclosures
  SET
    salutation             = COALESCE(_payload->>'salutation', salutation),
    first_name             = COALESCE(_payload->>'first_name', first_name),
    last_name              = COALESCE(_payload->>'last_name', last_name),
    birth_name             = COALESCE(_payload->>'birth_name', birth_name),
    birth_date             = COALESCE((_payload->>'birth_date')::date, birth_date),
    nationality            = COALESCE(_payload->>'nationality', nationality),
    marital_status         = COALESCE(_payload->>'marital_status', marital_status),
    email                  = COALESCE(_payload->>'email', email),
    phone                  = COALESCE(_payload->>'phone', phone),
    mobile                 = COALESCE(_payload->>'mobile', mobile),
    street                 = COALESCE(_payload->>'street', street),
    street_number          = COALESCE(_payload->>'street_number', street_number),
    postal_code            = COALESCE(_payload->>'postal_code', postal_code),
    city                   = COALESCE(_payload->>'city', city),
    country                = COALESCE(_payload->>'country', country),
    employment_status      = COALESCE(_payload->>'employment_status', employment_status),
    employer_name          = COALESCE(_payload->>'employer_name', employer_name),
    employed_as            = COALESCE(_payload->>'employed_as', employed_as),
    employed_since         = COALESCE((_payload->>'employed_since')::date, employed_since),
    salary_net_monthly     = COALESCE((_payload->>'salary_net_monthly')::numeric, salary_net_monthly),
    additional_income      = COALESCE((_payload->>'additional_income')::numeric, additional_income),
    income_job_two         = COALESCE((_payload->>'income_job_two')::numeric, income_job_two),
    income_rental          = COALESCE((_payload->>'income_rental')::numeric, income_rental),
    mortgage_expense       = COALESCE((_payload->>'mortgage_expense')::numeric, mortgage_expense),
    rent_expense           = COALESCE((_payload->>'rent_expense')::numeric, rent_expense),
    leasing_expense        = COALESCE((_payload->>'leasing_expense')::numeric, leasing_expense),
    credit_expense         = COALESCE((_payload->>'credit_expense')::numeric, credit_expense),
    life_insurance_expense = COALESCE((_payload->>'life_insurance_expense')::numeric, life_insurance_expense),
    alimony_expense        = COALESCE((_payload->>'alimony_expense')::numeric, alimony_expense),
    health_insurance_expense   = COALESCE((_payload->>'health_insurance_expense')::numeric, health_insurance_expense),
    property_insurance_expense = COALESCE((_payload->>'property_insurance_expense')::numeric, property_insurance_expense),
    utilities_expense      = COALESCE((_payload->>'utilities_expense')::numeric, utilities_expense),
    telecom_expense        = COALESCE((_payload->>'telecom_expense')::numeric, telecom_expense),
    living_costs_expense   = COALESCE((_payload->>'living_costs_expense')::numeric, living_costs_expense),
    taxes_expense          = COALESCE((_payload->>'taxes_expense')::numeric, taxes_expense),
    miscellaneous_expense  = COALESCE((_payload->>'miscellaneous_expense')::numeric, miscellaneous_expense),
    updated_at = now()
  WHERE client_id = link_row.client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.self_disclosure_link_submit(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.financing_links%ROWTYPE;
BEGIN
  SELECT * INTO link_row FROM public.financing_links
    WHERE token = _token AND link_type = 'self_disclosure' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF link_row.expires_at < now() THEN RAISE EXCEPTION 'expired_token'; END IF;
  IF link_row.used_at IS NOT NULL THEN RAISE EXCEPTION 'already_submitted'; END IF;

  UPDATE public.client_self_disclosures
    SET status = 'submitted', submitted_at = now(), updated_at = now()
    WHERE client_id = link_row.client_id;

  UPDATE public.financing_links SET used_at = now() WHERE id = link_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_disclosure_link_resolve(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_disclosure_link_save(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_disclosure_link_submit(text) TO anon, authenticated;