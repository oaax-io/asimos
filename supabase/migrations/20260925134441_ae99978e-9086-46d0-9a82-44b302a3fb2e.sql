DELETE FROM public.tenant_domains WHERE domain IN ('asimo-test.localhost','bergblick-test.localhost','pending-test.localhost');
DELETE FROM public.brand_settings WHERE agency_id = '00000000-0000-0000-0000-00000000b0b0';
DELETE FROM public.agencies WHERE id = '00000000-0000-0000-0000-00000000b0b0';