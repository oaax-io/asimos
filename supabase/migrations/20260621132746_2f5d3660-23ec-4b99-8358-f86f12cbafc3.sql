WITH calc AS (
  SELECT
    d.id,
    GREATEST(COALESCE(NULLIF(d.total_investment,0), COALESCE(d.purchase_price,0) + COALESCE(d.renovation_costs,0)), 0) AS total,
    COALESCE(d.requested_mortgage,0) AS mortgage,
    COALESCE(NULLIF(d.einkommen_kombiniert,0), COALESCE(d.gross_income_yearly,0) + COALESCE(d.co_applicant_einkommen,0)) AS income,
    (
      COALESCE(d.requested_mortgage,0) * (COALESCE(d.calculated_interest_rate,5)/100)
      + COALESCE(d.ancillary_costs_yearly,
          COALESCE(NULLIF(d.total_investment,0), COALESCE(d.purchase_price,0) + COALESCE(d.renovation_costs,0)) * 0.01)
      + COALESCE(d.amortisation_yearly,0)
    ) AS yearly
  FROM public.financing_dossiers d
  WHERE d.quick_check_status IS NOT NULL
    AND d.quick_check_status::text <> 'incomplete'
    AND (
      (d.financing_modules IS NOT NULL
        AND NOT ('purchase' = ANY(d.financing_modules) OR 'new_build' = ANY(d.financing_modules))
        AND ('refinance' = ANY(d.financing_modules) OR 'increase' = ANY(d.financing_modules) OR 'mortgage_increase' = ANY(d.financing_modules)))
      OR (d.financing_modules IS NULL AND d.financing_type::text IN ('refinance','increase','mortgage_increase'))
    )
)
UPDATE public.financing_dossiers fd
SET quick_check_status = (CASE
  WHEN c.total <= 0 OR c.mortgage <= 0 OR COALESCE(c.income,0) <= 0 THEN 'incomplete'
  WHEN (c.mortgage / c.total) * 100 > 80 THEN 'not_financeable'
  WHEN (c.yearly / c.income) * 100 > 38 THEN 'not_financeable'
  WHEN (c.yearly / c.income) * 100 > 33 THEN 'critical'
  ELSE 'realistic'
END)::financing_quick_check_status
FROM calc c
WHERE fd.id = c.id;