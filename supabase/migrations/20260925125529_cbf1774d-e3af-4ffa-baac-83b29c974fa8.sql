UPDATE public.brand_settings
SET logo_alt_url = COALESCE(logo_alt_url, '/__l5e/assets-v1/65623d84-6d79-45e3-a7dc-bf2e0ba0b7dd/logo-asimo-2027.png'),
    favicon_url = COALESCE(favicon_url, '/__l5e/assets-v1/5af1e080-3e92-4ea5-bf01-0e76af67d41b/logo-asimo-icon.png')
WHERE agency_id = '69eb3646-8b0e-4f96-b3c9-143e5739d224';