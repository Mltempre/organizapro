-- ─────────────────────────────────────────────────────────────────────────────
-- FIX PENDENTE — unicidade estrutural de clinica_config.zapi_instance (v1)
-- Gate WhatsApp + Chatbot V1 (2026-09-28). NÃO APLICADO.
--
-- Por quê: o webhook Z-API resolve o tenant pela instância
-- (clinica_config.zapi_instance) e já fica fail-closed quando ela é ambígua;
-- a rota PUT /api/configuracoes já recusa instância de outro negócio. Este
-- índice é a proteção estrutural (qualquer caminho de escrita).
--
-- ATENÇÃO — tabela COMPARTILHADA com o ClínicaFlow: o índice também passa a
-- valer para escritas do ClínicaFlow. Aplicar somente com GO explícito do
-- responsável, pelo SQL Editor, depois de rodar o PRÉ-CHECK abaixo.
--
-- Estado real verificado em 2026-09-28 (somente leitura, contagens): 16
-- linhas, 12 nulas, 0 vazias, 4 preenchidas, 0 duplicadas (exatas e
-- normalizadas por lower(btrim())). Compatível.
--
-- Não altera nem apaga nenhum registro. NULL e vazio ficam fora do índice
-- (vários negócios sem instância continuam válidos).
--
-- PRÉ-CHECK (somente leitura) — esperado: 0 linhas.
--   select lower(btrim(zapi_instance)) as instancia_normalizada, count(*)
--     from public.clinica_config
--    where zapi_instance is not null and btrim(zapi_instance) <> ''
--    group by 1 having count(*) > 1;
--
-- ROLLBACK (se necessário):
--   drop index if exists public.clinica_config_zapi_instance_unica_uidx;
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  duplicadas integer;
begin
  select count(*) into duplicadas
    from (
      select lower(btrim(zapi_instance))
        from public.clinica_config
       where zapi_instance is not null and btrim(zapi_instance) <> ''
       group by 1
      having count(*) > 1
    ) d;
  if duplicadas > 0 then
    raise exception 'ABORTADO: % instância(s) Z-API vinculada(s) a mais de um negócio em clinica_config — resolver manualmente antes; nada foi alterado', duplicadas;
  end if;
end $$;

create unique index if not exists clinica_config_zapi_instance_unica_uidx
  on public.clinica_config (lower(btrim(zapi_instance)))
  where zapi_instance is not null and btrim(zapi_instance) <> '';

commit;

-- VERIFICAÇÃO (somente leitura) — esperado: 1 linha com a definição acima.
--   select indexname, indexdef from pg_indexes
--    where schemaname = 'public' and indexname = 'clinica_config_zapi_instance_unica_uidx';
