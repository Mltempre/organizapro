-- =========================================================
-- OrganizaPro — Site Premium 6.0: FAQ real, Redes Sociais, SEO, Banner
-- Execute em: Supabase Dashboard → SQL Editor
-- Necessário para o módulo "Site" (Regra Nº2 da missão 6.0) ter onde
-- persistir Banner, Redes Sociais, SEO e um FAQ real por cliente.
-- =========================================================

-- FAQ (mesmo padrão de clinica_servicos/clinica_depoimentos/etc.)
CREATE TABLE IF NOT EXISTS clinica_faq (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  pergunta   TEXT NOT NULL,
  resposta   TEXT NOT NULL,
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clinica_faq ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "faq_read"   ON clinica_faq;
DROP POLICY IF EXISTS "faq_insert" ON clinica_faq;
DROP POLICY IF EXISTS "faq_update" ON clinica_faq;
DROP POLICY IF EXISTS "faq_delete" ON clinica_faq;
CREATE POLICY "faq_read"   ON clinica_faq FOR SELECT USING (true);
CREATE POLICY "faq_insert" ON clinica_faq FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "faq_update" ON clinica_faq FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "faq_delete" ON clinica_faq FOR DELETE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));

-- Banner, Redes Sociais e SEO — colunas novas em clinica_config (mesma
-- tabela onde já vivem slug/logo_url/hero_url/nota_google/etc.)
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS banner_url        TEXT;
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS instagram_url     TEXT;
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS facebook_url      TEXT;
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS linkedin_url      TEXT;
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS tiktok_url        TEXT;
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS seo_titulo        TEXT;
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS seo_descricao     TEXT;
ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS seo_imagem_url    TEXT;
