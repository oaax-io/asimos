INSERT INTO public.document_templates (name, type, content, is_active, is_system)
VALUES
  ('Maklermandat (Exklusiv) – Standard', 'mandate', '', true, true),
  ('Maklermandat (Teilexklusiv) – Standard', 'mandate_partial', '', true, true),
  ('Reservationsvereinbarung – Standard', 'reservation', '', true, true),
  ('NDA / Vertraulichkeit – Standard', 'nda', '', true, true)
ON CONFLICT DO NOTHING;