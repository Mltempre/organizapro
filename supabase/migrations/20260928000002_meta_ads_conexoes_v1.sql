-- Migration PREPARADA, NÃO EXECUTADA — Meta Ads V1 Enxuto.
-- Criada no repositório; NÃO aplicar automaticamente em produção.
-- Missão: META ADS V1 ENXUTO (DIAGNÓSTICO → PESQUISA OFICIAL → IMPLEMENTAÇÃO).
--
-- Por que uma tabela nova é necessária:
--   a credencial OAuth da Meta (token de usuário trocado para long-lived)
--   precisa ser persistida POR TENANT de forma cifrada, no mesmo desenho já
--   versionado de google_business_profile_connections. Não existe coluna ou
--   tabela existente adequada: clinica_config concentra as credenciais do
--   módulo WhatsApp e não é superfície desta integração; ampliar a view
--   pública clinica_config_publica estaria fora do escopo autorizado.
--
-- Segurança:
--   • RLS habilitado; NENHUM privilégio para anon/authenticated nem public —
--     somente service_role (leituras no servidor após autorizarUsuarioNaClinica);
--   • token sempre cifrado (AES-256-GCM no servidor) — nunca em texto puro,
--     nunca devolvido ao browser, nunca logado;
--   • clinica_id UNIQUE + FK para clinicas → um registro por tenant;
--     o filtro eq(clinica_id) com tenant derivado da sessão isola os tenants.
--
-- Idempotente e não-destrutiva: CREATE TABLE IF NOT EXISTS + IF NOT EXISTS no
-- índice; nenhum dado existente é alterado; nenhuma view/RPC é tocada.

begin;

create table if not exists public.meta_ads_conexoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null unique references public.clinicas(id) on delete cascade,
  conta_ads_id text,
  conta_ads_nome text,
  moeda text,
  access_token_ciphertext text not null,
  escopos_grantados text[] not null default '{}',
  conectado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists meta_ads_conexoes_clinica_idx
  on public.meta_ads_conexoes (clinica_id);

alter table public.meta_ads_conexoes enable row level security;

revoke all on public.meta_ads_conexoes from public, anon, authenticated;

comment on table public.meta_ads_conexoes is
  'Credencial OAuth da Meta (escopo ads_read) cifrada no servidor, por tenant. Sem acesso direto de public/anon/authenticated; apenas service_role apos autorizacao de tenant na rota do servidor.';

commit;