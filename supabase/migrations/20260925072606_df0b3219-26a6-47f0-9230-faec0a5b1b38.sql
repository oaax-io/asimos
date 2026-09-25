DROP POLICY IF EXISTS "shares_insert_auth" ON public.bank_package_shares;
DROP POLICY IF EXISTS "shares_select_auth" ON public.bank_package_shares;
REVOKE SELECT, INSERT ON public.bank_package_shares FROM authenticated;
REVOKE ALL ON public.bank_package_shares FROM anon;

CREATE OR REPLACE FUNCTION public.tg_profiles_protect_privileged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_owner_or_admin() OR public.is_superadmin() THEN
    RETURN NEW;
  END IF;
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.commission_tier IS DISTINCT FROM OLD.commission_tier
     OR NEW.commission_payout_rate IS DISTINCT FROM OLD.commission_payout_rate THEN
    RAISE EXCEPTION 'Diese Profilfelder dürfen nur von Owner/Admin geändert werden';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_protect_privileged
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_protect_privileged();