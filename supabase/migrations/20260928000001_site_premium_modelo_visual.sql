-- ============================================================
-- OrganizaPro — Site Premium: modelo visual escolhido pelo tenant
-- (aurora | vertice | pulse)
--
-- MISSÃO: SITE PREMIUM / SLUG — CORREÇÃO SEGURA (ETAPA 2).
-- PENDENTE DE APLICAÇÃO MANUAL NO SUPABASE — criada no repositório,
-- NÃO aplicada automaticamente em produção.
--
-- PREFLIGHT DE PRODUÇÃO EXECUTADO (somente leitura) — project ref
-- rxuedvrvujwlprsaprgn — e confirmou:
--   • public.clinica_config_publica: owner = postgres,
--     reloptions = NULL, ACL explícita presente;
--   • colunas exatamente no ESTADO A versionado (000002): 15 colunas,
--     clinica_id ... seo_imagem_url, SEM hero_titulo/hero_subtitulo;
--   • funções que referenciam a view: site_publico_por_slug,
--     site_publico_por_slug_v2 e site_publico_por_slug_v3 — todas
--     security_definer = true (a view é caminho de leitura pública);
--   • default privileges de produção confirmam o risco de janela de
--     grants do método anterior (DROP + CREATE).
--
-- MÉTODO (corrigido conforme auditoria aprovada): CREATE OR REPLACE VIEW
-- preserva OID, owner, ACL e reloptions; mantém EXATAMENTE as 15 colunas
-- atuais na mesma ordem e acrescenta SOMENTE `modelo` como 16ª e última
-- coluna. NENHUMA coluna hero é adicionada; NENHUMA opção
-- security_invoker/security_barrier; NENHUM CASCADE; NENHUMA RPC
-- reconstruída ou alterada. Comportamento compatível com consumidores por
-- lista explícita de colunas e por SELECT * (apenas ganha um campo).
--
-- ATÔMICO E FAIL-CLOSED: o lote inteiro roda dentro de BEGIN/COMMIT.
-- Se qualquer instrução falhar (inclusive divergência inesperada de estado
-- da view), nada é commitado — nenhum estado parcial sobrevive.
--
-- FALLBACK SEGURO: DEFAULT NULL. Tenant sem escolha (todos os existentes
-- hoje) continua caindo na recomendação automática por segmento — nenhum
-- comportamento atual muda apenas por aplicar esta migration. Nenhuma
-- linha é atualizada; nenhum dado não relacionado é alterado.
-- Idempotente: rodar duas vezes produz o mesmo resultado.
-- ============================================================

BEGIN;

-- 1) Coluna (idempotente; sem destructive rewrite de tabela).
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS modelo TEXT DEFAULT NULL;

-- 2) Allowlist no próprio banco (idempotente). NULL significa "sem escolha
--    manual" e é sempre permitido; valores fora da lista são rejeitados
--    para QUALQUER escrita, venha de onde vier.
ALTER TABLE clinica_config DROP CONSTRAINT IF EXISTS clinica_config_modelo_check;
ALTER TABLE clinica_config ADD CONSTRAINT clinica_config_modelo_check
  CHECK (modelo IS NULL OR modelo IN ('aurora', 'vertice', 'pulse'));

-- 3) View pública: CREATE OR REPLACE — preserva owner/ACL/reloptions e
--    anexa somente `modelo` por último. Se o estado real divergir do
--    ESTADO A confirmado no preflight, esta instrução falha e o COMMIT
--    nunca acontece (fail-closed: nada é alterado).
CREATE OR REPLACE VIEW public.clinica_config_publica AS
SELECT
  clinica_id,
  slug,
  logo_url,
  hero_url,
  banner_url,
  nota_google,
  num_avaliacoes,
  horario_funcionamento,
  instagram_url,
  facebook_url,
  linkedin_url,
  tiktok_url,
  seo_titulo,
  seo_descricao,
  seo_imagem_url,
  modelo
FROM public.clinica_config;

-- 4) Reforço idempotente dos privilégios (mesmo padrão versionado das
--    migrations 20260713000002/20260713000003): somente SELECT para
--    anon/authenticated, nunca INSERT/UPDATE/DELETE. Não altera owner
--    nem reloptions.
REVOKE ALL PRIVILEGES ON clinica_config_publica FROM anon, authenticated;
GRANT SELECT ON clinica_config_publica TO anon, authenticated;

COMMIT;
