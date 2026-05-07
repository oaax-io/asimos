alter table public.financing_dossiers
  add column if not exists co_applicant_client_id uuid
    references public.clients(id) on delete set null,
  add column if not exists co_applicant_role text
    check (co_applicant_role in ('ehepartner', 'mitantragsteller')),
  add column if not exists co_applicant_einkommen numeric,
  add column if not exists co_applicant_eigenkapital numeric,
  add column if not exists co_applicant_pk_anteil numeric default 0,
  add column if not exists einkommen_kombiniert numeric,
  add column if not exists eigenkapital_kombiniert numeric,
  add column if not exists pk_anteil_kombiniert numeric;