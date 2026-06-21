UPDATE public.financing_dossiers d
SET quick_check_status = (CASE
  WHEN COALESCE(NULLIF(d.total_investment, 0), COALESCE(d.purchase_price,0) + COALESCE(d.renovation_costs,0)) <= 0
       OR COALESCE(d.requested_mortgage,0) <= 0
       OR GREATEST(COALESCE(d.einkommen_kombiniert,0),
                   COALESCE(d.gross_income_yearly,0) + COALESCE(d.co_applicant_einkommen,0)) <= 0
    THEN 'incomplete'
  ELSE
    CASE
      WHEN (COALESCE(d.requested_mortgage,0) /
            NULLIF(COALESCE(NULLIF(d.total_investment,0),
                            COALESCE(d.purchase_price,0)+COALESCE(d.renovation_costs,0)),0)) * 100 > 80
        THEN 'not_financeable'
      WHEN ((COALESCE(d.requested_mortgage,0) * (COALESCE(d.calculated_interest_rate,5)/100.0)
            + COALESCE(d.ancillary_costs_yearly,
                       COALESCE(NULLIF(d.total_investment,0),
                                COALESCE(d.purchase_price,0)+COALESCE(d.renovation_costs,0)) * 0.01)
            + COALESCE(d.amortisation_yearly,
                       GREATEST(0, COALESCE(d.requested_mortgage,0)
                          - COALESCE(NULLIF(d.total_investment,0),
                                     COALESCE(d.purchase_price,0)+COALESCE(d.renovation_costs,0)) * 0.6667) / 15)
            + COALESCE(d.monthly_obligations,0) * 12)
           / NULLIF(GREATEST(COALESCE(d.einkommen_kombiniert,0),
                             COALESCE(d.gross_income_yearly,0) + COALESCE(d.co_applicant_einkommen,0)),0)
          ) * 100 > 38
        THEN 'not_financeable'
      WHEN ((COALESCE(d.requested_mortgage,0) * (COALESCE(d.calculated_interest_rate,5)/100.0)
            + COALESCE(d.ancillary_costs_yearly,
                       COALESCE(NULLIF(d.total_investment,0),
                                COALESCE(d.purchase_price,0)+COALESCE(d.renovation_costs,0)) * 0.01)
            + COALESCE(d.amortisation_yearly,
                       GREATEST(0, COALESCE(d.requested_mortgage,0)
                          - COALESCE(NULLIF(d.total_investment,0),
                                     COALESCE(d.purchase_price,0)+COALESCE(d.renovation_costs,0)) * 0.6667) / 15)
            + COALESCE(d.monthly_obligations,0) * 12)
           / NULLIF(GREATEST(COALESCE(d.einkommen_kombiniert,0),
                             COALESCE(d.gross_income_yearly,0) + COALESCE(d.co_applicant_einkommen,0)),0)
          ) * 100 > 33
        THEN 'critical'
      ELSE 'realistic'
    END
END)::financing_quick_check_status
WHERE d.financing_type::text IN ('refinance','increase','mortgage_increase')
   OR EXISTS (
     SELECT 1 FROM jsonb_array_elements_text(
       CASE WHEN jsonb_typeof(to_jsonb(d.financing_modules)) = 'array'
            THEN to_jsonb(d.financing_modules) ELSE '[]'::jsonb END
     ) AS m(val)
     WHERE m.val IN ('refinance','increase','mortgage_increase')
   );
