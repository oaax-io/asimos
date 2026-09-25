INSERT INTO public.agencies(id,name) VALUES ('00000000-0000-0000-0000-00000000b0b0','TEST Bergblick (temporär)') ON CONFLICT DO NOTHING;
INSERT INTO public.brand_settings(agency_id,company_name,primary_color,accent_color)
  SELECT '00000000-0000-0000-0000-00000000b0b0','Bergblick Immobilien GmbH','#1f7a4d','#c2410c'
  WHERE NOT EXISTS (SELECT 1 FROM public.brand_settings WHERE agency_id='00000000-0000-0000-0000-00000000b0b0');
INSERT INTO public.tenant_domains(agency_id,domain,domain_type,verification_status) VALUES
 ('69eb3646-8b0e-4f96-b3c9-143e5739d224','asimo-test.localhost','custom','verified'),
 ('00000000-0000-0000-0000-00000000b0b0','bergblick-test.localhost','custom','verified'),
 ('69eb3646-8b0e-4f96-b3c9-143e5739d224','pending-test.localhost','custom','pending');