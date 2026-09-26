CREATE OR REPLACE FUNCTION public.agency_commercial_state(_agency_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid; res jsonb;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_agency_owner_or_admin(_agency_id) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  _pid := public.agency_active_plan_id(_agency_id);
  SELECT jsonb_build_object(
    'agency_id', _agency_id,
    'agency_active', public.agency_is_active(_agency_id),
    'commercial_enforced', false,
    'plan', (SELECT jsonb_build_object('id', p.id, 'key', p.key, 'name', p.name, 'status', p.status) FROM plans p WHERE p.id = _pid),
    'subscription', (SELECT jsonb_build_object('status', s.status, 'billing_period', s.billing_period, 'trial_end', s.trial_end,
                       'current_period_end', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end)
                     FROM subscriptions s WHERE s.agency_id = _agency_id ORDER BY s.created_at DESC LIMIT 1),
    'entitlements', COALESCE((SELECT jsonb_agg(DISTINCT k ORDER BY k) FROM (
        SELECT pe.entitlement_key k FROM plan_entitlements pe WHERE pe.plan_id = _pid AND pe.enabled
        UNION SELECT ae.entitlement_key FROM agency_addons aa JOIN addons a ON a.id=aa.addon_id AND a.status<>'draft'
          JOIN addon_entitlements ae ON ae.addon_id=aa.addon_id
          WHERE aa.agency_id=_agency_id AND aa.status='active' AND aa.starts_at<=now() AND (aa.ends_at IS NULL OR aa.ends_at>now())) x), '[]'::jsonb),
    'limits', COALESCE((SELECT jsonb_agg(public.agency_effective_limit(_agency_id, k) ORDER BY k) FROM (
        SELECT limit_key k FROM plan_limits WHERE plan_limits.plan_id = _pid
        UNION SELECT i.limit_key FROM agency_addons aa JOIN addon_limit_increments i ON i.addon_id=aa.addon_id
          WHERE aa.agency_id=_agency_id AND aa.status='active') y), '[]'::jsonb),
    'addons', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', a.key, 'name', a.name, 'quantity', aa.quantity, 'status', aa.status, 'ends_at', aa.ends_at))
        FROM agency_addons aa JOIN addons a ON a.id = aa.addon_id WHERE aa.agency_id = _agency_id), '[]'::jsonb),
    'credits', COALESCE((SELECT jsonb_object_agg(bucket, total) FROM (
        SELECT bucket, SUM(delta) total FROM credit_ledger
        WHERE agency_id = _agency_id AND (expires_at IS NULL OR expires_at > now()) GROUP BY bucket) c), '{}'::jsonb)
  ) INTO res;
  RETURN res;
END $function$;