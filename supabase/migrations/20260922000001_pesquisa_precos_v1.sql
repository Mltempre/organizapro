-- Pesquisa de Preços V1 — migration PREPARADA, NÃO EXECUTADA.
-- Registra fatos observados e rastreáveis. Não coleta preços, não altera
-- catálogo/pedidos/orçamentos e não afirma possuir o menor preço da internet.

begin;

create table if not exists public.pesquisa_preco_itens (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null references public.clinicas(id) on delete restrict,
  servico_id         uuid references public.clinica_servicos(id) on delete set null,
  nome               text not null check (char_length(btrim(nome)) between 1 and 160),
  especificacao      text check (especificacao is null or char_length(especificacao) <= 1000),
  unidade_canonica   text not null check (unidade_canonica in ('un','g','kg','ml','l','cm','m','caixa','pacote')),
  ativo              boolean not null default true,
  criado_por         uuid not null references auth.users(id),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  unique (id, clinica_id)
);

comment on table public.pesquisa_preco_itens is
  'Itens privados pesquisados por uma empresa. Não é o catálogo de venda; servico_id é apenas um vínculo opcional e comprovável.';

create table if not exists public.pesquisa_preco_fontes (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null references public.clinicas(id) on delete restrict,
  nome               text not null check (char_length(btrim(nome)) between 1 and 160),
  tipo               text not null check (tipo in ('manual','documento','cotacao','url_verificada','importacao','api_autorizada')),
  referencia         text check (referencia is null or char_length(referencia) <= 2000),
  criado_por         uuid not null references auth.users(id),
  criado_em          timestamptz not null default now(),
  unique (id, clinica_id)
);

comment on column public.pesquisa_preco_fontes.tipo is
  'url_verificada significa que o usuário informou uma URL que verificou; o sistema não executa verificação automática nem scraping.';

create table if not exists public.pesquisa_preco_observacoes (
  id                            uuid primary key default gen_random_uuid(),
  clinica_id                    uuid not null references public.clinicas(id) on delete restrict,
  item_id                       uuid not null references public.pesquisa_preco_itens(id) on delete restrict,
  fonte_id                      uuid not null references public.pesquisa_preco_fontes(id) on delete restrict,
  preco_centavos                integer not null check (preco_centavos > 0),
  moeda                         text not null default 'BRL' check (moeda ~ '^[A-Z]{3}$'),
  quantidade                    numeric(18,6) not null check (quantidade > 0),
  unidade_observada             text not null check (unidade_observada in ('un','g','kg','ml','l','cm','m','caixa','pacote')),
  observado_em                  timestamptz not null,
  evidencia_referencia          text check (evidencia_referencia is null or char_length(evidencia_referencia) <= 2000),
  comparavel                    boolean not null,
  preco_normalizado_centavos    numeric(18,6),
  motivo_nao_comparavel         text check (motivo_nao_comparavel is null or motivo_nao_comparavel in (
                                  'preco_invalido','quantidade_invalida','unidade_nao_suportada','unidade_incompativel','moeda_incompativel'
                                )),
  corrige_observacao_id         uuid references public.pesquisa_preco_observacoes(id) on delete restrict,
  chave_idempotencia            text not null check (char_length(btrim(chave_idempotencia)) between 1 and 200),
  criado_por                    uuid not null references auth.users(id),
  criado_em                     timestamptz not null default now(),
  unique (id, clinica_id),
  unique (clinica_id, chave_idempotencia),
  check (
    (comparavel and preco_normalizado_centavos is not null and preco_normalizado_centavos > 0 and motivo_nao_comparavel is null)
    or
    (not comparavel and preco_normalizado_centavos is null and motivo_nao_comparavel is not null)
  ),
  check (corrige_observacao_id is null or corrige_observacao_id <> id)
);

comment on table public.pesquisa_preco_observacoes is
  'Histórico imutável de preços observados. Correções são novas linhas ligadas por corrige_observacao_id; UPDATE/DELETE são bloqueados.';

create index if not exists pesquisa_preco_itens_clinica_idx
  on public.pesquisa_preco_itens (clinica_id, ativo, nome);
create index if not exists pesquisa_preco_fontes_clinica_idx
  on public.pesquisa_preco_fontes (clinica_id, nome);
create index if not exists pesquisa_preco_observacoes_historico_idx
  on public.pesquisa_preco_observacoes (clinica_id, item_id, observado_em desc);

-- Integridade cross-tenant dos vínculos opcionais e das observações.
create or replace function public.pesquisa_preco_validar_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'pesquisa_preco_itens' then
    if new.servico_id is not null and not exists (
      select 1 from public.clinica_servicos s
      where s.id = new.servico_id and s.clinica_id = new.clinica_id
    ) then
      raise exception 'servico_id não pertence à clinica_id informada';
    end if;
    return new;
  end if;

  if not exists (
    select 1 from public.pesquisa_preco_itens i
    where i.id = new.item_id and i.clinica_id = new.clinica_id
  ) then
    raise exception 'item_id não pertence à clinica_id informada';
  end if;
  if not exists (
    select 1 from public.pesquisa_preco_fontes f
    where f.id = new.fonte_id and f.clinica_id = new.clinica_id
  ) then
    raise exception 'fonte_id não pertence à clinica_id informada';
  end if;
  if new.corrige_observacao_id is not null and not exists (
    select 1 from public.pesquisa_preco_observacoes o
    where o.id = new.corrige_observacao_id
      and o.clinica_id = new.clinica_id
      and o.item_id = new.item_id
  ) then
    raise exception 'observação corrigida não pertence ao mesmo item e tenant';
  end if;
  return new;
end;
$$;

drop trigger if exists pesquisa_preco_item_tenant_trg on public.pesquisa_preco_itens;
create trigger pesquisa_preco_item_tenant_trg
  before insert or update of servico_id, clinica_id on public.pesquisa_preco_itens
  for each row execute function public.pesquisa_preco_validar_tenant();

drop trigger if exists pesquisa_preco_observacao_tenant_trg on public.pesquisa_preco_observacoes;
create trigger pesquisa_preco_observacao_tenant_trg
  before insert on public.pesquisa_preco_observacoes
  for each row execute function public.pesquisa_preco_validar_tenant();

-- Imutabilidade no banco, inclusive quando a escrita passa pelo backend.
create or replace function public.pesquisa_preco_bloquear_mutacao_observacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'observações de preço são imutáveis; registre uma correção';
end;
$$;

drop trigger if exists pesquisa_preco_observacao_imutavel_trg on public.pesquisa_preco_observacoes;
create trigger pesquisa_preco_observacao_imutavel_trg
  before update or delete on public.pesquisa_preco_observacoes
  for each row execute function public.pesquisa_preco_bloquear_mutacao_observacao();

alter table public.pesquisa_preco_itens enable row level security;
alter table public.pesquisa_preco_fontes enable row level security;
alter table public.pesquisa_preco_observacoes enable row level security;

-- Somente leitura direta autenticada. Escritas acontecem pelas APIs
-- server-side depois de resolver o tenant pela sessão e reutilizar
-- autorizarUsuarioNaClinica. Anon não recebe grant nem policy.
create policy "pesquisa_preco_itens_select_own" on public.pesquisa_preco_itens
  for select to authenticated using (
    exists (
      select 1 from public.clinica_usuarios cu
      join public.clinicas c on c.id = cu.clinica_id
      where cu.usuario_id = auth.uid() and cu.ativo = true
        and cu.clinica_id = pesquisa_preco_itens.clinica_id
        and c.produto = 'organizapro'
    )
  );

create policy "pesquisa_preco_fontes_select_own" on public.pesquisa_preco_fontes
  for select to authenticated using (
    exists (
      select 1 from public.clinica_usuarios cu
      join public.clinicas c on c.id = cu.clinica_id
      where cu.usuario_id = auth.uid() and cu.ativo = true
        and cu.clinica_id = pesquisa_preco_fontes.clinica_id
        and c.produto = 'organizapro'
    )
  );

create policy "pesquisa_preco_observacoes_select_own" on public.pesquisa_preco_observacoes
  for select to authenticated using (
    exists (
      select 1 from public.clinica_usuarios cu
      join public.clinicas c on c.id = cu.clinica_id
      where cu.usuario_id = auth.uid() and cu.ativo = true
        and cu.clinica_id = pesquisa_preco_observacoes.clinica_id
        and c.produto = 'organizapro'
    )
  );

revoke all on public.pesquisa_preco_itens from anon, authenticated;
revoke all on public.pesquisa_preco_fontes from anon, authenticated;
revoke all on public.pesquisa_preco_observacoes from anon, authenticated;
grant select on public.pesquisa_preco_itens to authenticated;
grant select on public.pesquisa_preco_fontes to authenticated;
grant select on public.pesquisa_preco_observacoes to authenticated;

commit;

-- Rollback deliberado (NÃO EXECUTAR automaticamente):
-- begin;
-- drop table if exists public.pesquisa_preco_observacoes;
-- drop table if exists public.pesquisa_preco_fontes;
-- drop table if exists public.pesquisa_preco_itens;
-- drop function if exists public.pesquisa_preco_bloquear_mutacao_observacao();
-- drop function if exists public.pesquisa_preco_validar_tenant();
-- commit;
