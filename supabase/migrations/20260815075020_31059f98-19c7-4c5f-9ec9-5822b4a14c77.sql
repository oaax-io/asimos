CREATE TABLE public.livekit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
  ws_url text,
  api_key text,
  api_secret text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.livekit_settings TO authenticated;
GRANT ALL ON public.livekit_settings TO service_role;

ALTER TABLE public.livekit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view livekit settings"
ON public.livekit_settings FOR SELECT TO authenticated
USING (public.is_owner_or_admin() OR public.is_superadmin());

CREATE POLICY "Admins can insert livekit settings"
ON public.livekit_settings FOR INSERT TO authenticated
WITH CHECK (public.is_owner_or_admin() OR public.is_superadmin());

CREATE POLICY "Admins can update livekit settings"
ON public.livekit_settings FOR UPDATE TO authenticated
USING (public.is_owner_or_admin() OR public.is_superadmin())
WITH CHECK (public.is_owner_or_admin() OR public.is_superadmin());

CREATE POLICY "Admins can delete livekit settings"
ON public.livekit_settings FOR DELETE TO authenticated
USING (public.is_owner_or_admin() OR public.is_superadmin());

CREATE TRIGGER set_livekit_settings_updated_at
BEFORE UPDATE ON public.livekit_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.video_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name text NOT NULL,
  title text,
  context_type text NOT NULL DEFAULT 'chat',
  context_id uuid,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participants uuid[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_calls_room ON public.video_calls(room_name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_calls TO authenticated;
GRANT ALL ON public.video_calls TO service_role;

ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view calls"
ON public.video_calls FOR SELECT TO authenticated
USING (created_by = auth.uid() OR auth.uid() = ANY(participants));

CREATE POLICY "Users can create calls"
ON public.video_calls FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Participants can update calls"
ON public.video_calls FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR auth.uid() = ANY(participants))
WITH CHECK (created_by = auth.uid() OR auth.uid() = ANY(participants));

CREATE TRIGGER set_video_calls_updated_at
BEFORE UPDATE ON public.video_calls
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();