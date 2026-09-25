INSERT INTO public.tenant_domains (agency_id, domain, domain_type, is_primary, verification_status, verified_at, activated_at)
SELECT '69eb3646-8b0e-4f96-b3c9-143e5739d224', 'crm.asimo.ch', 'custom', true, 'verified', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_domains WHERE domain = 'crm.asimo.ch');