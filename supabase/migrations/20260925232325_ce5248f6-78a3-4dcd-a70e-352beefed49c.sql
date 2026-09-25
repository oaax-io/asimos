CREATE OR REPLACE FUNCTION public.tg_profiles_protect_active_agency()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
BEGIN
  -- SECURITY INVOKER: current_user ist die echte Rolle der Anfrage.
  IF current_user IN ('authenticated','anon')
     AND coalesce(current_setting('app.workspace_switch', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN NEW.active_agency_id := NULL;
    ELSIF NEW.active_agency_id IS DISTINCT FROM OLD.active_agency_id THEN
      RAISE EXCEPTION 'Das aktive Unternehmen kann nur über den Unternehmenswechsel gesetzt werden' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.my_workspaces()
 RETURNS TABLE(agency_id uuid, name text, role text, logo_url text, favicon_url text,
               custom_domain text, subdomain text, is_current boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT a.id,
         COALESCE(NULLIF(b.company_name,''), a.name)::text,
         m.role::text,
         b.logo_url, b.favicon_url,
         (SELECT d.domain FROM public.tenant_domains d WHERE d.agency_id = a.id AND d.domain_type = 'custom'
            AND d.verification_status = 'verified' AND d.activated_at IS NOT NULL
          ORDER BY d.is_primary DESC LIMIT 1),
         (SELECT d.domain FROM public.tenant_domains d WHERE d.agency_id = a.id AND d.domain_type = 'subdomain'
            AND d.verification_status = 'verified' ORDER BY d.is_primary DESC LIMIT 1),
         COALESCE(a.id = public.current_agency_id(), false)
  FROM public.agency_memberships m
  JOIN public.agencies a ON a.id = m.agency_id
  LEFT JOIN public.brand_settings b ON b.agency_id = a.id
  WHERE auth.uid() IS NOT NULL AND m.user_id = auth.uid() AND m.is_active AND public.agency_is_active(a.id)
  ORDER BY 2;
$$;