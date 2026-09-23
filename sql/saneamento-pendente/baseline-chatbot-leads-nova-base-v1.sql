-- FUTURO BASELINE - NAO EXECUTAR SEM GO E PRE-FLIGHT SALVO.
-- Caminho A: instalacao nova, somente quando public.chatbot_leads NAO existe.
-- As migrations 20260624000000/000001 ficam historicas; esta e a definicao
-- integral exigida pelo codigo atual, sem atravessar estados intermediarios.

begin;

do $$
begin
  if to_regclass('public.chatbot_leads') is not null then
    raise exception 'chatbot_leads ja existe; usar o caminho de reconciliacao';
  end if;
  if to_regclass('public.clinicas') is null then
    raise exception 'clinicas ausente';
  end if;
end $$;

create table public.chatbot_leads (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  ultima_interacao  timestamptz,
  clinica_id        uuid not null references public.clinicas(id) on delete cascade,
  telefone          text not null,
  nome              text,
  cidade            text,
  especialidade     text,
  pacientes_mes     text,
  porte_clinica     text,
  sistema_atual     text,
  interesse         text,
  dor               text,
  dor_principal     text,
  mensagem_original text,
  status            text not null default 'novo',
  score             integer not null default 10
    check (score in (10, 50, 100)),
  etapa             text not null default 'inicial',
  origem            text,
  constraint chatbot_leads_clinica_telefone_uniq unique (clinica_id, telefone)
);

create or replace function public.chatbot_leads_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger chatbot_leads_updated_a
  before update on public.chatbot_leads
  for each row execute function public.chatbot_leads_set_updated_at();

alter table public.chatbot_leads enable row level security;
revoke all on public.chatbot_leads from public, anon, authenticated;

comment on table public.chatbot_leads is
  'Lead SDR server-side por tenant. Sem acesso direto para anon/authenticated.';

commit;

-- Rollback futuro (somente antes de receber dados):
-- begin;
-- drop table public.chatbot_leads;
-- drop function public.chatbot_leads_set_updated_at();
-- commit;
