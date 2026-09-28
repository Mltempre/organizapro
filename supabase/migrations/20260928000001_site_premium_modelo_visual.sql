-- ============================================================
-- OrganizaPro — Site Premium: modelo visual escolhido pelo tenant
-- (aurora | vertice | pulse)
--
-- MISSÃO: SITE PREMIUM / SLUG — FECHAMENTO MÍNIMO.
-- PENDENTE DE APLICAÇÃO MANUAL NO SUPABASE — esta migration é criada no
-- repositório mas NÃO deve ser aplicada automaticamente em produção.
--
-- O que faz (idempotente e não-destrutiva):
--   1) cria, se não existir, a coluna clinica_config.modelo;
--   2) restringe os valores à allowlist via CHECK (NULL = sem escolha);
--   3) recria a view clinica_config_publica expondo também `modelo`
--      (somente o necessário para o site público aplicar a escolha;
--      nenhum dado privado/credencial é exposto — a view continua
--      restrita ao mesmo conjunto já liberado).
--
-- FALLBACK SEGURO: DEFAULT NULL. Tenant sem escolha (todos os existentes
-- hoje) continua caindo na recomendação automática por segmento — nenhum
-- comportamento atual muda apenas por aplicar esta migration. Nenhuma
-- linha é atualizada; nenhum dado não relacionado é alterado.
-- ============================================================

-- 1) Coluna (idempotente; sem destructive rewrite de tabela).
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS modelo TEXT DEFAULT NULL;

-- 2) Allowlist no próprio banco (idempotente). NULL significa "sem escolha
--    manual" e é sempre permitido; valores fora da lista são rejeitados
--    para QUALQUER escrita, venha de onde vier.
ALTER TABLE clinica_config DROP CONSTRAINT IF EXISTS clinica_config_modelo_check;
ALTER TABLE clinica_config ADD CONSTRAINT clinica_config_modelo_check
  CHECK (modelo IS NULL OR modelo IN ('aurora', 'vertice', 'pulse'));

-- 3) View pública: recriada com as mesmas colunas já expostas + `modelo`.
--    O bloco tolera os estados possíveis da tabela:
--      • hero_titulo/hero_subtitulo só entram se existirem (migration
--        20260713000003 é de aplicação manual e pode não ter rodado);
--      • DROP + CREATE evita o erro de reordenação de colunas do
--        CREATE OR REPLACE VIEW quando a definição anterior diverge.
--    Os privilégios são reafirmados logo abaixo (mesmo padrão das
--    migrations 20260713000002/20260713000003): somente SELECT para
--    anon/authenticated, nunca INSERT/UPDATE/DELETE.
DO $$
DECLARE
  colunas_hero TEXT := '';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'clinica_config'
      AND column_name  = 'hero_titulo'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'clinica_config'
      AND column_name  = 'hero_subtitulo'
  ) THEN
    colunas_hero := '  hero_titulo,
  hero_subtitulo,
';
  END IF;

  EXECUTE format(
    'DROP VIEW IF EXISTS public.clinica_config_publica'
  );

  EXECUTE format(
    'CREATE VIEW public.clinica_config_publica AS
SELECT
  clinica_id,
  slug,
  logo_url,
  hero_url,
  banner_url,
  nota_google,
  num_avaliacoes,
  horario_funcionamento,
%s
  instagram_url,
  facebook_url,
  linkedin_url,
  tiktok_url,
  seo_titulo,
  seo_descricao,
  seo_imagem_url,
  modelo
FROM public.clinica_config',
    colunas_hero
  );
END $$;

REVOKE ALL PRIVILEGES ON clinica_config_publica FROM anon, authenticated;
GRANT SELECT ON clinica_config_publica TO anon, authenticated;
