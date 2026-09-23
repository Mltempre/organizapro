-- Contador IA — Fechamento Inteligente V1 (continuação: fluxo operacional).
--
-- PROPOSTA — NÃO EXECUTAR sem GO explícito. Nenhum SQL rodado contra
-- Supabase nesta missão. Depende de 20260923000001_fechamento_contabil_v1.sql
-- já aplicada antes desta.
--
-- Reaproveita a mesma clínica/cliente/competência já modeladas na V1.
-- Bucket de Storage é criado em runtime pela rota de upload (mesmo padrão
-- já usado por app/api/upload/route.ts, supabase.storage.createBucket),
-- nunca via SQL — mas privado (public: false) aqui, diferente do bucket
-- público de assets de site: documento contábil nunca pode ter URL
-- pública adivinhável.

begin;

-- ── 1. Arquivos recebidos — todo upload, mesmo os que vão para revisão ──
create table if not exists public.fechamento_arquivos (
  id                      uuid primary key default gen_random_uuid(),
  clinica_id              uuid not null references public.clinicas(id),
  cliente_id              uuid not null references public.pacientes(id),
  competencia             text not null check (competencia ~ '^\d{4}-\d{2}$'),
  nome_original           text not null,
  storage_path            text not null,
  tamanho_bytes           integer not null check (tamanho_bytes > 0),
  mime_type               text not null,
  tipo_documento_sugerido text, -- null quando a identificação não reconheceu nenhum tipo
  confianca               text not null check (confianca in ('alta', 'media', 'baixa')),
  classificacao_status    text not null default 'pendente_confirmacao'
    check (classificacao_status in ('auto_confirmado', 'pendente_confirmacao', 'confirmado_manual')),
  motivo_classificacao    text not null,
  tipo_documento_final    text, -- preenchido quando auto_confirmado ou confirmado_manual
  enviado_por             uuid,
  criado_em               timestamptz not null default now()
);

create index if not exists fechamento_arquivos_clinica_competencia_idx
  on public.fechamento_arquivos (clinica_id, cliente_id, competencia);
create index if not exists fechamento_arquivos_revisao_idx
  on public.fechamento_arquivos (clinica_id, classificacao_status)
  where classificacao_status = 'pendente_confirmacao';

alter table public.fechamento_arquivos enable row level security;

comment on table public.fechamento_arquivos is
  'Contador IA V1. Todo arquivo recebido, mesmo os que a identificação não conseguiu classificar com confiança — trilha completa de "quem enviou o quê". auto_confirmado = identificação com confiança alta deu baixa sozinha; pendente_confirmacao = REVISÃO NECESSÁRIA (nunca baixa automática em documento duvidoso); confirmado_manual = um humano revisou e confirmou o tipo.';

create or replace function public.fechamento_arquivos_valida_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.pacientes
    where id = new.cliente_id and clinica_id = new.clinica_id
  ) then
    raise exception 'cliente_id % nao pertence a clinica_id %', new.cliente_id, new.clinica_id;
  end if;
  return new;
end;
$$;

create trigger fechamento_arquivos_valida_tenant_trg
  before insert or update of cliente_id, clinica_id on public.fechamento_arquivos
  for each row execute function public.fechamento_arquivos_valida_tenant();

-- ── 2. fechamento_documentos: 4º status + vínculo com o arquivo real ────
alter table public.fechamento_documentos
  drop constraint if exists fechamento_documentos_status_check;
alter table public.fechamento_documentos
  add constraint fechamento_documentos_status_check
  check (status in ('pendente', 'recebido', 'invalido', 'revisao_necessaria'));

alter table public.fechamento_documentos
  add column if not exists arquivo_id uuid references public.fechamento_arquivos(id);

comment on column public.fechamento_documentos.status is
  'pendente (padrão) -> recebido (resolvido, nunca mais cobrado) | invalido (rejeitado, precisa reenvio) | revisao_necessaria (arquivo chegou mas a identificação não teve confiança suficiente — nunca fabricada como recebido). Toda transição é ação humana explícita ou baixa automática só quando a identificação teve confiança alta (ver lib/fechamento-identificacao.ts).';
comment on column public.fechamento_documentos.arquivo_id is
  'Arquivo real (public.fechamento_arquivos) que atualmente sustenta este status — nulo quando o status foi definido manualmente sem upload (ex.: reabrir).';

-- ── 3. Exceções por cliente — padrão da clínica + exceções pontuais ─────
create table if not exists public.fechamento_excecoes_cliente (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinicas(id),
  cliente_id      uuid not null references public.pacientes(id),
  tipo_documento  text not null,
  incluido        boolean not null,
  criado_em       timestamptz not null default now(),
  unique (clinica_id, cliente_id, tipo_documento)
);

create index if not exists fechamento_excecoes_cliente_idx
  on public.fechamento_excecoes_cliente (clinica_id, cliente_id);

alter table public.fechamento_excecoes_cliente enable row level security;

create or replace function public.fechamento_excecoes_valida_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.pacientes
    where id = new.cliente_id and clinica_id = new.clinica_id
  ) then
    raise exception 'cliente_id % nao pertence a clinica_id %', new.cliente_id, new.clinica_id;
  end if;
  return new;
end;
$$;

create trigger fechamento_excecoes_valida_tenant_trg
  before insert or update of cliente_id, clinica_id on public.fechamento_excecoes_cliente
  for each row execute function public.fechamento_excecoes_valida_tenant();

comment on table public.fechamento_excecoes_cliente is
  'Contador IA V1. PADRÃO DA CLÍNICA (fechamento_tipos_documento) + EXCEÇÕES DO CLIENTE aqui — incluido:false remove um tipo padrão deste cliente (ex.: não tem folha); incluido:true adiciona um tipo extra só para este cliente. Nunca duplica a configuração inteira por cliente.';

commit;

-- ── Rollback ────────────────────────────────────────────────────────────
-- begin;
-- drop trigger if exists fechamento_excecoes_valida_tenant_trg on public.fechamento_excecoes_cliente;
-- drop function if exists public.fechamento_excecoes_valida_tenant();
-- drop table if exists public.fechamento_excecoes_cliente;
-- alter table public.fechamento_documentos drop column if exists arquivo_id;
-- alter table public.fechamento_documentos drop constraint if exists fechamento_documentos_status_check;
-- alter table public.fechamento_documentos add constraint fechamento_documentos_status_check check (status in ('pendente', 'recebido', 'invalido'));
-- drop trigger if exists fechamento_arquivos_valida_tenant_trg on public.fechamento_arquivos;
-- drop function if exists public.fechamento_arquivos_valida_tenant();
-- drop table if exists public.fechamento_arquivos;
-- commit;
