-- Migration preparada para conexão Google Business Profile V1.
-- NÃO EXECUTAR nesta missão.

begin;

create table if not exists public.google_business_profile_connections (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null unique references public.clinicas(id) on delete cascade,
  google_account_name text,
  google_location_name text,
  google_location_title text,
  refresh_token_ciphertext text not null,
  granted_scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists google_business_profile_connections_clinica_idx
  on public.google_business_profile_connections (clinica_id);

alter table public.google_business_profile_connections enable row level security;
revoke all on public.google_business_profile_connections from anon, authenticated;

comment on table public.google_business_profile_connections is
  'Credencial OAuth do Google Business Profile cifrada no servidor. Sem acesso direto de anon/authenticated; apenas service_role após autorização de tenant.';

commit;