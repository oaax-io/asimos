-- ========== COMPANY ==========
ALTER TABLE public.company DROP CONSTRAINT IF EXISTS company_id_check;
ALTER TABLE public.company DROP CONSTRAINT IF EXISTS company_pkey;
ALTER TABLE public.company ALTER COLUMN id SET DEFAULT true;
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS row_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.company ADD PRIMARY KEY (row_id);
UPDATE public.company SET agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224' WHERE agency_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS company_agency_uniq ON public.company(agency_id);

-- ========== BRAND ==========
ALTER TABLE public.brand_settings ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE;
ALTER TABLE public.brand_settings ADD COLUMN IF NOT EXISTS logo_alt_url text NULL;
ALTER TABLE public.brand_settings ADD COLUMN IF NOT EXISTS accent_color text NULL;
ALTER TABLE public.brand_settings ADD COLUMN IF NOT EXISTS favicon_url text NULL;
UPDATE public.brand_settings SET agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224' WHERE agency_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS brand_settings_agency_uniq ON public.brand_settings(agency_id);

-- ========== DOCUMENT TEMPLATES ==========
ALTER TABLE public.document_templates ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE;
ALTER TABLE public.document_templates ADD COLUMN IF NOT EXISTS source_template_id uuid NULL REFERENCES public.document_templates(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.document_templates.agency_id IS 'NULL = Plattformvorlage (Immolia, nur lesbar); gesetzt = Tenant-Vorlage';
COMMENT ON COLUMN public.document_templates.source_template_id IS 'Plattformvorlage, aus der diese Tenant-Vorlage kopiert wurde';
UPDATE public.document_templates SET agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224' WHERE agency_id IS NULL;
DROP INDEX IF EXISTS public.document_templates_one_default_per_type;
CREATE UNIQUE INDEX document_templates_one_default_per_agency_type ON public.document_templates(agency_id, type) WHERE is_default = true;

-- ========== CHECKLIST TEMPLATES ==========
ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE;
UPDATE public.checklist_templates SET agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224' WHERE agency_id IS NULL;
ALTER TABLE public.checklist_templates DROP CONSTRAINT IF EXISTS checklist_templates_key_key;
CREATE UNIQUE INDEX checklist_templates_agency_key_uniq ON public.checklist_templates(agency_id, key);

-- ========== MASTER LISTS ==========
ALTER TABLE public.master_list_values ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE;
UPDATE public.master_list_values SET agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224' WHERE agency_id IS NULL;
ALTER TABLE public.master_list_values DROP CONSTRAINT IF EXISTS master_list_values_list_key_value_key;
CREATE UNIQUE INDEX master_list_values_agency_key_value_uniq ON public.master_list_values(agency_id, list_key, value);

-- ========== FEATURE OPTIONS ==========
ALTER TABLE public.property_feature_options ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE;
COMMENT ON COLUMN public.property_feature_options.key IS 'Kanonischer Immolia-Schlüssel (Datenmodell/Portal-Mapping) – pro Tenant identisch verwenden';
UPDATE public.property_feature_options SET agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224' WHERE agency_id IS NULL;
ALTER TABLE public.property_feature_options DROP CONSTRAINT IF EXISTS property_feature_options_key_key;
CREATE UNIQUE INDEX property_feature_options_agency_key_uniq ON public.property_feature_options(agency_id, key);

-- ========== MODULE PERMISSIONS ==========
ALTER TABLE public.module_permissions ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE;
UPDATE public.module_permissions SET agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224' WHERE agency_id IS NULL;
ALTER TABLE public.module_permissions DROP CONSTRAINT IF EXISTS module_permissions_module_role_key;
CREATE UNIQUE INDEX module_permissions_agency_module_role_uniq ON public.module_permissions(agency_id, module, role);

-- default agency on insert
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['company','brand_settings','document_templates','checklist_templates','master_list_values','property_feature_options','module_permissions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_set_default_agency ON public.%I', t);
    EXECUTE format('CREATE TRIGGER tg_set_default_agency BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_default_agency()', t);
  END LOOP;
END $$;

-- ========== RLS: replace global policies ==========
DROP POLICY IF EXISTS company_read_all ON public.company;
DROP POLICY IF EXISTS company_admin_write ON public.company;
DROP POLICY IF EXISTS brand_settings_read_authenticated ON public.brand_settings;
DROP POLICY IF EXISTS brand_settings_admin_write ON public.brand_settings;
DROP POLICY IF EXISTS document_templates_read ON public.document_templates;
DROP POLICY IF EXISTS document_templates_write ON public.document_templates;
DROP POLICY IF EXISTS checklist_templates_read ON public.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_admin_write ON public.checklist_templates;
DROP POLICY IF EXISTS master_list_values_select ON public.master_list_values;
DROP POLICY IF EXISTS master_list_values_insert ON public.master_list_values;
DROP POLICY IF EXISTS master_list_values_update ON public.master_list_values;
DROP POLICY IF EXISTS master_list_values_delete ON public.master_list_values;
DROP POLICY IF EXISTS feature_options_select ON public.property_feature_options;
DROP POLICY IF EXISTS feature_options_insert ON public.property_feature_options;
DROP POLICY IF EXISTS feature_options_update ON public.property_feature_options;
DROP POLICY IF EXISTS feature_options_delete ON public.property_feature_options;
DROP POLICY IF EXISTS module_permissions_read_all ON public.module_permissions;
DROP POLICY IF EXISTS module_permissions_admin_write ON public.module_permissions;

DO $$ DECLARE t text; platform_read boolean; BEGIN
  FOREACH t IN ARRAY ARRAY['company','brand_settings','document_templates','checklist_templates','master_list_values','property_feature_options','module_permissions'] LOOP
    platform_read := t IN ('document_templates','checklist_templates','master_list_values','property_feature_options');
    EXECUTE format('CREATE POLICY tenant_config_select ON public.%I FOR SELECT TO authenticated USING (%s(agency_id = public.current_agency_id() AND public.is_agency_member(agency_id)))',
      t, CASE WHEN platform_read THEN 'agency_id IS NULL OR ' ELSE '' END);
    EXECUTE format('CREATE POLICY tenant_config_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_agency_id() AND public.is_agency_owner_or_admin(agency_id))', t);
    EXECUTE format('CREATE POLICY tenant_config_update ON public.%I FOR UPDATE TO authenticated USING (agency_id = public.current_agency_id() AND public.is_agency_owner_or_admin(agency_id)) WITH CHECK (agency_id = public.current_agency_id() AND public.is_agency_owner_or_admin(agency_id))', t);
    EXECUTE format('CREATE POLICY tenant_config_delete ON public.%I FOR DELETE TO authenticated USING (agency_id = public.current_agency_id() AND public.is_agency_owner_or_admin(agency_id))', t);
  END LOOP;
END $$;

-- ========== AGENCY MODULES (Entitlement vs Tenant-Konfiguration) ==========
CREATE TABLE public.agency_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  module text NOT NULL,
  is_entitled boolean NOT NULL DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, module)
);
COMMENT ON COLUMN public.agency_modules.is_entitled IS 'Plattform/Abo: darf die Firma das Modul nutzen (nur Plattform/Server änderbar)';
COMMENT ON COLUMN public.agency_modules.is_enabled IS 'Tenant-Konfiguration: Firma hat das Modul eingeschaltet';
GRANT SELECT, UPDATE ON public.agency_modules TO authenticated;
GRANT ALL ON public.agency_modules TO service_role;
ALTER TABLE public.agency_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_modules_select ON public.agency_modules FOR SELECT TO authenticated
  USING (agency_id = public.current_agency_id() AND public.is_agency_member(agency_id));
CREATE POLICY agency_modules_update ON public.agency_modules FOR UPDATE TO authenticated
  USING (agency_id = public.current_agency_id() AND public.is_agency_owner_or_admin(agency_id))
  WITH CHECK (agency_id = public.current_agency_id() AND public.is_agency_owner_or_admin(agency_id));

CREATE OR REPLACE FUNCTION public.tg_agency_modules_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.is_entitled IS DISTINCT FROM OLD.is_entitled OR NEW.agency_id IS DISTINCT FROM OLD.agency_id OR NEW.module IS DISTINCT FROM OLD.module THEN
      RAISE EXCEPTION 'Modul-Freischaltung kann nur durch die Plattform geändert werden';
    END IF;
    IF NEW.is_enabled AND NOT NEW.is_entitled THEN
      RAISE EXCEPTION 'Modul ist für diese Firma nicht freigeschaltet';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER tg_agency_modules_guard BEFORE UPDATE ON public.agency_modules FOR EACH ROW EXECUTE FUNCTION public.tg_agency_modules_guard();

INSERT INTO public.agency_modules(agency_id, module)
SELECT DISTINCT '69eb3646-8b0e-4f96-b3c9-143e5739d224'::uuid, module FROM public.module_permissions
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.agency_module_enabled(_module text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT am.is_entitled AND am.is_enabled FROM public.agency_modules am
                    WHERE am.agency_id = public.current_agency_id() AND am.module = _module), true);
$$;

CREATE OR REPLACE FUNCTION public.user_can(_module text, _action text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE has_perm boolean := false;
BEGIN
  IF NOT public.agency_module_enabled(_module) THEN RETURN false; END IF;
  SELECT CASE _action
    WHEN 'view' THEN bool_or(mp.can_view)
    WHEN 'create' THEN bool_or(mp.can_create)
    WHEN 'edit_own' THEN bool_or(mp.can_edit_own)
    WHEN 'edit_all' THEN bool_or(mp.can_edit_all)
    WHEN 'delete' THEN bool_or(mp.can_delete)
    ELSE false END
  INTO has_perm
  FROM public.module_permissions mp
  JOIN public.agency_memberships m ON m.role = mp.role
  WHERE m.user_id = auth.uid() AND m.is_active AND m.agency_id = public.current_agency_id()
    AND mp.agency_id = m.agency_id
    AND mp.module = _module;
  RETURN COALESCE(has_perm, false);
END $$;

CREATE OR REPLACE FUNCTION public.set_default_template(_template_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_type document_type; t_agency uuid;
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Only owners/admins can set default templates';
  END IF;
  SELECT type, agency_id INTO t_type, t_agency FROM public.document_templates WHERE id = _template_id;
  IF t_type IS NULL OR t_agency IS DISTINCT FROM public.current_agency_id() THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  UPDATE public.document_templates SET is_default = false, updated_at = now()
    WHERE type = t_type AND agency_id = t_agency AND is_default = true AND id <> _template_id;
  UPDATE public.document_templates SET is_default = true, updated_at = now() WHERE id = _template_id;
END $$;

-- ========== CENTRAL CONFIG RESOLUTION ==========
CREATE OR REPLACE FUNCTION public.tenant_branding_of(_agency uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'agency_id', _agency,
    'company_name', COALESCE(b.company_name, c.name),
    'logo_url', COALESCE(b.logo_url, c.logo_url),
    'logo_alt_url', b.logo_alt_url,
    'primary_color', b.primary_color,
    'secondary_color', b.secondary_color,
    'accent_color', b.accent_color,
    'favicon_url', b.favicon_url,
    'font_family', b.font_family,
    'company_email', COALESCE(b.company_email, c.email),
    'company_website', COALESCE(b.company_website, c.website),
    'company_address', b.company_address)
  FROM (SELECT _agency AS a) x
  LEFT JOIN public.brand_settings b ON b.agency_id = x.a
  LEFT JOIN public.company c ON c.agency_id = x.a
  WHERE _agency IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.tenant_branding_of(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_tenant_config() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := public.current_agency_id();
BEGIN
  IF a IS NULL OR NOT public.is_agency_member(a) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'agency_id', a,
    'branding', public.tenant_branding_of(a),
    'modules', COALESCE((SELECT jsonb_object_agg(module, is_entitled AND is_enabled) FROM public.agency_modules WHERE agency_id = a), '{}'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.get_tenant_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_config() TO authenticated;

-- ========== BANK PACKAGE: branding of package agency ==========
CREATE OR REPLACE FUNCTION public.bank_package_share_resolve(_token text)
 RETURNS TABLE(status text, client_name text, package_title text, size_bytes bigint, attachment_count integer, expires_at timestamp with time zone, company_name text, logo_url text, primary_color text, secondary_color text, company_email text, company_website text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.bank_package_shares%ROWTYPE; a uuid; b jsonb;
BEGIN
  SELECT * INTO r FROM public.bank_package_shares WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::bigint, NULL::int, NULL::timestamptz,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  SELECT d.agency_id INTO a FROM public.financing_dossiers d WHERE d.id = r.dossier_id;
  b := COALESCE(public.tenant_branding_of(a), '{}'::jsonb);
  RETURN QUERY SELECT CASE WHEN r.expires_at < now() THEN 'expired' ELSE 'ok' END::text,
    r.client_name, r.package_title, r.size_bytes, r.attachment_count, r.expires_at,
    b->>'company_name', b->>'logo_url', b->>'primary_color', b->>'secondary_color', b->>'company_email', b->>'company_website';
END;
$function$;

-- ========== FEEDBACK ISOLATION ==========
DROP POLICY IF EXISTS feedback_read_all ON public.feedback;
CREATE POLICY feedback_read_own_or_platform ON public.feedback FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_superadmin());
DROP POLICY IF EXISTS feedback_comments_read_all ON public.feedback_comments;
CREATE POLICY feedback_comments_read_own_or_platform ON public.feedback_comments FOR SELECT TO authenticated
  USING (public.is_superadmin() OR author_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.created_by = auth.uid()));
DROP POLICY IF EXISTS feedback_votes_read_all ON public.feedback_votes;
CREATE POLICY feedback_votes_read_own_or_platform ON public.feedback_votes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin());

-- ========== FEEDBACK NOTIFICATIONS -> PLATFORM ROLES ==========
CREATE OR REPLACE FUNCTION public.tg_notify_feedback_superadmin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sa record; actor uuid := auth.uid();
BEGIN
  FOR sa IN SELECT user_id FROM public.platform_admins WHERE platform_role IN ('system_owner','platform_admin') LOOP
    IF sa.user_id = actor THEN CONTINUE; END IF;
    PERFORM public.create_notification(sa.user_id, 'task', 'Neues Feedback',
      COALESCE(NEW.title, 'Neues Feedback eingegangen'), '/feedback', 'feedback', NEW.id);
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_notify_feedback_comment_superadmin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sa record; actor uuid := auth.uid(); fb_title text; fb_author uuid;
BEGIN
  SELECT title, created_by INTO fb_title, fb_author FROM public.feedback WHERE id = NEW.feedback_id;
  FOR sa IN SELECT user_id FROM public.platform_admins WHERE platform_role IN ('system_owner','platform_admin') LOOP
    IF sa.user_id = actor THEN CONTINUE; END IF;
    PERFORM public.create_notification(sa.user_id, 'task', 'Neuer Feedback-Kommentar',
      COALESCE(fb_title, 'Feedback'), '/feedback', 'feedback', NEW.feedback_id);
  END LOOP;
  IF fb_author IS NOT NULL AND fb_author IS DISTINCT FROM actor
     AND NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = fb_author AND platform_role IN ('system_owner','platform_admin')) THEN
    PERFORM public.create_notification(fb_author, 'task', 'Antwort auf dein Feedback',
      COALESCE(fb_title, 'Feedback'), '/feedback', 'feedback', NEW.feedback_id);
  END IF;
  RETURN NEW;
END $$;

-- Legacy-Rolle superadmin nicht mehr neu vergeben
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role, _grant boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only superadmins can manage roles';
  END IF;
  IF _role = 'superadmin'::app_role AND _grant THEN
    RAISE EXCEPTION 'Die Rolle superadmin ist veraltet; Plattformrechte laufen über die Plattform-Administration';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role) ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
END $$;