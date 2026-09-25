
CREATE TABLE IF NOT EXISTS public.reserved_subdomains (
  name text PRIMARY KEY CHECK (name = lower(name)),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reserved_subdomains TO authenticated;
GRANT ALL ON public.reserved_subdomains TO service_role;
ALTER TABLE public.reserved_subdomains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reserved_subdomains_read" ON public.reserved_subdomains FOR SELECT TO authenticated USING (true);
CREATE POLICY "reserved_subdomains_platform_write" ON public.reserved_subdomains FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

INSERT INTO public.reserved_subdomains(name, reason) VALUES
 ('www','reserved'),('app','reserved'),('api','reserved'),('admin','reserved'),
 ('platform','reserved'),('mail','reserved'),('support','reserved'),('status','reserved'),
 ('help','reserved'),('docs','reserved'),('auth','reserved'),('login','reserved'),
 ('immolia','reserved'),('cdn','reserved'),('static','reserved'),('assets','reserved'),
 ('billing','reserved'),('account','reserved'),('accounts','reserved'),('dev','reserved'),
 ('staging','reserved'),('test','reserved'),('preview','reserved'),('portal','reserved'),
 ('webhook','reserved'),('webhooks','reserved'),('smtp','reserved'),('ftp','reserved'),
 ('ns','reserved'),('ns1','reserved'),('ns2','reserved'),('mx','reserved'),('root','reserved'),
 ('security','reserved'),('legal','reserved'),('blog','reserved'),('shop','reserved'),
 ('my','reserved'),('me','reserved'),('crm','reserved')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tenant_subdomain_root()
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'immolia.ch'::text $$;

CREATE OR REPLACE FUNCTION public.tg_tenant_domains_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  d text;
  slug text;
  root text := public.tenant_subdomain_root();
BEGIN
  d := lower(btrim(COALESCE(NEW.domain, '')));
  d := regexp_replace(d, '\.$', '');
  d := regexp_replace(d, ':\d+$', '');
  IF d = '' THEN
    RAISE EXCEPTION 'Domain darf nicht leer sein';
  END IF;
  IF d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' OR length(d) > 253 THEN
    RAISE EXCEPTION 'Ungueltige Domain: %', d;
  END IF;
  NEW.domain := d;

  IF NEW.domain_type = 'subdomain' THEN
    IF d NOT LIKE '%.' || root THEN
      RAISE EXCEPTION 'Subdomain muss auf %s enden', root;
    END IF;
    slug := left(d, length(d) - length(root) - 1);
    IF slug !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' OR slug LIKE '%.%' THEN
      RAISE EXCEPTION 'Ungueltiger Slug: %', slug;
    END IF;
    IF length(slug) < 2 THEN
      RAISE EXCEPTION 'Slug zu kurz: %', slug;
    END IF;
    IF EXISTS (SELECT 1 FROM public.reserved_subdomains r WHERE r.name = slug) THEN
      RAISE EXCEPTION 'Slug ist reserviert: %', slug;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_domains_validate ON public.tenant_domains;
CREATE TRIGGER tenant_domains_validate
BEFORE INSERT OR UPDATE ON public.tenant_domains
FOR EACH ROW EXECUTE FUNCTION public.tg_tenant_domains_validate();

CREATE OR REPLACE FUNCTION public.tenant_subdomain_available(_slug text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s text; BEGIN
  s := lower(btrim(COALESCE(_slug,'')));
  IF s !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' OR length(s) < 2 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.reserved_subdomains r WHERE r.name = s) THEN RETURN false; END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM public.tenant_domains d
    WHERE lower(d.domain) = s || '.' || public.tenant_subdomain_root()
  );
END; $$;
REVOKE ALL ON FUNCTION public.tenant_subdomain_available(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_subdomain_available(text) TO service_role;
