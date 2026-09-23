-- FUTURO FIX - NAO EXECUTAR SEM GO E PRE-FLIGHT SALVO.
-- Caminho B: tabela existente/parcial. Falha se encontrar score textual
-- desconhecido, tipo inesperado, duplicidade ou clinica inexistente.

begin;

do $$
begin
  if to_regclass('public.chatbot_leads') is null then
    raise exception 'chatbot_leads ausente; usar baseline de nova base';
  end if;
  if to_regclass('public.clinicas') is null then
    raise exception 'clinicas ausente';
  end if;
end $$;

alter table public.chatbot_leads
  add column if not exists ultima_interacao timestamptz,
  add column if not exists porte_clinica text,
  add column if not exists sistema_atual text,
  add column if not exists dor_principal text,
  add column if not exists origem text,
  add column if not exists etapa text;

update public.chatbot_leads set etapa = 'inicial' where etapa is null;
alter table public.chatbot_leads alter column etapa set default 'inicial';
alter table public.chatbot_leads alter column etapa set not null;

do $$
declare
  score_type text;
  invalidos bigint;
begin
  select data_type into score_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'chatbot_leads'
    and column_name = 'score';

  if score_type is null then
    alter table public.chatbot_leads
      add column score integer not null default 10;
  elsif score_type = 'text' then
    select count(*) into invalidos
    from public.chatbot_leads
    where score is null or score not in ('frio', 'morno', 'quente', '10', '50', '100');
    if invalidos > 0 then
      raise exception '% scores textuais nao possuem mapeamento canonico', invalidos;
    end if;

    alter table public.chatbot_leads alter column score drop default;
    alter table public.chatbot_leads
      alter column score type integer
      using case score
        when 'quente' then 100
        when 'morno' then 50
        when 'frio' then 10
        else score::integer
      end;
  elsif score_type <> 'integer' then
    raise exception 'tipo inesperado de score: %', score_type;
  end if;
end $$;

do $$
declare
  invalidos bigint;
  duplicados bigint;
  clinicas_ausentes bigint;
begin
  select count(*) into invalidos
  from public.chatbot_leads
  where score is null or score not in (10, 50, 100);
  if invalidos > 0 then
    raise exception '% scores inteiros fora do contrato 10/50/100', invalidos;
  end if;

  select count(*) into duplicados
  from (
    select clinica_id, telefone
    from public.chatbot_leads
    group by clinica_id, telefone
    having count(*) > 1
  ) d;
  if duplicados > 0 then
    raise exception '% chaves (clinica_id, telefone) duplicadas', duplicados;
  end if;

  select count(*) into clinicas_ausentes
  from public.chatbot_leads l
  left join public.clinicas c on c.id = l.clinica_id
  where c.id is null;
  if clinicas_ausentes > 0 then
    raise exception '% leads apontam para clinica inexistente', clinicas_ausentes;
  end if;
end $$;

alter table public.chatbot_leads alter column score set default 10;
alter table public.chatbot_leads alter column score set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.chatbot_leads'::regclass
      and conname = 'chatbot_leads_score_chk'
  ) then
    alter table public.chatbot_leads
      add constraint chatbot_leads_score_chk
      check (score in (10, 50, 100)) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.chatbot_leads'::regclass
      and conname = 'chatbot_leads_clinica_fk'
  ) then
    alter table public.chatbot_leads
      add constraint chatbot_leads_clinica_fk
      foreign key (clinica_id) references public.clinicas(id) on delete cascade
      not valid;
  end if;
end $$;

alter table public.chatbot_leads validate constraint chatbot_leads_score_chk;
alter table public.chatbot_leads validate constraint chatbot_leads_clinica_fk;

create unique index if not exists chatbot_leads_clinica_telefone_uidx
  on public.chatbot_leads (clinica_id, telefone);

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

drop trigger if exists chatbot_leads_updated_at on public.chatbot_leads;
create trigger chatbot_leads_updated_a
  before update on public.chatbot_leads
  for each row execute function public.chatbot_leads_set_updated_at();

alter table public.chatbot_leads enable row level security;
revoke all on public.chatbot_leads from public, anon, authenticated;

commit;

-- Rollback futuro exige backup de schema/dados e do tipo original de score.
-- A conversao text -> integer nao possui rollback generico sem conhecer os
-- valores anteriores; restaurar pelo backup realizado no pre-flight.
