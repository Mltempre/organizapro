-- PREPARADA PARA REVISAO. NAO APLICADA AO SUPABASE. Executar somente com GO.
--
-- Estoque Comercial Básico V1 — operacional/comercial apenas (nenhuma
-- função fiscal, tributária ou contábil).
--
-- 1. Catálogo (public.clinica_servicos): campos novos, todos opcionais e
--    com padrão que deixa cada item existente exatamente como hoje
--    (tipo 'servico', estoque não controlado).
-- 1b. public.estoque_identificadores: SKU e código de barras do item —
--    dados internos, fora de clinica_servicos (lida pelo site público).
-- 2. public.estoque_saldos: saldo atual por item controlado.
-- 3. public.estoque_movimentos: histórico append-only (entrada, ajuste,
--    venda, estorno_venda), com motivo, autor e pedido de origem.
-- 4. Funções usadas SOMENTE pelo servidor (service role):
--    - estoque_registrar_movimento_v1: entrada / ajuste manual.
--    - pedido_transicionar_com_estoque_v1: confirma (baixa) ou cancela
--      (estorno) o pedido na MESMA transação da mudança de status.
--
-- Isolamento por negócio: RLS habilitada SEM policies nas tabelas novas
-- (mesmo padrão homologado de pedidos/pedido_itens — acesso só via service
-- role, com autorização por negócio feita na API) e FKs compostas
-- (servico_id, clinica_id) que impedem apontar item de outro negócio.
-- SKU e código de barras são únicos DENTRO do negócio, nunca globalmente,
-- e nunca expostos publicamente.
-- Transacional: qualquer falha desfaz tudo.
begin;

-- ── 1. Catálogo ─────────────────────────────────────────────────────────
alter table public.clinica_servicos
  add column if not exists tipo_item text not null default 'servico',
  add column if not exists controla_estoque boolean not null default false,
  add column if not exists estoque_minimo integer;

alter table public.clinica_servicos
  add constraint clinica_servicos_tipo_item_chk check (tipo_item in ('produto', 'servico')),
  add constraint clinica_servicos_estoque_minimo_chk check (estoque_minimo is null or estoque_minimo >= 0),
  add constraint clinica_servicos_controla_so_produto_chk check (not controla_estoque or tipo_item = 'produto');

comment on column public.clinica_servicos.tipo_item is 'Estoque V1: produto físico ou serviço. Padrão servico (itens existentes inalterados).';
comment on column public.clinica_servicos.controla_estoque is 'Estoque V1: só produto. true = pedidos confirmados baixam saldo em estoque_saldos.';

-- ── 1b. SKU e código de barras — dados internos, NUNCA públicos ─────────
-- clinica_servicos é lida pelo site público; por isso SKU/EAN ficam numa
-- tabela à parte, fechada como as demais tabelas de estoque (RLS sem
-- policy, acesso só via servidor). Únicos DENTRO do negócio, nunca globais.
create table if not exists public.estoque_identificadores (
  servico_id    uuid primary key,
  clinica_id    uuid not null references public.clinicas(id),
  sku           text check (sku is null or (sku = btrim(sku) and length(sku) between 1 and 60)),
  codigo_barras text check (codigo_barras is null or codigo_barras ~ '^[0-9A-Za-z-]{1,64}$'),
  atualizado_em timestamptz not null default now(),
  foreign key (servico_id, clinica_id) references public.clinica_servicos(id, clinica_id) on delete cascade
);
create unique index if not exists estoque_identificadores_sku_por_negocio_uidx
  on public.estoque_identificadores (clinica_id, lower(sku)) where sku is not null;
create unique index if not exists estoque_identificadores_codigo_barras_por_negocio_uidx
  on public.estoque_identificadores (clinica_id, codigo_barras) where codigo_barras is not null;
alter table public.estoque_identificadores enable row level security;
revoke all on table public.estoque_identificadores from public, anon, authenticated;

-- ── 2. Saldo atual ──────────────────────────────────────────────────────
create table if not exists public.estoque_saldos (
  servico_id    uuid primary key,
  clinica_id    uuid not null references public.clinicas(id),
  saldo         integer not null default 0 check (saldo >= 0),
  atualizado_em timestamptz not null default now(),
  foreign key (servico_id, clinica_id) references public.clinica_servicos(id, clinica_id) on delete cascade
);
alter table public.estoque_saldos enable row level security;
revoke all on table public.estoque_saldos from public, anon, authenticated;

-- ── 3. Movimentações (append-only) ─────────────────────────────────────
create table if not exists public.estoque_movimentos (
  id                  uuid primary key default gen_random_uuid(),
  clinica_id          uuid not null references public.clinicas(id),
  servico_id          uuid not null,
  tipo                text not null check (tipo in ('entrada', 'ajuste', 'venda', 'estorno_venda')),
  quantidade          integer not null check (quantidade <> 0), -- variação assinada do saldo
  saldo_apos          integer not null check (saldo_apos >= 0),
  motivo              text check (motivo is null or length(motivo) <= 300),
  pedido_id           uuid references public.pedidos(id),
  autor_id            uuid,
  chave_idempotencia  text check (chave_idempotencia is null or length(chave_idempotencia) <= 120),
  criado_em           timestamptz not null default now(),
  foreign key (servico_id, clinica_id) references public.clinica_servicos(id, clinica_id),
  check ((tipo in ('venda', 'estorno_venda')) = (pedido_id is not null))
);
-- Uma venda e um estorno, no máximo, por item de cada pedido: a própria
-- estrutura impede baixa ou estorno em dobro.
create unique index if not exists estoque_movimentos_pedido_uidx
  on public.estoque_movimentos (pedido_id, servico_id, tipo) where pedido_id is not null;
create unique index if not exists estoque_movimentos_chave_uidx
  on public.estoque_movimentos (clinica_id, chave_idempotencia) where chave_idempotencia is not null;
create index if not exists estoque_movimentos_item_idx
  on public.estoque_movimentos (clinica_id, servico_id, criado_em desc);

alter table public.estoque_movimentos enable row level security;
revoke all on table public.estoque_movimentos from public, anon, authenticated;

create or replace function public.estoque_movimentos_somente_insercao()
returns trigger language plpgsql as $$
begin
  raise exception 'estoque_movimentos é append-only';
end;
$$;
create trigger estoque_movimentos_somente_insercao_trg
  before update or delete on public.estoque_movimentos
  for each row execute function public.estoque_movimentos_somente_insercao();

-- ── 4a. Entrada / ajuste manual ─────────────────────────────────────────
-- entrada: p_quantidade > 0 soma ao saldo.
-- ajuste:  p_quantidade >= 0 é o saldo CONTADO; grava a diferença.
create or replace function public.estoque_registrar_movimento_v1(
  p_clinica_id uuid, p_servico_id uuid, p_tipo text, p_quantidade integer,
  p_motivo text, p_autor_id uuid, p_chave text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_item   record;
  v_saldo  integer;
  v_delta  integer;
  v_mov_id uuid;
begin
  if p_tipo not in ('entrada', 'ajuste') then return jsonb_build_object('ok', false, 'erro', 'tipo_invalido'); end if;
  if p_chave is null or length(btrim(p_chave)) = 0 then return jsonb_build_object('ok', false, 'erro', 'chave_obrigatoria'); end if;
  if p_quantidade is null or (p_tipo = 'entrada' and p_quantidade <= 0) or (p_tipo = 'ajuste' and p_quantidade < 0) then
    return jsonb_build_object('ok', false, 'erro', 'quantidade_invalida');
  end if;
  if p_tipo = 'ajuste' and (p_motivo is null or length(btrim(p_motivo)) = 0) then
    return jsonb_build_object('ok', false, 'erro', 'motivo_obrigatorio');
  end if;

  select tipo_item, controla_estoque into v_item
    from clinica_servicos where id = p_servico_id and clinica_id = p_clinica_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'item_nao_encontrado'); end if;
  if not v_item.controla_estoque then return jsonb_build_object('ok', false, 'erro', 'estoque_nao_controlado'); end if;

  if exists (select 1 from estoque_movimentos where clinica_id = p_clinica_id and chave_idempotencia = p_chave) then
    select saldo into v_saldo from estoque_saldos where servico_id = p_servico_id;
    return jsonb_build_object('ok', true, 'replay', true, 'saldo', coalesce(v_saldo, 0));
  end if;

  insert into estoque_saldos (servico_id, clinica_id) values (p_servico_id, p_clinica_id) on conflict (servico_id) do nothing;
  select saldo into v_saldo from estoque_saldos where servico_id = p_servico_id for update;

  v_delta := case when p_tipo = 'entrada' then p_quantidade else p_quantidade - v_saldo end;
  if v_delta = 0 then return jsonb_build_object('ok', false, 'erro', 'sem_diferenca', 'saldo', v_saldo); end if;

  update estoque_saldos set saldo = v_saldo + v_delta, atualizado_em = now() where servico_id = p_servico_id;
  insert into estoque_movimentos (clinica_id, servico_id, tipo, quantidade, saldo_apos, motivo, autor_id, chave_idempotencia)
    values (p_clinica_id, p_servico_id, p_tipo, v_delta, v_saldo + v_delta, nullif(btrim(p_motivo), ''), p_autor_id, p_chave)
    returning id into v_mov_id;
  return jsonb_build_object('ok', true, 'saldo', v_saldo + v_delta, 'movimento_id', v_mov_id);
end;
$$;

-- ── 4b. Transição de pedido com estoque (atômica) ─────────────────────
-- A validade da transição é decidida antes, pela máquina de estados
-- (lib/motor-pedidos.ts). Aqui: status muda só se ainda for o esperado
-- (guarda otimista) e, na mesma transação,
--   confirmado → baixa itens com estoque controlado (bloqueia se faltar);
--   cancelado  → estorna exatamente o que foi baixado para este pedido.
create or replace function public.pedido_transicionar_com_estoque_v1(
  p_clinica_id uuid, p_pedido_id uuid, p_status_esperado text, p_status_novo text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_pedido       pedidos%rowtype;
  v_linha        record;
  v_saldo        integer;
  v_insuficiente jsonb := '[]'::jsonb;
begin
  if p_status_novo not in ('confirmado', 'cancelado') then
    return jsonb_build_object('ok', false, 'erro', 'status_invalido');
  end if;

  select * into v_pedido from pedidos
    where id = p_pedido_id and clinica_id = p_clinica_id and status = p_status_esperado for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'conflito'); end if;

  if p_status_novo = 'confirmado'
     and not exists (select 1 from estoque_movimentos where pedido_id = p_pedido_id and tipo = 'venda') then
    -- Itens controlados do pedido, agregados por item e travados em ordem
    -- fixa (evita deadlock entre pedidos concorrentes).
    for v_linha in
      select pi.servico_id, cs.nome, sum(pi.quantidade)::integer as necessario
        from pedido_itens pi
        join clinica_servicos cs on cs.id = pi.servico_id and cs.clinica_id = p_clinica_id
       where pi.pedido_id = p_pedido_id and pi.clinica_id = p_clinica_id and cs.controla_estoque
       group by pi.servico_id, cs.nome
       order by pi.servico_id
    loop
      insert into estoque_saldos (servico_id, clinica_id) values (v_linha.servico_id, p_clinica_id) on conflict (servico_id) do nothing;
      select saldo into v_saldo from estoque_saldos where servico_id = v_linha.servico_id for update;
      if v_saldo < v_linha.necessario then
        v_insuficiente := v_insuficiente || jsonb_build_object('servico_id', v_linha.servico_id, 'nome', v_linha.nome, 'saldo', v_saldo, 'necessario', v_linha.necessario);
      end if;
    end loop;
    if jsonb_array_length(v_insuficiente) > 0 then
      return jsonb_build_object('ok', false, 'erro', 'estoque_insuficiente', 'itens', v_insuficiente);
    end if;

    for v_linha in
      select pi.servico_id, sum(pi.quantidade)::integer as necessario
        from pedido_itens pi
        join clinica_servicos cs on cs.id = pi.servico_id and cs.clinica_id = p_clinica_id
       where pi.pedido_id = p_pedido_id and pi.clinica_id = p_clinica_id and cs.controla_estoque
       group by pi.servico_id
       order by pi.servico_id
    loop
      update estoque_saldos set saldo = saldo - v_linha.necessario, atualizado_em = now()
        where servico_id = v_linha.servico_id returning saldo into v_saldo;
      insert into estoque_movimentos (clinica_id, servico_id, tipo, quantidade, saldo_apos, motivo, pedido_id)
        values (p_clinica_id, v_linha.servico_id, 'venda', -v_linha.necessario, v_saldo, 'Pedido confirmado', p_pedido_id);
    end loop;
  end if;

  if p_status_novo = 'cancelado'
     and not exists (select 1 from estoque_movimentos where pedido_id = p_pedido_id and tipo = 'estorno_venda') then
    for v_linha in
      select servico_id, -quantidade as devolver from estoque_movimentos
       where pedido_id = p_pedido_id and clinica_id = p_clinica_id and tipo = 'venda'
       order by servico_id
    loop
      update estoque_saldos set saldo = saldo + v_linha.devolver, atualizado_em = now()
        where servico_id = v_linha.servico_id returning saldo into v_saldo;
      insert into estoque_movimentos (clinica_id, servico_id, tipo, quantidade, saldo_apos, motivo, pedido_id)
        values (p_clinica_id, v_linha.servico_id, 'estorno_venda', v_linha.devolver, v_saldo, 'Pedido cancelado', p_pedido_id);
    end loop;
  end if;

  update pedidos set status = p_status_novo where id = p_pedido_id and clinica_id = p_clinica_id
    returning * into v_pedido;
  return jsonb_build_object('ok', true, 'pedido', to_jsonb(v_pedido));
end;
$$;

-- Funções só para o servidor: nunca chamáveis direto do navegador.
revoke all on function public.estoque_registrar_movimento_v1(uuid, uuid, text, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.pedido_transicionar_com_estoque_v1(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.estoque_registrar_movimento_v1(uuid, uuid, text, integer, text, uuid, text) to service_role;
grant execute on function public.pedido_transicionar_com_estoque_v1(uuid, uuid, text, text) to service_role;
grant select, insert, update on table public.estoque_saldos to service_role;
grant select, insert, update on table public.estoque_identificadores to service_role;
grant select, insert on table public.estoque_movimentos to service_role;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────
-- begin;
-- drop function if exists public.pedido_transicionar_com_estoque_v1(uuid, uuid, text, text);
-- drop function if exists public.estoque_registrar_movimento_v1(uuid, uuid, text, integer, text, uuid, text);
-- drop trigger if exists estoque_movimentos_somente_insercao_trg on public.estoque_movimentos;
-- drop function if exists public.estoque_movimentos_somente_insercao();
-- drop table if exists public.estoque_movimentos;
-- drop table if exists public.estoque_saldos;
-- drop table if exists public.estoque_identificadores;
-- alter table public.clinica_servicos
--   drop constraint if exists clinica_servicos_controla_so_produto_chk,
--   drop constraint if exists clinica_servicos_estoque_minimo_chk,
--   drop constraint if exists clinica_servicos_tipo_item_chk,
--   drop column if exists estoque_minimo,
--   drop column if exists controla_estoque,
--   drop column if exists tipo_item;
-- commit;
