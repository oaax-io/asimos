CREATE TABLE IF NOT EXISTS public.property_assignees (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (property_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_assignees TO authenticated;
GRANT ALL ON public.property_assignees TO service_role;
ALTER TABLE public.property_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view property assignees" ON public.property_assignees FOR SELECT TO authenticated USING (public.can_access_property(property_id));
CREATE POLICY "Users can manage property assignees" ON public.property_assignees FOR ALL TO authenticated USING (public.can_access_property(property_id)) WITH CHECK (public.can_access_property(property_id));
INSERT INTO public.property_assignees (property_id, user_id)
SELECT id, assigned_to FROM public.properties WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;