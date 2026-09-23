-- OrganizaPro - pre-flight read-only dos seis bloqueadores de migrations.
-- NAO E MIGRATION. NAO ALTERA DADOS NEM SCHEMA.
-- Executar somente em ambiente autorizado e salvar o resultado integral.
-- As consultas da secao 8 dependem das tabelas existentes; execute cada uma
-- somente quando a secao 2 confirmar a existencia do objeto correspondente.

-- 1. Identidade do banco. Confirmar projeto/host antes de qualquer futuro DDL.
select
  current_database() as database_name,
  current_user as role_name,
  inet_server_addr() as server_address,
  inet_server_port() as server_port,
  current_setting('server_version') as server_version,
  now() as inspected_at;

-- 2. Existencia dos objetos envolvidos.
select objeto, to_regclass(objeto) as regclass
from (values
  ('public.origem_captacoes'),
  ('public.pedidos'),
  ('public.pedido_itens'),
  ('public.pacientes'),
  ('public.oportunidades_demanda'),
  ('public.clinicas'),
  ('public.clinica_config'),
  ('public.clinica_config_publica'),
  ('public.chatbot_leads')
) as objetos(objeto)
order by objeto;

-- 3. Colunas, defaults e nullability. Inclui as duas grafias de timestamp
-- de origem para impedir que uma divergencia seja escolhida silenciosamente.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'origem_captacoes', 'pedidos', 'pedido_itens', 'pacientes',
    'oportunidades_demanda', 'clinicas', 'clinica_config', 'chatbot_leads'
  )
order by table_name, ordinal_position;

-- 4. Constraints e indices reais.
select
  c.conrelid::regclass::text as table_name,
  c.conname,
  c.contype,
  c.convalidated,
  pg_get_constraintdef(c.oid, true) as definition
from pg_constraint c
where c.connamespace = 'public'::regnamespace
  and c.conrelid in (
    to_regclass('public.origem_captacoes'),
    to_regclass('public.pedidos'),
    to_regclass('public.pedido_itens'),
    to_regclass('public.pacientes'),
    to_regclass('public.oportunidades_demanda'),
    to_regclass('public.chatbot_leads')
  )
order by table_name, c.conname;

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'origem_captacoes', 'pedidos', 'pedido_itens', 'pacientes',
    'oportunidades_demanda', 'chatbot_leads'
  )
order by tablename, indexname;

-- 5. RLS, policies e grants. Uma policy permissiva soma com as demais;
-- por isso o resultado deve ser revisado integralmente, nao por nome parcial.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'origem_captacoes', 'pedidos', 'pedido_itens',
    'oportunidades_demanda', 'clinicas', 'clinica_config', 'chatbot_leads'
  )
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'origem_captacoes', 'pedidos', 'pedido_itens',
    'oportunidades_demanda', 'clinicas', 'clinica_config', 'chatbot_leads'
  )
order by tablename, policyname;

select
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'origem_captacoes', 'pedidos', 'pedido_itens',
    'oportunidades_demanda', 'clinicas', 'clinica_config', 'chatbot_leads'
  )
order by table_name, grantee, privilege_type;

-- 6. RPCs/views publicas e a RPC governada de oportunidades.
select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig,
  p.proacl,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('site_publico_por_slug_v2', 'transicionar_oportunidade_demanda_v1')
order by p.proname, identity_arguments;

select
  n.nspname as schema_name,
  c.relname as view_name,
  pg_get_userbyid(c.relowner) as owner,
  c.reloptions,
  pg_get_viewdef(c.oid, true) as definition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
  and c.relname = 'clinica_config_publica';

select
  routine_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name in ('site_publico_por_slug_v2', 'transicionar_oportunidade_demanda_v1')
order by routine_name, grantee;

-- 7. Historico de migrations: primeiro descubra a tabela real. O Supabase
-- normalmente usa supabase_migrations.schema_migrations, mas nao presumimos.
select
  n.nspname as schema_name,
  c.relname as relation_name,
  c.relkind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname ilike '%migration%'
   or c.relname ilike '%migration%'
order by n.nspname, c.relname;

-- Se a relacao acima confirmar supabase_migrations.schema_migrations,
-- executar separadamente (continua read-only):
-- select * from supabase_migrations.schema_migrations order by version;

-- 8. Checagens de dados. EXECUTAR SOMENTE APOS a secao 2 confirmar cada
-- tabela. Permanecem comentadas para um banco onde o objeto ainda nao existe.

-- 8.1 Origem: divergencia temporal, duplicidade e paciente de outro tenant.
-- select
--   count(*) filter (where criado_em is null) as criado_em_nulo,
--   count(*) filter (where created_at is null) as created_at_nulo,
--   count(*) filter (where criado_em is distinct from created_at) as timestamps_divergentes
-- from public.origem_captacoes;
-- select clinica_id, codigo_rastreio, count(*)
-- from public.origem_captacoes group by 1, 2 having count(*) > 1;
-- select o.id, o.clinica_id as origem_clinica, p.clinica_id as paciente_clinica
-- from public.origem_captacoes o
-- join public.pacientes p on p.id = o.paciente_id
-- where o.paciente_id is not null and p.clinica_id <> o.clinica_id;

-- 8.2 Pedidos: vinculos cross-tenant e itens inconsistentes.
-- select pe.id, pe.clinica_id as pedido_clinica, p.clinica_id as paciente_clinica
-- from public.pedidos pe
-- join public.pacientes p on p.id = pe.paciente_id
-- where pe.paciente_id is not null and p.clinica_id <> pe.clinica_id;
-- select i.id, i.clinica_id as item_clinica, pe.clinica_id as pedido_clinica
-- from public.pedido_itens i join public.pedidos pe on pe.id = i.pedido_id
-- where i.clinica_id <> pe.clinica_id;
-- select i.id, i.clinica_id as item_clinica, s.clinica_id as servico_clinica
-- from public.pedido_itens i join public.clinica_servicos s on s.id = i.servico_id
-- where i.servico_id is not null and i.clinica_id <> s.clinica_id;

-- 8.3 Chatbot: caminho de conversao e dados que exigem decisao humana.
-- select data_type, udt_name, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'chatbot_leads'
--   and column_name in ('score', 'etapa');
-- select score, count(*) from public.chatbot_leads group by score order by score;
-- select count(*) as etapa_nula from public.chatbot_leads where etapa is null;
-- select clinica_id, telefone, count(*)
-- from public.chatbot_leads group by 1, 2 having count(*) > 1;
