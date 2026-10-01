-- PREPARADA PARA REVISAO. NAO APLICADA AO SUPABASE. Executar somente com GO.
--
-- Convergência Comercial Definitiva — Pedidos = Venda/Execução única.
--
-- No OrganizaPro, public.pedidos passa a ser a estrutura única de
-- Venda/Execução. Esta migration é SOMENTE ADITIVA:
--   1. public.pedidos ganha a dimensão de EXECUÇÃO (separada da dimensão
--      comercial/pagamento que já existe em pedidos.status), o vínculo com
--      o orçamento de origem e a referência ao serviço contratado legado
--      (public.tratamentos) de onde um pedido foi migrado.
--   2. public.cobrancas ganha o vínculo com o pedido de origem.
--
-- Nada é apagado, renomeado ou convertido aqui: public.tratamentos,
-- cobrancas.tratamento_origem_id e todo o histórico (eventos_dominio)
-- continuam exatamente como estão — tratamentos/cobrancas são
-- compartilhadas com o ClínicaFlow (mesmo banco). Toda coluna nova aceita
-- NULL, então nenhuma linha existente muda de significado:
--   execucao_status NULL = venda sem acompanhamento de execução
--   (ex.: produto, pedido do site) — exatamente como todo pedido é hoje.
--
-- Isolamento por negócio: vínculo novo só vale dentro do MESMO negócio
-- (gatilhos abaixo) — mesmo princípio de pedido_itens_valida_tenant.
-- Transacional: qualquer falha desfaz tudo.

begin;

-- ── 1. pedidos: execução + origem ───────────────────────────────────────
alter table public.pedidos
  add column if not exists orcamento_origem_id      uuid references public.orcamentos(id),
  add column if not exists tratamento_legado_id     uuid references public.tratamentos(id),
  add column if not exists execucao_status          text,
  add column if not exists proxima_data_prevista    date,
  add column if not exists motivo_interrupcao       text,
  add column if not exists execucao_concluida_em    timestamptz,
  add column if not exists execucao_interrompida_em timestamptz,
  add column if not exists execucao_abandonada_em   timestamptz;

alter table public.pedidos
  add constraint pedidos_execucao_status_chk
    check (execucao_status is null or execucao_status in
      ('em_andamento', 'retorno_agendado', 'concluido', 'interrompido', 'abandonado')),
  add constraint pedidos_motivo_interrupcao_chk
    check (motivo_interrupcao is null or motivo_interrupcao in
      ('desistiu', 'aguardando_decisao', 'financeiro', 'saude', 'outro'));

-- Uma venda por orçamento: impede duas vendas originadas do mesmo orçamento.
create unique index if not exists pedidos_orcamento_origem_uidx
  on public.pedidos (orcamento_origem_id) where orcamento_origem_id is not null;
-- Um pedido por serviço contratado legado: torna a migração de dados idempotente.
create unique index if not exists pedidos_tratamento_legado_uidx
  on public.pedidos (tratamento_legado_id) where tratamento_legado_id is not null;
create index if not exists pedidos_clinica_execucao_idx
  on public.pedidos (clinica_id, execucao_status) where execucao_status is not null;

comment on column public.pedidos.execucao_status is
  'Dimensão de EXECUÇÃO da venda (lib/venda-execucao.ts), independente de pedidos.status (comercial/pagamento). NULL = venda sem acompanhamento de execução. em_andamento -> retorno_agendado|concluido|interrompido; retorno_agendado -> concluido; interrompido -> abandonado. "Serviço concluído" nunca significa "pagamento recebido".';
comment on column public.pedidos.orcamento_origem_id is
  'Orçamento aprovado que originou esta venda. Único: no máximo uma venda por orçamento.';
comment on column public.pedidos.tratamento_legado_id is
  'Serviço contratado legado (public.tratamentos) de onde esta venda foi migrada. Histórico — public.tratamentos nunca é apagada.';

-- ── 2. cobrancas: venda de origem ───────────────────────────────────────
alter table public.cobrancas
  add column if not exists pedido_origem_id uuid references public.pedidos(id);
create index if not exists cobrancas_pedido_origem_idx
  on public.cobrancas (pedido_origem_id) where pedido_origem_id is not null;
comment on column public.cobrancas.pedido_origem_id is
  'Venda (pedido) que originou esta cobrança. Com vínculo, a receita da venda é contada pela COBRANÇA, nunca pelo pedido também.';

-- ── 3. Vínculos sempre dentro do mesmo negócio ──────────────────────────
create or replace function public.pedidos_valida_origem_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.orcamento_origem_id is not null and not exists (
    select 1 from public.orcamentos
    where id = new.orcamento_origem_id and clinica_id = new.clinica_id
  ) then
    raise exception 'orcamento_origem_id % nao pertence a clinica_id %', new.orcamento_origem_id, new.clinica_id;
  end if;
  if new.tratamento_legado_id is not null and not exists (
    select 1 from public.tratamentos
    where id = new.tratamento_legado_id and clinica_id = new.clinica_id
  ) then
    raise exception 'tratamento_legado_id % nao pertence a clinica_id %', new.tratamento_legado_id, new.clinica_id;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_valida_origem_tenant_trg on public.pedidos;
create trigger pedidos_valida_origem_tenant_trg
  before insert or update of orcamento_origem_id, tratamento_legado_id, clinica_id on public.pedidos
  for each row execute function public.pedidos_valida_origem_tenant();

create or replace function public.cobrancas_valida_pedido_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.pedido_origem_id is not null and not exists (
    select 1 from public.pedidos
    where id = new.pedido_origem_id and clinica_id = new.clinica_id
  ) then
    raise exception 'pedido_origem_id % nao pertence a clinica_id %', new.pedido_origem_id, new.clinica_id;
  end if;
  return new;
end;
$$;

-- Dispara SÓ quando pedido_origem_id está envolvido: escritas do ClínicaFlow
-- em cobrancas (que nunca preenchem a coluna) não mudam de comportamento.
drop trigger if exists cobrancas_valida_pedido_tenant_trg on public.cobrancas;
create trigger cobrancas_valida_pedido_tenant_trg
  before insert or update of pedido_origem_id, clinica_id on public.cobrancas
  for each row when (new.pedido_origem_id is not null)
  execute function public.cobrancas_valida_pedido_tenant();

-- Funções só do servidor: nenhuma execução por anon/authenticated.
revoke all on function public.pedidos_valida_origem_tenant() from public, anon, authenticated;
revoke all on function public.cobrancas_valida_pedido_tenant() from public, anon, authenticated;

commit;

-- ── Reversão (somente se necessário, com GO) ────────────────────────────
-- begin;
-- drop trigger if exists cobrancas_valida_pedido_tenant_trg on public.cobrancas;
-- drop trigger if exists pedidos_valida_origem_tenant_trg on public.pedidos;
-- drop function if exists public.cobrancas_valida_pedido_tenant();
-- drop function if exists public.pedidos_valida_origem_tenant();
-- alter table public.cobrancas drop column if exists pedido_origem_id;
-- alter table public.pedidos
--   drop constraint if exists pedidos_motivo_interrupcao_chk,
--   drop constraint if exists pedidos_execucao_status_chk,
--   drop column if exists execucao_abandonada_em, drop column if exists execucao_interrompida_em,
--   drop column if exists execucao_concluida_em, drop column if exists motivo_interrupcao,
--   drop column if exists proxima_data_prevista, drop column if exists execucao_status,
--   drop column if exists tratamento_legado_id, drop column if exists orcamento_origem_id;
-- commit;
