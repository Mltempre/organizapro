-- chatbot_leads — schema DEFINITIVO com suporte SDR completo
-- Execute este arquivo no SQL Editor do Supabase.
-- É seguro executar mesmo que as migrações anteriores (000000, 000001, 000002) já tenham sido rodadas.

-- ── 1. Cria tabela se não existir (schema completo) ──────────────────────────
create table if not exists public.chatbot_leads (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  ultima_interacao  timestamptz,
  clinica_id        uuid        not null,
  telefone          text        not null,
  nome              text,
  cidade            text,
  especialidade     text,
  pacientes_mes     text,
  porte_clinica     text,         -- pequena / media / grande
  sistema_atual     text,         -- planilha / papel / outro_sistema / nenhum
  interesse         text,
  dor               text,
  dor_principal     text,         -- faltas / whatsapp / google / site / marketing / organizacao / outro
  mensagem_original text,
  status            text        not null default 'novo',
  score             integer     not null default 10,   -- 10=frio  50=morno  100=quente
  etapa             text        not null default 'inicial',
  origem            text,
  constraint chatbot_leads_clinica_telefone unique (clinica_id, telefone)
);

-- ── 2. Adiciona colunas faltantes (idempotente) ───────────────────────────────
alter table public.chatbot_leads
  add column if not exists ultima_interacao  timestamptz,
  add column if not exists porte_clinica     text,
  add column if not exists sistema_atual     text,
  add column if not exists dor_principal     text,
  add column if not exists origem            text;

-- Garante que etapa existe (v1 não a tinha)
alter table public.chatbot_leads add column if not exists etapa text;
update public.chatbot_leads set etapa = 'inicial' where etapa is null;

-- ── 3. Converte score de text → integer (caso v2 já tenha sido rodada) ───────
do $$
begin
  -- Se score existe como text, converte
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'chatbot_leads'
      and column_name  = 'score'
      and data_type    = 'text'
  ) then
    alter table public.chatbot_leads add column score_tmp integer not null default 10;
    update public.chatbot_leads set score_tmp = case
      when score = 'quente' then 100
      when score = 'morno'  then  50
      else 10
    end;
    alter table public.chatbot_leads drop column score;
    alter table public.chatbot_leads rename column score_tmp to score;
  end if;

  -- Se score não existe ainda (tabela criada sem ela), adiciona
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'chatbot_leads'
      and column_name  = 'score'
  ) then
    alter table public.chatbot_leads add column score integer not null default 10;
  end if;
end $$;

-- ── 4. Trigger updated_at ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chatbot_leads_updated_at on public.chatbot_leads;
create trigger chatbot_leads_updated_at
  before update on public.chatbot_leads
  for each row execute function public.set_updated_at();

-- ── 5. RLS — apenas service role acessa ─────────────────────────────────────
alter table public.chatbot_leads enable row level security;
