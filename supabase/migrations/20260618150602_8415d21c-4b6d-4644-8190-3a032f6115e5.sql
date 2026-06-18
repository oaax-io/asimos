
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS public_token text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS public_enabled boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS properties_public_token_uniq ON public.properties(public_token) WHERE public_token IS NOT NULL;

-- Toggle public link (only users with access)
CREATE OR REPLACE FUNCTION public.property_set_public(_id uuid, _enabled boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  tok text;
BEGIN
  IF NOT public.can_access_property(_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT public_token INTO tok FROM public.properties WHERE id = _id;
  IF _enabled AND tok IS NULL THEN
    tok := encode(extensions.gen_random_bytes(16), 'hex');
  END IF;

  UPDATE public.properties
    SET public_enabled = _enabled,
        public_token   = COALESCE(tok, public_token),
        updated_at     = now()
  WHERE id = _id;

  RETURN tok;
END;
$$;

REVOKE ALL ON FUNCTION public.property_set_public(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.property_set_public(uuid, boolean) TO authenticated;

-- Public viewer (anon, by token)
CREATE OR REPLACE FUNCTION public.public_property_view(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.properties%ROWTYPE;
  result jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO p FROM public.properties
    WHERE public_token = _token AND public_enabled = true
    LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'property', jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'description', p.description,
      'property_type', p.property_type,
      'listing_type', p.listing_type,
      'status', p.status,
      'address', p.address,
      'postal_code', p.postal_code,
      'city', p.city,
      'country', p.country,
      'price', p.price,
      'rent', p.rent,
      'living_area', p.living_area,
      'plot_area', p.plot_area,
      'area', p.area,
      'rooms', p.rooms,
      'bathrooms', p.bathrooms,
      'floor', p.floor,
      'total_floors', p.total_floors,
      'year_built', p.year_built,
      'renovated_at', p.renovated_at,
      'energy_class', p.energy_class,
      'heating_type', p.heating_type,
      'condition', p.condition,
      'features', p.features,
      'images', p.images,
      'macro_location', p.macro_location,
      'is_unit', p.is_unit
    ),
    'market_analysis', (
      SELECT to_jsonb(ma) FROM (
        SELECT sections, created_at, model
        FROM public.property_market_analyses
        WHERE property_id = p.id
        ORDER BY created_at DESC
        LIMIT 1
      ) ma
    ),
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id,
        'title', u.title,
        'property_type', u.property_type,
        'listing_type', u.listing_type,
        'status', u.status,
        'price', u.price,
        'rent', u.rent,
        'living_area', u.living_area,
        'rooms', u.rooms,
        'bathrooms', u.bathrooms,
        'floor', u.floor,
        'images', u.images
      ) ORDER BY u.floor NULLS LAST, u.title)
      FROM public.properties u
      WHERE u.parent_property_id = p.id
    ), '[]'::jsonb),
    'media', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'file_url', m.file_url,
        'file_type', m.file_type,
        'is_cover', m.is_cover,
        'sort_order', m.sort_order
      ) ORDER BY m.is_cover DESC NULLS LAST, m.sort_order NULLS LAST)
      FROM public.property_media m
      WHERE m.property_id = p.id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.public_property_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_property_view(text) TO anon, authenticated;
