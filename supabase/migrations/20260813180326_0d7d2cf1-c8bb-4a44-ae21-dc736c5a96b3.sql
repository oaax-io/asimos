ALTER TABLE public.client_search_profiles ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.purge_expired_search_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.client_search_profiles
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('purge-expired-search-profiles')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-search-profiles');

SELECT cron.schedule('purge-expired-search-profiles', '0 * * * *', $$SELECT public.purge_expired_search_profiles();$$);