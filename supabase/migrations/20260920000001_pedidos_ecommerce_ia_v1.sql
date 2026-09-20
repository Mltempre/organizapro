-- E-commerce IA V1 — Catálogo + Pedidos.
--
-- PROPOSTA — NÃO EXECUTAR sem GO explícito. Nenhum SQL rodado contra
-- Supabase nesta missão.
--
-- Base: auditoria já feita e aprovada (classificação B — segura com
-- correções) em docs/ecommerce-ia-v1-arquitetura.md (branch
-- audit/smart-commerce-precheck, commits c6b81ae/173800e). Esta versão
-- difere dessa proposta original em dois pontos, deliberados, para
-- convergir com o padrão já canônico e testado em
-- convergencia/orcamentos (commit 5550d2d):
--   1. `pedidos` não tem `idempotency_key` própria — reaproveita
--      public.eventos_dominio (já real em Production, já usada por
--      orcamentos/tratamentos/cobrancas), evitando uma segunda fonte de
--      verdade para idempotência.
--   2. `pedidos`/`pedido_itens` ficam RLS-enabled-sem-policy (acesso só
--      via service role), mesmo padrão de orcamentos/tratamentos/
--      cobrancas — não as policies client-side propostas originalmente.
--      O endurecimento `clinica_usuarios.ativo = true` que aquela
--      proposta adicionava nas policies já é feito na camada de aplicação
--      por autorizarUsuarioNaClinica (lib/auth-clinica.ts), reaproveitado
--      aqui sem duplicar a checagem em SQL.
-- O restante (colunas, triggers de integridade cross-tenant, índices)
-- reaproveita a proposta já auditada, sem redesenho.

begin;

-- ── 1. Catálogo — evolução mínima de clinica_servicos (real, já em produção) ──

alter table public.clinica_servicos
  add column if not exists preco_centavos integer
    check (preco_centavos is null or preco_centavos > 0),
  add column if not exists disponivel boolean not null default true;

comment on column public.clinica_servicos.preco_centavos is
  'Preço público do item, em centavos (nunca numeric/float). NULL = item ainda sem preço definido — continua exibido, só não pode originar pedido.';
comment on column public.clinica_servicos.disponivel is
  'Item pode ser pedido agora. false = continua visível no site (histórico/vitrine), mas nunca origina pedido novo.';

alter table public.clinica_servicos
  add constraint clinica_servicos_id_clinica_id_uidx unique (id, clinica_id);

-- ── 2. Pedidos — domínio irmão de orcamentos, nunca a mesma tabela ────────
-- Nasce de um item de catálogo já precificado, sem negociação nem
-- validade (orçamento negocia e pode expirar; pedido só confirma/cancela).

create table if not exists public.pedidos (
  id                      uuid primary key default gen_random_uuid(),
  clinica_id              uuid not null references public.clinicas(id),
  paciente_id             uuid references public.pacientes(id),
  nome_cliente            text not null,
  telefone                text,
  valor_centavos          integer not null check (valor_centavos > 0),
  status                  text not null default 'criado'
    check (status in ('criado', 'confirmado', 'aguardando_confirmacao_pagamento', 'pago', 'cancelado')),
  origem                  text not null default 'manual'
    check (origem in ('manual', 'site_publico')),
  -- 'chatbot_ia' nunca é um valor válido — mesma regra de orcamentos.origem:
  -- pedido só nasce de ação estruturada e deliberada, nunca inferido de
  -- texto livre de conversa.
  observacao              text,
  pagamento_informado_em  timestamptz,
  pagamento_confirmado_em timestamptz,
  criado_por              uuid,
  criado_em               timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists pedidos_clinica_status_idx on public.pedidos (clinica_id, status);
create index if not exists pedidos_clinica_paciente_idx on public.pedidos (clinica_id, paciente_id);

alter table public.pedidos enable row level security;
-- Mesmo padrão já homologado em orcamentos/tratamentos/cobrancas: RLS
-- habilitada sem nenhuma policy — acesso só via service role.

comment on table public.pedidos is
  'E-commerce IA V1. Pedido nasce de item(ns) de catálogo já precificado(s) — nunca negocia, nunca expira (diferente de orcamentos).';
comment on column public.pedidos.status is
  'Máquina de estados (lib/motor-pedidos.ts): criado -> confirmado -> aguardando_confirmacao_pagamento -> pago (terminal); confirmado/aguardando -> cancelado (terminal); aguardando -> confirmado (confirmação de pagamento rejeitada). "Cliente informou pagamento" NUNCA vira "confirmado" sozinho.';
comment on column public.pedidos.valor_centavos is
  'Soma de pedido_itens.valor_total_centavos no momento da criação — snapshot, nunca recalculado depois.';

create trigger pedidos_atualiza_timestamp_trg
  before update on public.pedidos
  for each row execute function public.set_updated_at();
-- Reaproveita public.set_updated_at() (já real, já usada por outras
-- tabelas do schema) — nunca uma segunda função idêntica.

-- ── 3. Itens do pedido — obrigatório ter ao menos 1 por pedido ────────────

create table if not exists public.pedido_itens (
  id                       uuid primary key default gen_random_uuid(),
  pedido_id                uuid not null references public.pedidos(id) on delete cascade,
  clinica_id               uuid not null references public.clinicas(id),
  -- Denormalizado (mesmo padrão de toda tabela do schema real — nunca só
  -- via join) para permitir filtro/RLS direto por tenant nesta tabela.
  servico_id               uuid references public.clinica_servicos(id),
  descricao                text not null,
  -- Snapshot do nome/descrição do item no momento do pedido — nunca se
  -- perde se o item de catálogo for editado/apagado depois (mesmo
  -- princípio de orcamentos.procedimento).
  quantidade               integer not null check (quantidade > 0),
  valor_unitario_centavos  integer not null check (valor_unitario_centavos > 0),
  valor_total_centavos     integer not null check (valor_total_centavos > 0),
  criado_em                timestamptz not null default now()
);

create index if not exists pedido_itens_pedido_idx on public.pedido_itens (pedido_id);
create index if not exists pedido_itens_clinica_idx on public.pedido_itens (clinica_id);
create index if not exists pedido_itens_servico_idx on public.pedido_itens (servico_id);

alter table public.pedido_itens enable row level security;
-- Mesmo padrão — RLS habilitada sem nenhuma policy, acesso só via service role.

comment on table public.pedido_itens is
  'Itens de um pedido — quantidade, valor unitário (sempre do catálogo real, nunca do cliente) e total, snapshot na criação.';

-- Integridade cross-tenant: uma FK simples em servico_id só garante que o
-- item existe em algum lugar, nunca que pertence à MESMA clinica_id do
-- pedido/item. Mesmo padrão de trigger já auditado (classificação B) na
-- proposta original desta migration, agora cobrindo também pedido_id.
create or replace function public.pedido_itens_valida_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.servico_id is not null and not exists (
    select 1 from public.clinica_servicos
    where id = new.servico_id and clinica_id = new.clinica_id
  ) then
    raise exception 'servico_id % nao pertence a clinica_id %', new.servico_id, new.clinica_id;
  end if;
  if not exists (
    select 1 from public.pedidos
    where id = new.pedido_id and clinica_id = new.clinica_id
  ) then
    raise exception 'pedido_id % nao pertence a clinica_id %', new.pedido_id, new.clinica_id;
  end if;
  return new;
end;
$$;

create trigger pedido_itens_valida_tenant_trg
  before insert or update of servico_id, pedido_id, clinica_id on public.pedido_itens
  for each row execute function public.pedido_itens_valida_tenant();

commit;

-- ── Rollback ────────────────────────────────────────────────────────────
-- begin;
-- drop trigger if exists pedido_itens_valida_tenant_trg on public.pedido_itens;
-- drop function if exists public.pedido_itens_valida_tenant();
-- drop table if exists public.pedido_itens;
-- drop trigger if exists pedidos_atualiza_timestamp_trg on public.pedidos;
-- drop table if exists public.pedidos;
-- alter table public.clinica_servicos drop constraint if exists clinica_servicos_id_clinica_id_uidx;
-- alter table public.clinica_servicos drop column if exists disponivel;
-- alter table public.clinica_servicos drop column if exists preco_centavos;
-- commit;
