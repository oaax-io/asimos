-- Sync public.user_roles aus profiles.role, damit RLS (is_manager_or_above etc.)
-- die in der Team-Verwaltung gewählte Rolle korrekt erkennt.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, p.role::text AS role_text
    FROM public.profiles p
    WHERE p.role::text IN ('owner','admin','manager','agent','assistant','employee')
  LOOP
    DELETE FROM public.user_roles
      WHERE user_id = r.user_id
        AND role::text IN ('owner','admin','manager','agent','assistant','employee');
    INSERT INTO public.user_roles (user_id, role)
    VALUES (r.user_id, r.role_text::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END;
$$;