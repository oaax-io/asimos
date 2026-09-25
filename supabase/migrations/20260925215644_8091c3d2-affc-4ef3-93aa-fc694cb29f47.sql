ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS status text NULL DEFAULT 'active';
UPDATE public.agencies SET status = 'active' WHERE status IS NULL;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_status_chk CHECK (status IS NULL OR status IN ('active','suspended','archived'));

CREATE OR REPLACE FUNCTION public.platform_assert_admin() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.platform_activity(_agency_id uuid DEFAULT NULL, _limit int DEFAULT 30)
RETURNS TABLE(at timestamptz, kind text, agency_id uuid, agency_name text, label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY
  SELECT e.at, e.kind, e.agency_id, a.name, e.label FROM (
    SELECT ag.created_at AS at, 'tenant_created'::text AS kind, ag.id AS agency_id, ag.name AS label FROM agencies ag
    UNION ALL SELECT d.created_at, 'domain_added', d.agency_id, d.domain FROM tenant_domains d
    UNION ALL SELECT d.verified_at, 'domain_verified', d.agency_id, d.domain FROM tenant_domains d WHERE d.verified_at IS NOT NULL
    UNION ALL SELECT d.activated_at, 'domain_activated', d.agency_id, d.domain FROM tenant_domains d WHERE d.activated_at IS NOT NULL
    UNION ALL SELECT m.created_at, 'member_added', m.agency_id, coalesce(p.full_name, u.email::text) FROM agency_memberships m
      LEFT JOIN profiles p ON p.id = m.user_id LEFT JOIN auth.users u ON u.id = m.user_id
  ) e LEFT JOIN agencies a ON a.id = e.agency_id
  WHERE _agency_id IS NULL OR e.agency_id = _agency_id
  ORDER BY e.at DESC NULLS LAST
  LIMIT greatest(1, least(_limit, 200));
END $$;

CREATE OR REPLACE FUNCTION public.platform_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN jsonb_build_object(
    'tenants', (SELECT count(*) FROM agencies),
    'users', (SELECT count(DISTINCT user_id) FROM agency_memberships WHERE is_active),
    'active_domains', (SELECT count(*) FROM tenant_domains WHERE verification_status='verified' AND (domain_type='subdomain' OR activated_at IS NOT NULL)),
    'subdomains', (SELECT count(*) FROM tenant_domains WHERE domain_type='subdomain'),
    'custom_domains', (SELECT count(*) FROM tenant_domains WHERE domain_type='custom'),
    'active_modules', (SELECT count(*) FROM agency_modules WHERE is_entitled AND is_enabled)
  );
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_tenants()
RETURNS TABLE(id uuid, name text, status text, created_at timestamptz, members bigint, subdomain text, custom_domain text, custom_domain_status text, custom_domain_active boolean, has_branding boolean, modules_active bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY
  SELECT a.id, a.name, coalesce(a.status,'active'), a.created_at,
    (SELECT count(*) FROM agency_memberships m WHERE m.agency_id=a.id AND m.is_active),
    (SELECT d.domain FROM tenant_domains d WHERE d.agency_id=a.id AND d.domain_type='subdomain' ORDER BY d.created_at LIMIT 1),
    c.domain, c.verification_status, c.activated_at IS NOT NULL,
    EXISTS (SELECT 1 FROM brand_settings b WHERE b.agency_id=a.id AND (b.logo_url IS NOT NULL OR b.app_primary_color IS NOT NULL OR b.primary_color IS NOT NULL)),
    (SELECT count(*) FROM agency_modules x WHERE x.agency_id=a.id AND x.is_entitled AND x.is_enabled)
  FROM agencies a
  LEFT JOIN LATERAL (SELECT d.domain, d.verification_status, d.activated_at FROM tenant_domains d WHERE d.agency_id=a.id AND d.domain_type='custom' ORDER BY d.created_at DESC LIMIT 1) c ON true
  ORDER BY a.name;
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_members(_agency_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, full_name text, email text, agency_id uuid, agency_name text, tenant_role text, is_active boolean, created_at timestamptz, platform_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY
  SELECT m.user_id, p.full_name, u.email::text, m.agency_id, a.name, m.role::text, m.is_active, m.created_at, pa.platform_role
  FROM agency_memberships m
  JOIN agencies a ON a.id = m.agency_id
  LEFT JOIN profiles p ON p.id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN platform_admins pa ON pa.user_id = m.user_id
  WHERE _agency_id IS NULL OR m.agency_id = _agency_id
  ORDER BY a.name, p.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_domains(_agency_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, agency_id uuid, agency_name text, domain text, domain_type text, verification_status text, verified_at timestamptz, activated_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY
  SELECT d.id, d.agency_id, a.name, d.domain, d.domain_type, d.verification_status, d.verified_at, d.activated_at, d.created_at
  FROM tenant_domains d JOIN agencies a ON a.id=d.agency_id
  WHERE _agency_id IS NULL OR d.agency_id=_agency_id
  ORDER BY a.name, d.domain;
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_modules(_agency_id uuid DEFAULT NULL)
RETURNS TABLE(agency_id uuid, agency_name text, module text, is_entitled boolean, is_enabled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY
  SELECT x.agency_id, a.name, x.module, x.is_entitled, x.is_enabled
  FROM agency_modules x JOIN agencies a ON a.id=x.agency_id
  WHERE _agency_id IS NULL OR x.agency_id=_agency_id
  ORDER BY a.name, x.module;
END $$;

CREATE OR REPLACE FUNCTION public.platform_tenant_branding(_agency_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN (SELECT jsonb_build_object('company_name', b.company_name, 'logo_url', b.logo_url, 'favicon_url', b.favicon_url,
    'primary_color', b.primary_color, 'secondary_color', b.secondary_color, 'accent_color', b.accent_color,
    'app_primary_color', b.app_primary_color, 'app_secondary_color', b.app_secondary_color, 'app_accent_color', b.app_accent_color,
    'login_title', b.login_title, 'updated_at', b.updated_at)
    FROM brand_settings b WHERE b.agency_id=_agency_id ORDER BY b.updated_at DESC LIMIT 1);
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_admins()
RETURNS TABLE(user_id uuid, full_name text, email text, platform_role text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY SELECT pa.user_id, p.full_name, u.email::text, pa.platform_role, pa.created_at
  FROM platform_admins pa LEFT JOIN profiles p ON p.id=pa.user_id LEFT JOIN auth.users u ON u.id=pa.user_id
  ORDER BY pa.created_at;
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['platform_assert_admin()','platform_activity(uuid,int)','platform_overview()','platform_list_tenants()','platform_list_members(uuid)','platform_list_domains(uuid)','platform_list_modules(uuid)','platform_tenant_branding(uuid)','platform_list_admins()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;