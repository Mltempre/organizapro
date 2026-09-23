-- Contador IA — Fechamento Inteligente V1.
--
-- PROPOSTA — NÃO EXECUTAR sem GO explícito. Nenhum SQL rodado contra
-- Supabase nesta missão.
--
-- Auditoria prévia (ver docs/fechamento-contabil-v1.md): nenhuma estrutura
-- existente cobre "checklist de documentos obrigatórios por cliente e
-- competência". public.eventos_dominio é log de eventos (append-only),
-- nunca o lugar certo para ESTADO mutável consultável em lista (mesmo
-- motivo por que orcamentos/tratamentos/cobrancas/pedidos são tabelas
-- próprias, não eventos_dominio). public.pacientes é reaproveitado
-- integralmente como "cliente" (empresa atendida pelo contador) — nenhuma
-- tabela de cliente nova.

begin;

-- ── 1. Tipos de documento exigidos — configuráveis por clínica ───────────
create table if not exists public.fechamento_tipos_documento (
  id           uuid primary key default gen_random_uuid(),
  clinica_id   uuid not null references public.clinicas(id),
  nome         text not null,
  obrigatorio  boolean not null default true,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  unique (clinica_id, nome)
);

create index if not exists fechamento_tipos_documento_clinica_idx
  on public.fechamento_tipos_documento (clinica_id, ativo);

alter table public.fechamento_tipos_documento enable row level security;
-- Mesmo padrão já homologado em orcamentos/tratamentos/cobrancas/pedidos:
-- RLS habilitada sem nenhuma policy — acesso só via service role
-- (autorizarUsuarioNaClinica na camada de aplicação, nunca duplicado em SQL).

comment on table public.fechamento_tipos_documento is
  'Contador IA V1. Documentos exigidos para o fechamento mensal, configuráveis por clínica (ex.: Extrato bancário, Notas fiscais, Folha, Comprovantes). Nenhum tipo é pré-cadastrado automaticamente — cada clínica configura o próprio checklist.';

-- ── 2. Estado do documento por cliente/competência ────────────────────────
create table if not exists public.fechamento_documentos (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinicas(id),
  cliente_id      uuid not null references public.pacientes(id),
  competencia     text not null check (competencia ~ '^\d{4}-\d{2}$'),
  tipo_documento  text not null,
  status          text not null default 'pendente'
    check (status in ('pendente', 'recebido', 'invalido')),
  observacao      text,
  recebido_em     timestamptz,
  atualizado_por  uuid,
  criado_em       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clinica_id, cliente_id, competencia, tipo_documento)
);

create index if not exists fechamento_documentos_clinica_competencia_idx
  on public.fechamento_documentos (clinica_id, competencia);
create index if not exists fechamento_documentos_cliente_idx
  on public.fechamento_documentos (clinica_id, cliente_id, competencia);

alter table public.fechamento_documentos enable row level security;

create trigger fechamento_documentos_atualiza_timestamp_trg
  before update on public.fechamento_documentos
  for each row execute function public.set_updated_at();
-- Reaproveita public.set_updated_at() (já real, já usada por pedidos e
-- outras tabelas do schema) — nunca uma segunda função idêntica.

comment on table public.fechamento_documentos is
  'Contador IA V1. Estado de cada documento obrigatório por cliente/competência. Ausência de linha para um tipo = pendente por definição (nunca uma linha "recebido" é fabricada por omissão).';
comment on column public.fechamento_documentos.competencia is
  'Formato AAAA-MM (mês de referência do fechamento) — nunca uma data completa, nunca confundido com a data de emissão do documento.';
comment on column public.fechamento_documentos.status is
  'pendente (padrão/aguardando) -> recebido (documento entregue e conferido) | invalido (entregue mas rejeitado — bloqueia o fechamento até nova entrega). Sem automação: toda transição é uma ação humana explícita via POST /api/fechamento/documento.';

-- Integridade cross-tenant: cliente_id precisa pertencer à MESMA
-- clinica_id — mesmo padrão de trigger já usado em pedido_itens.
create or replace function public.fechamento_documentos_valida_tenant()
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

create trigger fechamento_documentos_valida_tenant_trg
  before insert or update of cliente_id, clinica_id on public.fechamento_documentos
  for each row execute function public.fechamento_documentos_valida_tenant();

commit;

-- ── Rollback ────────────────────────────────────────────────────────────
-- begin;
-- drop trigger if exists fechamento_documentos_valida_tenant_trg on public.fechamento_documentos;
-- drop function if exists public.fechamento_documentos_valida_tenant();
-- drop trigger if exists fechamento_documentos_atualiza_timestamp_trg on public.fechamento_documentos;
-- drop table if exists public.fechamento_documentos;
-- drop table if exists public.fechamento_tipos_documento;
-- commit;
