-- =========================================================
-- OrganizaPro — CAMPOS OPCIONAIS: Título Principal / Subtítulo do Hero
--
-- PENDENTE DE APROVAÇÃO E EXECUÇÃO MANUAL PELO DIRETOR.
-- Não foi aplicada. Preparada apenas para revisão.
--
-- Contexto: a Missão Final pede edição de "título principal" e
-- "subtítulo" na Identidade do site. Hoje esses textos são 100%
-- gerados automaticamente (gerarTituloHero/gerarSubtituloHero em
-- app/empresa/[slug]/_lib/helpers.ts) a partir de nome/especialidade/
-- cidade/estado — não existe coluna alguma para uma versão editável
-- pelo cliente. Implementar essa edição no /site exige estas duas
-- colunas novas; até a aprovação, o painel mantém apenas os campos
-- que já existem hoje na tabela.
--
-- Ambas nullable e opcionais: quando NULL (o padrão, inclusive para
-- todo cliente já existente), o site público continua usando o texto
-- gerado automaticamente — nenhum comportamento atual muda até que o
-- próprio cliente preencha um valor pelo painel.
-- =========================================================

ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS hero_titulo TEXT;
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS hero_subtitulo TEXT;

-- A view pública (clinica_config_publica) precisa ser recriada incluindo
-- as duas colunas nesta mesma migração, para que o site sem login também
-- possa exibir o texto customizado quando preenchido:
CREATE OR REPLACE VIEW clinica_config_publica AS
SELECT
  clinica_id,
  slug,
  logo_url,
  hero_url,
  banner_url,
  nota_google,
  num_avaliacoes,
  horario_funcionamento,
  hero_titulo,
  hero_subtitulo,
  instagram_url,
  facebook_url,
  linkedin_url,
  tiktok_url,
  seo_titulo,
  seo_descricao,
  seo_imagem_url
FROM clinica_config;

REVOKE ALL PRIVILEGES ON clinica_config_publica FROM anon, authenticated;
GRANT SELECT ON clinica_config_publica TO anon, authenticated;
