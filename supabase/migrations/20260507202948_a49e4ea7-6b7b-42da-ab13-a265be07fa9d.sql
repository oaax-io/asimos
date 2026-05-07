create table if not exists public.financing_dossiers_scenarios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  dossier_id uuid not null references public.financing_dossiers(id) on delete cascade,
  bezeichnung text not null,
  kaufpreis numeric,
  eigenmittel numeric,
  bruttoeinkommen numeric,
  hypothek numeric,
  kalk_zinssatz numeric,
  tragbarkeit numeric,
  belehnung numeric,
  eigenmittelquote numeric,
  harte_eigenmittel numeric,
  status text
);

create index if not exists financing_dossiers_scenarios_dossier_idx
  on public.financing_dossiers_scenarios(dossier_id, created_at desc);

alter table public.financing_dossiers_scenarios enable row level security;

create policy "scenarios_authenticated_all"
  on public.financing_dossiers_scenarios for all
  to authenticated
  using (true)
  with check (true);

create policy "scenarios_superadmin_all"
  on public.financing_dossiers_scenarios for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());