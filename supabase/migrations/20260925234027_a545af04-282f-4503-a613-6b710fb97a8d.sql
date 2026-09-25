
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text NULL,
  last_name text NULL,
  invitation_type text NOT NULL CHECK (invitation_type IN ('tenant_owner','tenant_member','platform_user')),
  agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  tenant_role public.app_role NULL,
  platform_role text NULL CHECK (platform_role IS NULL OR platform_role IN ('platform_admin','platform_support','system_owner')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  email_delivery_status text NOT NULL DEFAULT 'not_configured' CHECK (email_delivery_status IN ('not_configured','sent','failed')),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  accepted_by uuid NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL,
  replaces_invitation_id uuid NULL,
  CONSTRAINT invitations_shape CHECK (
    (invitation_type = 'platform_user' AND agency_id IS NULL AND tenant_role IS NULL AND platform_role IS NOT NULL)
    OR (invitation_type = 'tenant_owner' AND agency_id IS NOT NULL AND tenant_role = 'owner' AND platform_role IS NULL)
    OR (invitation_type = 'tenant_member' AND agency_id IS NOT NULL AND tenant_role IN ('owner','admin','manager','agent','assistant','employee') AND platform_role IS NULL)
  )
);
CREATE UNIQUE INDEX invitations_one_pending ON public.invitations
  (invitation_type, coalesce(agency_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(email)) WHERE status = 'pending';
CREATE INDEX invitations_agency_idx ON public.invitations (agency_id);

GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
-- Keine Browser-Policies: Zugriff ausschliesslich über SECURITY DEFINER RPCs.

-- Übergangstabelle aus 4.3 stilllegen (0 Einträge, nicht gelöscht)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tenant_owner_invitations FROM anon, authenticated;
COMMENT ON TABLE public.tenant_owner_invitations IS 'DEPRECATED seit Phase 4.7 – ersetzt durch public.invitations (war leer).';

-- Profilschutz: Einladungsannahme darf Stammfirma/Rolle eines neuen Kontos setzen
CREATE OR REPLACE FUNCTION public.tg_profiles_protect_privileged()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_owner_or_admin() OR public.is_superadmin()
     OR current_setting('app.invitation_accept', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.commission_tier IS DISTINCT FROM OLD.commission_tier
     OR NEW.commission_payout_rate IS DISTINCT FROM OLD.commission_payout_rate THEN
    RAISE EXCEPTION 'Diese Profilfelder dürfen nur von Owner/Admin geändert werden';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.invitation_hash(_token text)
 RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT encode(extensions.digest(coalesce(_token,''), 'sha256'), 'hex') $$;

CREATE OR REPLACE FUNCTION public.invitation_effective_status(_status text, _expires timestamptz)
 RETURNS text LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT CASE WHEN _status = 'pending' AND _expires <= now() THEN 'expired' ELSE _status END $$;

-- Interner Aussteller (nicht für Browser freigegeben)
CREATE OR REPLACE FUNCTION public._invitation_issue(_type text, _email text, _agency uuid, _trole public.app_role,
  _prole text, _first text, _last text, _replaces uuid DEFAULT NULL)
 RETURNS TABLE(invitation_id uuid, token text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tok text := encode(extensions.gen_random_bytes(32), 'hex'); em text := lower(btrim(coalesce(_email,''))); nid uuid;
BEGIN
  IF em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(em) > 254 THEN RAISE EXCEPTION 'invalid_email' USING ERRCODE='22023'; END IF;
  -- abgelaufene offene Einladungen derselben Art schliessen
  UPDATE invitations SET status = 'expired'
   WHERE status = 'pending' AND expires_at <= now() AND invitation_type = _type
     AND agency_id IS NOT DISTINCT FROM _agency AND lower(email) = em;
  IF EXISTS (SELECT 1 FROM invitations WHERE status='pending' AND invitation_type=_type
             AND agency_id IS NOT DISTINCT FROM _agency AND lower(email)=em) THEN
    RAISE EXCEPTION 'already_pending' USING ERRCODE='23505';
  END IF;
  INSERT INTO invitations (email, first_name, last_name, invitation_type, agency_id, tenant_role, platform_role,
    token_hash, expires_at, created_by, replaces_invitation_id)
  VALUES (em, nullif(btrim(coalesce(_first,'')),''), nullif(btrim(coalesce(_last,'')),''), _type, _agency, _trole, _prole,
    public.invitation_hash(tok), now() + interval '7 days', auth.uid(), _replaces)
  RETURNING id INTO nid;
  invitation_id := nid; token := tok; RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public._invitation_issue(text,text,uuid,public.app_role,text,text,text,uuid) FROM PUBLIC, anon, authenticated;

-- Tenant: Mitarbeitende einladen
CREATE OR REPLACE FUNCTION public.invitation_create_tenant_member(_email text, _role text, _first_name text DEFAULT NULL, _last_name text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE ag uuid := public.current_agency_id(); r public.app_role; em text := lower(btrim(coalesce(_email,''))); res record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  IF ag IS NULL THEN RAISE EXCEPTION 'no_workspace' USING ERRCODE='42501'; END IF;
  IF NOT public.is_agency_owner_or_admin(ag) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF _role NOT IN ('owner','admin','manager','agent','assistant','employee') THEN RAISE EXCEPTION 'invalid_role' USING ERRCODE='22023'; END IF;
  r := _role::public.app_role;
  IF r = 'owner' AND NOT public.has_agency_role(ag, ARRAY['owner']::public.app_role[]) THEN
    RAISE EXCEPTION 'forbidden_owner' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM agency_memberships m JOIN auth.users u ON u.id = m.user_id
             WHERE m.agency_id = ag AND m.is_active AND lower(u.email) = em) THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE='23505';
  END IF;
  SELECT * INTO res FROM public._invitation_issue('tenant_member', em, ag, r, NULL, _first_name, _last_name);
  INSERT INTO activity_logs (actor_id, action, related_type, related_id, metadata, agency_id)
  VALUES (auth.uid(), 'invitation_created', 'invitation', res.invitation_id,
    jsonb_build_object('invitation_id', res.invitation_id, 'type','tenant_member','target_email',em,'role',r,'agency_id',ag), ag);
  RETURN jsonb_build_object('invitation_id', res.invitation_id, 'token', res.token, 'email_delivery_status', 'not_configured');
END $$;

CREATE OR REPLACE FUNCTION public.invitation_list_tenant()
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, invitation_type text, tenant_role text,
   status text, created_at timestamptz, expires_at timestamptz, accepted_at timestamptz, email_delivery_status text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE ag uuid := public.current_agency_id();
BEGIN
  IF ag IS NULL OR NOT public.is_agency_owner_or_admin(ag) THEN RETURN; END IF;
  RETURN QUERY SELECT i.id, i.email, i.first_name, i.last_name, i.invitation_type, i.tenant_role::text,
    public.invitation_effective_status(i.status, i.expires_at), i.created_at, i.expires_at, i.accepted_at, i.email_delivery_status
  FROM invitations i WHERE i.agency_id = ag AND i.invitation_type IN ('tenant_member','tenant_owner')
  ORDER BY i.created_at DESC LIMIT 200;
END $$;

-- Plattform: Plattformzugang einladen (nur System Owner)
CREATE OR REPLACE FUNCTION public.platform_invite_user(_email text, _role text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE em text := lower(btrim(coalesce(_email,''))); res record;
BEGIN
  PERFORM public.platform_assert_system_owner();
  IF _role NOT IN ('platform_admin','platform_support','system_owner') THEN RAISE EXCEPTION 'invalid_role' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM platform_admins p JOIN auth.users u ON u.id=p.user_id WHERE lower(u.email)=em) THEN
    RAISE EXCEPTION 'already_platform_user' USING ERRCODE='23505';
  END IF;
  SELECT * INTO res FROM public._invitation_issue('platform_user', em, NULL, NULL, _role, NULL, NULL);
  INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'platform_invitation_created', 'invitation', res.invitation_id, em,
    jsonb_build_object('invitation_id', res.invitation_id, 'type','platform_user','target_email',em,'role',_role));
  RETURN jsonb_build_object('invitation_id', res.invitation_id, 'token', res.token, 'email_delivery_status', 'not_configured');
END $$;

CREATE OR REPLACE FUNCTION public.platform_list_invitations(_type text DEFAULT NULL, _agency_id uuid DEFAULT NULL)
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, invitation_type text, agency_id uuid, agency_name text,
   role text, status text, created_at timestamptz, expires_at timestamptz, accepted_at timestamptz, email_delivery_status text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY SELECT i.id, i.email, i.first_name, i.last_name, i.invitation_type, i.agency_id, a.name,
    coalesce(i.platform_role, i.tenant_role::text), public.invitation_effective_status(i.status, i.expires_at),
    i.created_at, i.expires_at, i.accepted_at, i.email_delivery_status
  FROM invitations i LEFT JOIN agencies a ON a.id = i.agency_id
  WHERE (_type IS NULL OR i.invitation_type = _type)
    AND (_agency_id IS NULL OR i.agency_id = _agency_id)
    AND i.invitation_type IN ('platform_user','tenant_owner')
  ORDER BY i.created_at DESC LIMIT 500;
END $$;

-- Berechtigung für Widerruf/Neu senden
CREATE OR REPLACE FUNCTION public._invitation_can_manage(_inv public.invitations)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF _inv.invitation_type = 'platform_user' THEN RETURN public.is_system_owner(); END IF;
  IF _inv.invitation_type = 'tenant_owner' THEN
    RETURN public.is_platform_admin() OR public.has_agency_role(_inv.agency_id, ARRAY['owner']::public.app_role[]);
  END IF;
  IF _inv.tenant_role = 'owner' THEN RETURN public.has_agency_role(_inv.agency_id, ARRAY['owner']::public.app_role[]); END IF;
  RETURN public.is_agency_owner_or_admin(_inv.agency_id);
END $$;
REVOKE ALL ON FUNCTION public._invitation_can_manage(public.invitations) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._invitation_audit(_inv public.invitations, _action text, _extra jsonb DEFAULT '{}'::jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE meta jsonb := jsonb_build_object('invitation_id', _inv.id, 'type', _inv.invitation_type, 'target_email', _inv.email,
  'role', coalesce(_inv.platform_role, _inv.tenant_role::text)) || CASE WHEN _inv.agency_id IS NOT NULL
  THEN jsonb_build_object('agency_id', _inv.agency_id) ELSE '{}'::jsonb END || _extra;
BEGIN
  IF _inv.invitation_type = 'tenant_member' OR (_inv.invitation_type = 'tenant_owner' AND NOT public.is_platform_admin()) THEN
    INSERT INTO activity_logs (actor_id, action, related_type, related_id, metadata, agency_id)
    VALUES (auth.uid(), _action, 'invitation', _inv.id, meta, _inv.agency_id);
  ELSE
    INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, target_label, metadata)
    VALUES (auth.uid(), 'platform_' || _action, 'invitation', _inv.id, _inv.email, meta);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._invitation_audit(public.invitations, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.invitation_revoke(_invitation_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE inv invitations;
BEGIN
  SELECT * INTO inv FROM invitations WHERE id = _invitation_id FOR UPDATE;
  IF NOT FOUND OR NOT public._invitation_can_manage(inv) THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'not_pending' USING ERRCODE='22023'; END IF;
  UPDATE invitations SET status='revoked', revoked_at=now(), revoked_by=auth.uid() WHERE id = inv.id;
  PERFORM public._invitation_audit(inv, 'invitation_revoked');
END $$;

CREATE OR REPLACE FUNCTION public.invitation_resend(_invitation_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE inv invitations; res record; ninv invitations;
BEGIN
  SELECT * INTO inv FROM invitations WHERE id = _invitation_id FOR UPDATE;
  IF NOT FOUND OR NOT public._invitation_can_manage(inv) THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
  IF inv.status NOT IN ('pending','expired') THEN RAISE EXCEPTION 'not_pending' USING ERRCODE='22023'; END IF;
  UPDATE invitations SET status = CASE WHEN expires_at <= now() THEN 'expired' ELSE 'revoked' END,
    revoked_at = CASE WHEN expires_at <= now() THEN NULL ELSE now() END,
    revoked_by = CASE WHEN expires_at <= now() THEN NULL ELSE auth.uid() END
  WHERE id = inv.id;
  SELECT * INTO res FROM public._invitation_issue(inv.invitation_type, inv.email, inv.agency_id, inv.tenant_role,
    inv.platform_role, inv.first_name, inv.last_name, inv.id);
  SELECT * INTO ninv FROM invitations WHERE id = res.invitation_id;
  PERFORM public._invitation_audit(ninv, 'invitation_created', jsonb_build_object('replaces_invitation_id', inv.id));
  RETURN jsonb_build_object('invitation_id', res.invitation_id, 'token', res.token, 'email_delivery_status', 'not_configured');
END $$;

-- Öffentliche Vorschau: anonym nur neutraler Status, angemeldet zusätzlich Firma/Rolle
CREATE OR REPLACE FUNCTION public.invitation_preview(_token text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE inv invitations; st text; my_email text; nm text;
BEGIN
  IF _token IS NULL OR length(_token) <> 64 THEN RETURN jsonb_build_object('status','invalid'); END IF;
  SELECT * INTO inv FROM invitations WHERE token_hash = public.invitation_hash(_token);
  IF NOT FOUND THEN RETURN jsonb_build_object('status','invalid'); END IF;
  st := public.invitation_effective_status(inv.status, inv.expires_at);
  IF st <> 'pending' OR auth.uid() IS NULL THEN RETURN jsonb_build_object('status', st); END IF;
  SELECT lower(email) INTO my_email FROM auth.users WHERE id = auth.uid();
  IF inv.agency_id IS NOT NULL THEN SELECT name INTO nm FROM agencies WHERE id = inv.agency_id; END IF;
  RETURN jsonb_build_object('status', st, 'type', inv.invitation_type,
    'company_name', CASE WHEN inv.invitation_type = 'platform_user' THEN 'Immolia Platform' ELSE nm END,
    'role', coalesce(inv.platform_role, inv.tenant_role::text),
    'email_match', my_email = lower(inv.email));
END $$;

-- Annahme: atomar
CREATE OR REPLACE FUNCTION public.invitation_accept(_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE inv invitations; uid uuid := auth.uid(); my_email text; had_any boolean; mem record; outcome text := 'accepted';
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  IF _token IS NULL OR length(_token) <> 64 THEN RAISE EXCEPTION 'invalid' USING ERRCODE='22023'; END IF;
  SELECT * INTO inv FROM invitations WHERE token_hash = public.invitation_hash(_token) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid' USING ERRCODE='22023'; END IF;
  IF inv.status = 'revoked' THEN RAISE EXCEPTION 'revoked' USING ERRCODE='22023'; END IF;
  IF inv.status = 'accepted' THEN RAISE EXCEPTION 'used' USING ERRCODE='22023'; END IF;
  IF inv.status = 'expired' OR inv.expires_at <= now() THEN RAISE EXCEPTION 'expired' USING ERRCODE='22023'; END IF;
  SELECT lower(email) INTO my_email FROM auth.users WHERE id = uid;
  IF my_email IS DISTINCT FROM lower(btrim(inv.email)) THEN RAISE EXCEPTION 'email_mismatch' USING ERRCODE='42501'; END IF;

  IF inv.invitation_type = 'platform_user' THEN
    IF EXISTS (SELECT 1 FROM platform_admins WHERE user_id = uid) THEN
      outcome := 'already_platform_user';
    ELSE
      INSERT INTO platform_admins (user_id, platform_role, is_system_owner, updated_at)
      VALUES (uid, inv.platform_role, inv.platform_role = 'system_owner', now());
    END IF;
  ELSE
    IF NOT public.agency_is_active(inv.agency_id) THEN RAISE EXCEPTION 'unavailable' USING ERRCODE='42501'; END IF;
    SELECT EXISTS (SELECT 1 FROM agency_memberships WHERE user_id = uid) INTO had_any;
    SELECT * INTO mem FROM agency_memberships WHERE agency_id = inv.agency_id AND user_id = uid FOR UPDATE;
    IF FOUND AND mem.is_active THEN
      outcome := 'already_member';
    ELSIF FOUND THEN
      UPDATE agency_memberships SET is_active = true, role = inv.tenant_role, updated_at = now() WHERE id = mem.id;
    ELSE
      INSERT INTO agency_memberships (agency_id, user_id, role, is_active) VALUES (inv.agency_id, uid, inv.tenant_role, true);
    END IF;
    IF NOT had_any THEN
      -- erstes Unternehmen: Stammfirma/Rolle des neuen Kontos setzen (keine Plattformrolle, keine Module)
      PERFORM set_config('app.invitation_accept', 'on', true);
      UPDATE profiles SET agency_id = inv.agency_id, role = inv.tenant_role WHERE id = uid AND agency_id IS NULL;
      PERFORM set_config('app.invitation_accept', 'off', true);
      DELETE FROM user_roles WHERE user_id = uid AND role = 'employee' AND inv.tenant_role <> 'employee';
      INSERT INTO user_roles (user_id, role) VALUES (uid, inv.tenant_role) ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  UPDATE invitations SET status = 'accepted', accepted_at = now(), accepted_by = uid WHERE id = inv.id;
  IF inv.invitation_type = 'platform_user' THEN
    INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, target_label, metadata)
    VALUES (uid, 'platform_invitation_accepted', 'invitation', inv.id, inv.email,
      jsonb_build_object('invitation_id', inv.id, 'type', inv.invitation_type, 'target_email', inv.email, 'role', inv.platform_role, 'outcome', outcome));
  ELSE
    INSERT INTO activity_logs (actor_id, action, related_type, related_id, metadata, agency_id)
    VALUES (uid, 'invitation_accepted', 'invitation', inv.id,
      jsonb_build_object('invitation_id', inv.id, 'type', inv.invitation_type, 'target_email', inv.email,
        'role', inv.tenant_role, 'agency_id', inv.agency_id, 'outcome', outcome), inv.agency_id);
  END IF;
  RETURN jsonb_build_object('outcome', outcome, 'type', inv.invitation_type, 'agency_id', inv.agency_id);
END $$;

-- Übergangs-RPC auf zentrale Tabelle umstellen (gleiche Signatur)
CREATE OR REPLACE FUNCTION public.platform_list_owner_invitations(_agency_id uuid)
 RETURNS TABLE(first_name text, last_name text, email text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.platform_assert_admin();
  RETURN QUERY SELECT i.first_name, i.last_name, i.email, public.invitation_effective_status(i.status, i.expires_at), i.created_at
  FROM invitations i WHERE i.agency_id = _agency_id AND i.invitation_type = 'tenant_owner' ORDER BY i.created_at;
END $function$;

REVOKE ALL ON FUNCTION public.invitation_create_tenant_member(text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invitation_list_tenant() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_invite_user(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_invitations(text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invitation_revoke(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invitation_resend(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invitation_accept(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invitation_create_tenant_member(text,text,text,text), public.invitation_list_tenant(),
  public.platform_invite_user(text,text), public.platform_list_invitations(text,uuid), public.invitation_revoke(uuid),
  public.invitation_resend(uuid), public.invitation_accept(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.invitation_preview(text) TO anon, authenticated, service_role;
