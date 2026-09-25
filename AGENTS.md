
- Platform Admin Center (/platform) reads tenant metadata only via platform_* SECURITY DEFINER RPCs gated by is_platform_admin(); why: platform roles must never bypass tenant RLS or expose CRM data.
