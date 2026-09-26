
-- ===== Phase 5.1 Commercial Foundation (additiv) =====
CREATE OR REPLACE FUNCTION public.commercial_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Entitlement-Key-Format: module.<modul> | feature.<name>
CREATE OR REPLACE FUNCTION public.commercial_valid_entitlement_key(_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _key ~ '^(module|feature)\.[a-z0-9_]+$'
     AND (_key NOT LIKE 'module.%' OR substr(_key, 8) = ANY(public.platform_module_keys()));
$$;

-- PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  sort_order integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated; GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_platform_read ON public.plans FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE TRIGGER plans_touch BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

CREATE TABLE public.plan_entitlements (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, entitlement_key)
);
GRANT SELECT ON public.plan_entitlements TO authenticated; GRANT ALL ON public.plan_entitlements TO service_role;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_entitlements_platform_read ON public.plan_entitlements FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE TRIGGER plan_entitlements_touch BEFORE UPDATE ON public.plan_entitlements FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

-- LIMITS: Zahl ODER unbegrenzt, nie beides
CREATE TABLE public.plan_limits (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  limit_key text NOT NULL CHECK (limit_key ~ '^[a-z0-9_]{2,63}$'),
  limit_value bigint,
  is_unlimited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, limit_key),
  CHECK ((is_unlimited AND limit_value IS NULL) OR (NOT is_unlimited AND limit_value IS NOT NULL AND limit_value >= 0))
);
GRANT SELECT ON public.plan_limits TO authenticated; GRANT ALL ON public.plan_limits TO service_role;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_limits_platform_read ON public.plan_limits FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE TRIGGER plan_limits_touch BEFORE UPDATE ON public.plan_limits FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

-- ADD-ONS
CREATE TABLE public.addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  billing_type text NOT NULL DEFAULT 'recurring' CHECK (billing_type IN ('recurring','one_time')),
  stripe_price_id text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.addons TO authenticated; GRANT ALL ON public.addons TO service_role;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY addons_platform_read ON public.addons FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE TRIGGER addons_touch BEFORE UPDATE ON public.addons FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

CREATE TABLE public.addon_entitlements (
  addon_id uuid NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (addon_id, entitlement_key)
);
GRANT SELECT ON public.addon_entitlements TO authenticated; GRANT ALL ON public.addon_entitlements TO service_role;
ALTER TABLE public.addon_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY addon_entitlements_platform_read ON public.addon_entitlements FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE TABLE public.addon_limit_increments (
  addon_id uuid NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  limit_key text NOT NULL CHECK (limit_key ~ '^[a-z0-9_]{2,63}$'),
  increment_per_unit bigint,
  is_unlimited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (addon_id, limit_key),
  CHECK ((is_unlimited AND increment_per_unit IS NULL) OR (NOT is_unlimited AND increment_per_unit IS NOT NULL AND increment_per_unit >= 0))
);
GRANT SELECT ON public.addon_limit_increments TO authenticated; GRANT ALL ON public.addon_limit_increments TO service_role;
ALTER TABLE public.addon_limit_increments ENABLE ROW LEVEL SECURITY;
CREATE POLICY addon_limit_increments_platform_read ON public.addon_limit_increments FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE TABLE public.agency_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.addons(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','expired')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agency_addons_agency_idx ON public.agency_addons(agency_id);
GRANT SELECT ON public.agency_addons TO authenticated; GRANT ALL ON public.agency_addons TO service_role;
ALTER TABLE public.agency_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_addons_tenant_admin_read ON public.agency_addons FOR SELECT TO authenticated USING (public.is_agency_owner_or_admin(agency_id));
CREATE TRIGGER agency_addons_touch BEFORE UPDATE ON public.agency_addons FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

-- CREDIT PACKAGES (Preise nullable, CHF-fähig, Stripe später)
CREATE TABLE public.credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  name text NOT NULL,
  credits integer CHECK (credits IS NULL OR credits > 0),
  price_amount numeric(12,2) CHECK (price_amount IS NULL OR price_amount >= 0),
  currency text NOT NULL DEFAULT 'CHF' CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  sort_order integer NOT NULL DEFAULT 0,
  stripe_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'active' OR (credits IS NOT NULL AND price_amount IS NOT NULL))
);
GRANT SELECT ON public.credit_packages TO authenticated; GRANT ALL ON public.credit_packages TO service_role;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_packages_platform_read ON public.credit_packages FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE TRIGGER credit_packages_touch BEFORE UPDATE ON public.credit_packages FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

-- CREDIT ACTION CATALOG (Kosten nullable, standardmässig inaktiv)
CREATE TABLE public.credit_action_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE CHECK (action_key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('ai','communication','documents','data','marketing','publishing')),
  credit_cost integer CHECK (credit_cost IS NULL OR credit_cost >= 0),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_action_costs TO authenticated; GRANT ALL ON public.credit_action_costs TO service_role;
ALTER TABLE public.credit_action_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_action_costs_platform_read ON public.credit_action_costs FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE TRIGGER credit_action_costs_touch BEFORE UPDATE ON public.credit_action_costs FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

-- CREDIT WALLETS + LEDGER (Saldo nur aus dem Journal, keine anonyme Zahl)
CREATE TABLE public.credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL UNIQUE REFERENCES public.agencies(id) ON DELETE CASCADE,
  consumption_order text[],   -- Reihenfolge der Buckets, Festlegung in Phase 5.2
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_wallets TO authenticated; GRANT ALL ON public.credit_wallets TO service_role;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_wallets_tenant_admin_read ON public.credit_wallets FOR SELECT TO authenticated USING (public.is_agency_owner_or_admin(agency_id));
CREATE TRIGGER credit_wallets_touch BEFORE UPDATE ON public.credit_wallets FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.credit_wallets(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('subscription','purchase','refund','adjustment','promotion','bonus','consumption')),
  bucket text NOT NULL CHECK (bucket IN ('subscription','purchased','promotional','adjustment')),
  delta integer NOT NULL CHECK (delta <> 0),
  expires_at timestamptz,
  action_key text,
  reference_type text,
  reference_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_ledger_agency_idx ON public.credit_ledger(agency_id, created_at DESC);
GRANT SELECT ON public.credit_ledger TO authenticated; GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_ledger_tenant_admin_read ON public.credit_ledger FOR SELECT TO authenticated USING (public.is_agency_owner_or_admin(agency_id));
-- Journal ist unveränderlich
CREATE OR REPLACE FUNCTION public.credit_ledger_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'credit_ledger_immutable' USING ERRCODE = '42501'; END $$;
CREATE TRIGGER credit_ledger_no_update BEFORE UPDATE OR DELETE ON public.credit_ledger FOR EACH ROW EXECUTE FUNCTION public.credit_ledger_immutable();

-- SUBSCRIPTIONS: bestehende Tabelle erweitern (keine zweite Tabelle)
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_id uuid NULL REFERENCES public.plans(id) ON DELETE SET NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS billing_period text NULL CHECK (billing_period IS NULL OR billing_period IN ('monthly','yearly'));
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_start timestamptz NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_end timestamptz NULL;

-- ===== Effective Commercial State (Server = Source of Truth) =====
CREATE OR REPLACE FUNCTION public.commercial_can_read(_agency_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.role() = 'service_role' OR public.is_agency_member(_agency_id) OR public.is_platform_admin();
$$;

-- aktive Plan-ID des Unternehmens (nur Abos mit Plan, gleiche Aktiv-Regel wie has_active_subscription)
CREATE OR REPLACE FUNCTION public.agency_active_plan_id(_agency_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.plan_id FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id AND p.status <> 'draft'
  WHERE s.agency_id = _agency_id AND s.plan_id IS NOT NULL
    AND ((s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
      OR (s.status = 'canceled' AND s.current_period_end > now()))
  ORDER BY s.created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.agency_has_entitlement(_agency_id uuid, _key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.commercial_can_read(_agency_id)
    AND public.agency_is_active(_agency_id)
    AND (
      EXISTS (SELECT 1 FROM public.plan_entitlements pe
              WHERE pe.plan_id = public.agency_active_plan_id(_agency_id) AND pe.entitlement_key = _key AND pe.enabled)
      OR EXISTS (SELECT 1 FROM public.agency_addons aa
                 JOIN public.addons a ON a.id = aa.addon_id AND a.status <> 'draft'
                 JOIN public.addon_entitlements ae ON ae.addon_id = aa.addon_id AND ae.entitlement_key = _key
                 WHERE aa.agency_id = _agency_id AND aa.status = 'active' AND aa.starts_at <= now() AND (aa.ends_at IS NULL OR aa.ends_at > now()))
    );
$$;

-- { defined, unlimited, value }  – kein Planwert = defined:false (keine Magic Number)
CREATE OR REPLACE FUNCTION public.agency_effective_limit(_agency_id uuid, _key text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record; add_sum bigint := 0; add_unl boolean := false;
BEGIN
  IF NOT public.commercial_can_read(_agency_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  SELECT limit_value, is_unlimited INTO pl FROM public.plan_limits
   WHERE plan_id = public.agency_active_plan_id(_agency_id) AND limit_key = _key;
  SELECT COALESCE(SUM(i.increment_per_unit * aa.quantity), 0), COALESCE(bool_or(i.is_unlimited), false)
    INTO add_sum, add_unl
    FROM public.agency_addons aa
    JOIN public.addons a ON a.id = aa.addon_id AND a.status <> 'draft'
    JOIN public.addon_limit_increments i ON i.addon_id = aa.addon_id AND i.limit_key = _key
   WHERE aa.agency_id = _agency_id AND aa.status = 'active' AND aa.starts_at <= now() AND (aa.ends_at IS NULL OR aa.ends_at > now());
  IF pl IS NULL AND NOT add_unl AND add_sum = 0 THEN
    RETURN jsonb_build_object('key', _key, 'defined', false, 'unlimited', false, 'value', NULL);
  END IF;
  IF COALESCE(pl.is_unlimited, false) OR add_unl THEN
    RETURN jsonb_build_object('key', _key, 'defined', true, 'unlimited', true, 'value', NULL);
  END IF;
  RETURN jsonb_build_object('key', _key, 'defined', true, 'unlimited', false,
    'value', COALESCE(pl.limit_value, 0) + add_sum, 'plan_value', pl.limit_value, 'addon_value', add_sum);
END $$;

-- Kosten nur, wenn aktiv UND > 0; NULL/0/inaktiv = 0 (nie versehentlich kostenpflichtig)
CREATE OR REPLACE FUNCTION public.credit_action_effective_cost(_action_key text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT CASE WHEN active AND credit_cost > 0 THEN credit_cost ELSE 0 END
                   FROM public.credit_action_costs WHERE action_key = _action_key), 0);
$$;

CREATE OR REPLACE FUNCTION public.agency_commercial_state(_agency_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE plan_id uuid; res jsonb;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_agency_owner_or_admin(_agency_id) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  plan_id := public.agency_active_plan_id(_agency_id);
  SELECT jsonb_build_object(
    'agency_id', _agency_id,
    'agency_active', public.agency_is_active(_agency_id),
    'commercial_enforced', false,  -- agency_modules bleibt massgeblich bis zur ausdrücklichen Aktivierung
    'plan', (SELECT jsonb_build_object('id', p.id, 'key', p.key, 'name', p.name, 'status', p.status) FROM plans p WHERE p.id = plan_id),
    'subscription', (SELECT jsonb_build_object('status', s.status, 'billing_period', s.billing_period, 'trial_end', s.trial_end,
                       'current_period_end', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end)
                     FROM subscriptions s WHERE s.agency_id = _agency_id ORDER BY s.created_at DESC LIMIT 1),
    'entitlements', COALESCE((SELECT jsonb_agg(DISTINCT k ORDER BY k) FROM (
        SELECT pe.entitlement_key k FROM plan_entitlements pe WHERE pe.plan_id = plan_id AND pe.enabled
        UNION SELECT ae.entitlement_key FROM agency_addons aa JOIN addons a ON a.id=aa.addon_id AND a.status<>'draft'
          JOIN addon_entitlements ae ON ae.addon_id=aa.addon_id
          WHERE aa.agency_id=_agency_id AND aa.status='active' AND aa.starts_at<=now() AND (aa.ends_at IS NULL OR aa.ends_at>now())) x), '[]'::jsonb),
    'limits', COALESCE((SELECT jsonb_agg(public.agency_effective_limit(_agency_id, k) ORDER BY k) FROM (
        SELECT limit_key k FROM plan_limits WHERE plan_limits.plan_id = plan_id
        UNION SELECT i.limit_key FROM agency_addons aa JOIN addon_limit_increments i ON i.addon_id=aa.addon_id
          WHERE aa.agency_id=_agency_id AND aa.status='active') y), '[]'::jsonb),
    'addons', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', a.key, 'name', a.name, 'quantity', aa.quantity, 'status', aa.status, 'ends_at', aa.ends_at))
        FROM agency_addons aa JOIN addons a ON a.id = aa.addon_id WHERE aa.agency_id = _agency_id), '[]'::jsonb),
    'credits', COALESCE((SELECT jsonb_object_agg(bucket, total) FROM (
        SELECT bucket, SUM(delta) total FROM credit_ledger
        WHERE agency_id = _agency_id AND (expires_at IS NULL OR expires_at > now()) GROUP BY bucket) c), '{}'::jsonb)
  ) INTO res;
  RETURN res;
END $$;

-- ===== Platform Commercial Admin (nur is_platform_admin, je ein Audit-Eintrag) =====
CREATE OR REPLACE FUNCTION public.platform_upsert_plan(_key text, _name text, _description text, _status text, _sort_order integer, _is_public boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; prev jsonb;
BEGIN
  PERFORM public.platform_assert_admin();
  SELECT id, to_jsonb(p) INTO pid, prev FROM plans p WHERE key = _key FOR UPDATE;
  IF pid IS NULL THEN
    INSERT INTO plans(key, name, description, status, sort_order, is_public)
    VALUES (_key, _name, _description, COALESCE(_status,'draft'), COALESCE(_sort_order,0), COALESCE(_is_public,false)) RETURNING id INTO pid;
  ELSE
    UPDATE plans SET name=_name, description=_description, status=COALESCE(_status,status), sort_order=COALESCE(_sort_order,sort_order), is_public=COALESCE(_is_public,is_public) WHERE id=pid;
  END IF;
  INSERT INTO platform_audit_logs(actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'plan_changed', 'plan', pid, _name, jsonb_build_object('key',_key,'previous',prev,'status',_status));
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.platform_set_plan_entitlement(_plan_id uuid, _key text, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text; prev boolean;
BEGIN
  PERFORM public.platform_assert_admin();
  SELECT name INTO nm FROM plans WHERE id=_plan_id; IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF NOT public.commercial_valid_entitlement_key(_key) THEN RAISE EXCEPTION 'invalid_entitlement' USING ERRCODE='22023'; END IF;
  SELECT enabled INTO prev FROM plan_entitlements WHERE plan_id=_plan_id AND entitlement_key=_key;
  INSERT INTO plan_entitlements(plan_id, entitlement_key, enabled) VALUES (_plan_id,_key,_enabled)
  ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET enabled=EXCLUDED.enabled;
  INSERT INTO platform_audit_logs(actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'entitlement_changed', 'plan', _plan_id, nm, jsonb_build_object('key',_key,'previous',prev,'enabled',_enabled));
END $$;

CREATE OR REPLACE FUNCTION public.platform_set_plan_limit(_plan_id uuid, _limit_key text, _value bigint, _unlimited boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text; prev jsonb;
BEGIN
  PERFORM public.platform_assert_admin();
  SELECT name INTO nm FROM plans WHERE id=_plan_id; IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  SELECT jsonb_build_object('value',limit_value,'unlimited',is_unlimited) INTO prev FROM plan_limits WHERE plan_id=_plan_id AND limit_key=_limit_key;
  INSERT INTO plan_limits(plan_id, limit_key, limit_value, is_unlimited)
  VALUES (_plan_id,_limit_key, CASE WHEN _unlimited THEN NULL ELSE _value END, COALESCE(_unlimited,false))
  ON CONFLICT (plan_id, limit_key) DO UPDATE SET limit_value=EXCLUDED.limit_value, is_unlimited=EXCLUDED.is_unlimited;
  INSERT INTO platform_audit_logs(actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'limit_changed', 'plan', _plan_id, nm, jsonb_build_object('key',_limit_key,'previous',prev,'value',_value,'unlimited',_unlimited));
END $$;

CREATE OR REPLACE FUNCTION public.platform_upsert_credit_package(_key text, _name text, _credits integer, _price_amount numeric, _currency text, _status text, _sort_order integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  PERFORM public.platform_assert_admin();
  INSERT INTO credit_packages(key, name, credits, price_amount, currency, status, sort_order)
  VALUES (_key,_name,_credits,_price_amount,COALESCE(_currency,'CHF'),COALESCE(_status,'draft'),COALESCE(_sort_order,0))
  ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, credits=EXCLUDED.credits, price_amount=EXCLUDED.price_amount,
    currency=EXCLUDED.currency, status=EXCLUDED.status, sort_order=EXCLUDED.sort_order
  RETURNING id INTO pid;
  INSERT INTO platform_audit_logs(actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'credit_package_changed', 'credit_package', pid, _name, jsonb_build_object('key',_key,'credits',_credits,'price_amount',_price_amount,'currency',_currency,'status',_status));
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.platform_upsert_credit_action(_action_key text, _name text, _description text, _category text, _credit_cost integer, _active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid;
BEGIN
  PERFORM public.platform_assert_admin();
  INSERT INTO credit_action_costs(action_key, name, description, category, credit_cost, active)
  VALUES (_action_key,_name,_description,_category,_credit_cost,COALESCE(_active,false))
  ON CONFLICT (action_key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category,
    credit_cost=EXCLUDED.credit_cost, active=EXCLUDED.active
  RETURNING id INTO aid;
  INSERT INTO platform_audit_logs(actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'credit_action_changed', 'credit_action', aid, _name, jsonb_build_object('key',_action_key,'credit_cost',_credit_cost,'active',_active));
  RETURN aid;
END $$;

CREATE OR REPLACE FUNCTION public.platform_upsert_addon(_key text, _name text, _description text, _status text, _billing_type text,
  _entitlements text[], _limit_increments jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid; k text; li jsonb;
BEGIN
  PERFORM public.platform_assert_admin();
  INSERT INTO addons(key, name, description, status, billing_type)
  VALUES (_key,_name,_description,COALESCE(_status,'draft'),COALESCE(_billing_type,'recurring'))
  ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, status=EXCLUDED.status, billing_type=EXCLUDED.billing_type
  RETURNING id INTO aid;
  IF _entitlements IS NOT NULL THEN
    DELETE FROM addon_entitlements WHERE addon_id = aid;
    FOREACH k IN ARRAY _entitlements LOOP
      IF NOT public.commercial_valid_entitlement_key(k) THEN RAISE EXCEPTION 'invalid_entitlement' USING ERRCODE='22023'; END IF;
      INSERT INTO addon_entitlements(addon_id, entitlement_key) VALUES (aid, k);
    END LOOP;
  END IF;
  IF _limit_increments IS NOT NULL THEN
    DELETE FROM addon_limit_increments WHERE addon_id = aid;
    FOR li IN SELECT * FROM jsonb_array_elements(_limit_increments) LOOP
      INSERT INTO addon_limit_increments(addon_id, limit_key, increment_per_unit, is_unlimited)
      VALUES (aid, li->>'key', CASE WHEN (li->>'unlimited')::boolean THEN NULL ELSE (li->>'per_unit')::bigint END, COALESCE((li->>'unlimited')::boolean,false));
    END LOOP;
  END IF;
  INSERT INTO platform_audit_logs(actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), 'addon_changed', 'addon', aid, _name, jsonb_build_object('key',_key,'status',_status,'entitlements',_entitlements,'limit_increments',_limit_increments));
  RETURN aid;
END $$;

CREATE OR REPLACE FUNCTION public.platform_set_agency_addon(_agency_id uuid, _addon_id uuid, _active boolean, _quantity integer DEFAULT 1, _ends_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text; ak text;
BEGIN
  PERFORM public.platform_assert_admin();
  SELECT name INTO nm FROM agencies WHERE id=_agency_id; IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  SELECT key INTO ak FROM addons WHERE id=_addon_id; IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF _active THEN
    UPDATE agency_addons SET quantity=GREATEST(COALESCE(_quantity,1),1), ends_at=_ends_at
     WHERE agency_id=_agency_id AND addon_id=_addon_id AND status='active';
    IF NOT FOUND THEN
      INSERT INTO agency_addons(agency_id, addon_id, quantity, ends_at) VALUES (_agency_id,_addon_id,GREATEST(COALESCE(_quantity,1),1),_ends_at);
    END IF;
  ELSE
    UPDATE agency_addons SET status='canceled', ends_at=COALESCE(ends_at, now()) WHERE agency_id=_agency_id AND addon_id=_addon_id AND status='active';
  END IF;
  INSERT INTO platform_audit_logs(actor_user_id, action, target_type, target_id, target_label, metadata)
  VALUES (auth.uid(), CASE WHEN _active THEN 'addon_added' ELSE 'addon_removed' END, 'agency', _agency_id, nm,
          jsonb_build_object('agency_id',_agency_id,'addon',ak,'quantity',_quantity));
END $$;

-- Ausführungsrechte: nie anon
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'commercial_valid_entitlement_key(text)','commercial_can_read(uuid)','agency_active_plan_id(uuid)',
    'agency_has_entitlement(uuid,text)','agency_effective_limit(uuid,text)','credit_action_effective_cost(text)',
    'agency_commercial_state(uuid)',
    'platform_upsert_plan(text,text,text,text,integer,boolean)','platform_set_plan_entitlement(uuid,text,boolean)',
    'platform_set_plan_limit(uuid,text,bigint,boolean)','platform_upsert_credit_package(text,text,integer,numeric,text,text,integer)',
    'platform_upsert_credit_action(text,text,text,text,integer,boolean)','platform_upsert_addon(text,text,text,text,text,text[],jsonb)',
    'platform_set_agency_addon(uuid,uuid,boolean,integer,timestamptz)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;
