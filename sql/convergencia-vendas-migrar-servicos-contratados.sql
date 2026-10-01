-- PREPARADO PARA REVISAO. NAO EXECUTADO. Executar somente com GO,
-- DEPOIS de supabase/migrations/20261002000001_vendas_execucao_v1.sql.
--
-- Convergência Comercial Definitiva — preserva os Serviços Contratados
-- existentes como Vendas/Execução em public.pedidos.
--
-- O que faz (uma transação; qualquer inconsistência aborta TUDO):
--   1. Para cada linha de public.tratamentos ainda não migrada, cria UM
--      pedido com o mesmo negócio, cliente cadastrado, nome, telefone,
--      valor, status de execução, retorno, motivo, datas e orçamento de
--      origem; status comercial 'confirmado' (venda contratada, sem
--      pagamento registrado — tratamentos nunca tiveram pagamento).
--   2. Cria o item avulso correspondente (descrição = serviço, 1 × valor).
--      Sem item do catálogo: nenhum efeito de estoque.
--   3. Converte o vínculo cobrança → serviço também para cobrança → venda
--      (cobrancas.pedido_origem_id). tratamento_origem_id é MANTIDO.
--   4. Registra um evento canônico 'pedido.migrado_de_servico_contratado'
--      por venda migrada (histórico novo; o antigo não é reescrito).
--
-- O que NÃO faz: não apaga nem altera public.tratamentos, não altera nem
-- apaga eventos antigos de tipo "tratamento", não toca no pedido cancelado
-- existente nem nos seus movimentos de estoque.
--
-- Idempotente: rodar de novo não duplica nada (pedidos.tratamento_legado_id
-- é único; itens/vínculos/eventos só são criados quando ausentes).
--
-- Contagens esperadas (produção em 2026-10-01, só leitura):
--   antes:  pedidos 1 · pedido_itens 1 · tratamentos 3 · cobranças 3
--           (1 com tratamento_origem_id, 0 com pedido_origem_id) ·
--           estoque_movimentos 3 · eventos "tratamento" 77
--   depois: pedidos 4 · pedido_itens 4 · tratamentos 3 (inalterados) ·
--           cobranças 3 (1 com pedido_origem_id) · estoque_movimentos 3
--           (inalterados) · eventos "tratamento" 77 (inalterados) ·
--           +3 eventos 'pedido.migrado_de_servico_contratado'

begin;

-- ── 0. Pré-condições ────────────────────────────────────────────────────
do $$
declare
  v_tratamentos int;
  v_cobrancas_vinculadas int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'tratamento_legado_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cobrancas' and column_name = 'pedido_origem_id'
  ) then
    raise exception 'Execute antes a migration 20261002000001_vendas_execucao_v1.sql';
  end if;

  select count(*) into v_tratamentos from public.tratamentos;
  if v_tratamentos <> 3 then
    raise exception 'Esperados 3 serviços contratados, encontrados % — revisar antes de migrar', v_tratamentos;
  end if;

  if exists (select 1 from public.tratamentos where valor_estimado is null or valor_estimado <= 0) then
    raise exception 'Serviço contratado sem valor positivo — venda exige valor; revisar antes de migrar';
  end if;
  if exists (select 1 from public.tratamentos where valor_estimado * 100 <> round(valor_estimado * 100)) then
    raise exception 'Valor com mais de 2 casas decimais — não converte exatamente para centavos';
  end if;
  if exists (
    select 1 from public.tratamentos
    where status not in ('criado', 'em_andamento', 'retorno_agendado', 'concluido', 'interrompido', 'abandonado')
  ) then
    raise exception 'Status de serviço desconhecido — revisar antes de migrar';
  end if;

  -- Orçamento de origem já usado por OUTRA venda: violaria "uma venda por orçamento".
  if exists (
    select 1 from public.tratamentos t
    join public.pedidos p on p.orcamento_origem_id = t.orcamento_origem_id
    where t.orcamento_origem_id is not null and p.tratamento_legado_id is distinct from t.id
  ) then
    raise exception 'Orçamento de origem de um serviço já possui outra venda — revisar antes de migrar';
  end if;

  select count(*) into v_cobrancas_vinculadas from public.cobrancas where tratamento_origem_id is not null;
  if v_cobrancas_vinculadas <> 1 then
    raise exception 'Esperada 1 cobrança vinculada a serviço, encontradas %', v_cobrancas_vinculadas;
  end if;
  -- Cobrança já ligada a uma venda DIFERENTE da que vem do seu serviço.
  if exists (
    select 1 from public.cobrancas c
    join public.pedidos p on p.id = c.pedido_origem_id
    where c.tratamento_origem_id is not null and p.tratamento_legado_id is distinct from c.tratamento_origem_id
  ) then
    raise exception 'Cobrança já vinculada a outra venda — revisar antes de migrar';
  end if;
end $$;

-- Fotografia de controle (descartada no fim da transação).
create temp table _antes on commit drop as
select
  (select count(*) from public.pedidos)                                         as pedidos,
  (select count(*) from public.pedidos where tratamento_legado_id is not null)  as ja_migrados,
  (select count(*) from public.pedido_itens)                                    as itens,
  (select count(*) from public.tratamentos)                                     as tratamentos,
  (select count(*) from public.cobrancas)                                       as cobrancas,
  (select count(*) from public.estoque_movimentos)                              as movimentos,
  (select count(*) from public.eventos_dominio where entidade_tipo = 'tratamento') as eventos_tratamento,
  (select md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from public.tratamentos t) as hash_tratamentos,
  (select md5(coalesce(string_agg(row_to_json(p)::text, '|' order by p.id), '')) from public.pedidos p where p.tratamento_legado_id is null) as hash_pedidos_existentes,
  (select md5(coalesce(string_agg(row_to_json(i)::text, '|' order by i.id), '')) from public.pedido_itens i join public.pedidos p on p.id = i.pedido_id where p.tratamento_legado_id is null) as hash_itens_existentes,
  (select md5(coalesce(string_agg(row_to_json(m)::text, '|' order by m.id), '')) from public.estoque_movimentos m) as hash_movimentos,
  (select md5(coalesce(string_agg(row_to_json(e)::text, '|' order by e.id), '')) from public.eventos_dominio e where e.entidade_tipo = 'tratamento') as hash_eventos_tratamento;

-- ── 1. Venda/Execução para cada serviço contratado ──────────────────────
insert into public.pedidos (
  clinica_id, paciente_id, nome_cliente, telefone, valor_centavos, status, origem,
  observacao, criado_por, criado_em, updated_at,
  orcamento_origem_id, tratamento_legado_id,
  execucao_status, proxima_data_prevista, motivo_interrupcao,
  execucao_concluida_em, execucao_interrompida_em, execucao_abandonada_em
)
select
  t.clinica_id, t.paciente_id, t.paciente_nome, t.paciente_telefone,
  round(t.valor_estimado * 100)::integer, 'confirmado', 'manual',
  t.observacao, t.created_by, t.iniciado_em, t.updated_at,
  t.orcamento_origem_id, t.id,
  case t.status when 'criado' then 'em_andamento' else t.status end,
  t.proxima_data_prevista, t.motivo_interrupcao,
  t.concluido_em, t.interrompido_em, t.abandonado_em
from public.tratamentos t
where not exists (select 1 from public.pedidos p where p.tratamento_legado_id = t.id);

-- ── 2. Item avulso correspondente ───────────────────────────────────────
insert into public.pedido_itens (
  pedido_id, clinica_id, servico_id, descricao, quantidade,
  valor_unitario_centavos, valor_total_centavos, criado_em
)
select p.id, p.clinica_id, null, t.tipo_tratamento, 1, p.valor_centavos, p.valor_centavos, p.criado_em
from public.pedidos p
join public.tratamentos t on t.id = p.tratamento_legado_id
where not exists (select 1 from public.pedido_itens i where i.pedido_id = p.id);

-- ── 3. Cobrança → venda (mantém tratamento_origem_id) ───────────────────
update public.cobrancas c
set pedido_origem_id = p.id
from public.pedidos p
where p.tratamento_legado_id = c.tratamento_origem_id
  and c.pedido_origem_id is null;

-- ── 4. Evento canônico da migração (histórico novo, nunca reescrito) ───
insert into public.eventos_dominio (clinica_id, tipo, entidade_tipo, entidade_id, chave_idempotencia, payload, criado_em)
select
  p.clinica_id, 'pedido.migrado_de_servico_contratado', 'pedido', p.id,
  'migracao-servico-contratado:' || p.tratamento_legado_id,
  jsonb_build_object('tratamento_legado_id', p.tratamento_legado_id, 'execucao_status', p.execucao_status,
                     'orcamento_origem_id', p.orcamento_origem_id),
  now()
from public.pedidos p
where p.tratamento_legado_id is not null
on conflict (clinica_id, chave_idempotencia) do nothing;

-- ── 5. Validação final — qualquer divergência desfaz tudo ───────────────
do $$
declare
  a record;
  v_migrados int;
begin
  select * into a from _antes;

  select count(*) into v_migrados from public.pedidos where tratamento_legado_id is not null;
  if v_migrados <> a.tratamentos then
    raise exception 'Vendas migradas (%) diferente de serviços contratados (%)', v_migrados, a.tratamentos;
  end if;
  if (select count(*) from public.pedidos) <> a.pedidos + (a.tratamentos - a.ja_migrados) then
    raise exception 'Total de pedidos inesperado';
  end if;

  -- Cada venda migrada espelha exatamente o seu serviço.
  if exists (
    select 1 from public.tratamentos t
    left join public.pedidos p on p.tratamento_legado_id = t.id
    where p.id is null
       or p.clinica_id <> t.clinica_id
       or p.paciente_id is distinct from t.paciente_id
       or p.nome_cliente <> t.paciente_nome
       or p.telefone is distinct from t.paciente_telefone
       or p.valor_centavos <> round(t.valor_estimado * 100)::integer
       or p.orcamento_origem_id is distinct from t.orcamento_origem_id
       or p.execucao_status <> (case t.status when 'criado' then 'em_andamento' else t.status end)
       or p.proxima_data_prevista is distinct from t.proxima_data_prevista
       or p.motivo_interrupcao is distinct from t.motivo_interrupcao
       or p.execucao_concluida_em is distinct from t.concluido_em
       or p.execucao_interrompida_em is distinct from t.interrompido_em
       or p.execucao_abandonada_em is distinct from t.abandonado_em
  ) then
    raise exception 'Venda migrada não corresponde ao serviço contratado de origem';
  end if;

  -- Exatamente 1 item por venda migrada, somando o valor da venda.
  if exists (
    select 1 from public.pedidos p
    where p.tratamento_legado_id is not null
      and (select count(*) from public.pedido_itens i where i.pedido_id = p.id) <> 1
  ) or exists (
    select 1 from public.pedidos p
    join public.pedido_itens i on i.pedido_id = p.id
    where p.tratamento_legado_id is not null
      and (i.valor_total_centavos <> p.valor_centavos or i.servico_id is not null)
  ) then
    raise exception 'Item avulso da venda migrada inconsistente';
  end if;
  if (select count(*) from public.pedido_itens) <> a.itens + (a.tratamentos - a.ja_migrados) then
    raise exception 'Total de itens inesperado';
  end if;

  -- Toda cobrança ligada a serviço agora também aponta para a venda migrada dele.
  if exists (
    select 1 from public.cobrancas c
    left join public.pedidos p on p.id = c.pedido_origem_id
    where c.tratamento_origem_id is not null
      and (p.id is null or p.tratamento_legado_id <> c.tratamento_origem_id)
  ) then
    raise exception 'Vínculo cobrança → venda não convertido';
  end if;

  -- Nada do que já existia mudou.
  if (select count(*) from public.tratamentos) <> a.tratamentos
     or (select md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from public.tratamentos t) <> a.hash_tratamentos then
    raise exception 'public.tratamentos foi alterada — abortado';
  end if;
  if (select md5(coalesce(string_agg(row_to_json(p)::text, '|' order by p.id), '')) from public.pedidos p where p.tratamento_legado_id is null) <> a.hash_pedidos_existentes
     or (select md5(coalesce(string_agg(row_to_json(i)::text, '|' order by i.id), '')) from public.pedido_itens i join public.pedidos p on p.id = i.pedido_id where p.tratamento_legado_id is null) <> a.hash_itens_existentes then
    raise exception 'Pedido existente (ou seus itens) foi alterado — abortado';
  end if;
  if (select count(*) from public.estoque_movimentos) <> a.movimentos
     or (select md5(coalesce(string_agg(row_to_json(m)::text, '|' order by m.id), '')) from public.estoque_movimentos m) <> a.hash_movimentos then
    raise exception 'Movimentos de estoque foram alterados — abortado';
  end if;
  if (select count(*) from public.eventos_dominio where entidade_tipo = 'tratamento') <> a.eventos_tratamento
     or (select md5(coalesce(string_agg(row_to_json(e)::text, '|' order by e.id), '')) from public.eventos_dominio e where e.entidade_tipo = 'tratamento') <> a.hash_eventos_tratamento then
    raise exception 'Eventos históricos de tratamento foram alterados — abortado';
  end if;
  if (select count(*) from public.cobrancas) <> a.cobrancas then
    raise exception 'Total de cobranças mudou — abortado';
  end if;
end $$;

-- Resumo para conferência (lido antes do commit).
select
  (select count(*) from public.pedidos)                                          as pedidos,
  (select count(*) from public.pedidos where tratamento_legado_id is not null)   as vendas_migradas,
  (select count(*) from public.pedido_itens)                                     as pedido_itens,
  (select count(*) from public.tratamentos)                                      as tratamentos_preservados,
  (select count(*) from public.cobrancas where pedido_origem_id is not null)     as cobrancas_com_venda,
  (select count(*) from public.estoque_movimentos)                               as estoque_movimentos,
  (select count(*) from public.eventos_dominio where entidade_tipo = 'tratamento') as eventos_tratamento;

commit;
