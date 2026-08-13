CREATE TABLE public.client_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_assignees TO authenticated;
GRANT ALL ON public.client_assignees TO service_role;

ALTER TABLE public.client_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client assignees"
ON public.client_assignees FOR SELECT TO authenticated
USING (public.can_access_client(client_id));

CREATE POLICY "Users can manage client assignees"
ON public.client_assignees FOR ALL TO authenticated
USING (public.can_access_client(client_id))
WITH CHECK (public.can_access_client(client_id));

CREATE INDEX idx_client_assignees_client ON public.client_assignees(client_id);
CREATE INDEX idx_client_assignees_user ON public.client_assignees(user_id);

INSERT INTO public.client_assignees (client_id, user_id)
SELECT c.id, c.assigned_to FROM public.clients c
WHERE c.assigned_to IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = c.assigned_to)
ON CONFLICT DO NOTHING;