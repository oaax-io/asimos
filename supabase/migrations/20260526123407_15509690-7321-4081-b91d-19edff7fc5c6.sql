ALTER TABLE public.nda_agreements
  ADD CONSTRAINT nda_agreements_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD CONSTRAINT nda_agreements_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;