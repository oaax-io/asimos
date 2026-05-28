CREATE UNIQUE INDEX IF NOT EXISTS client_relationships_unique_pair
ON public.client_relationships (
  LEAST(client_id, related_client_id),
  GREATEST(client_id, related_client_id),
  relationship_type
);