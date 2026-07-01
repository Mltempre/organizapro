-- =========================================================
-- ClínicaFlow — Site Modules v1.1
-- Execute em: Supabase Dashboard → SQL Editor
-- =========================================================

-- GALERIA
CREATE TABLE IF NOT EXISTS clinica_galeria (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id  UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  categoria   TEXT NOT NULL DEFAULT 'Outros',
  titulo      TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clinica_galeria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "galeria_read"   ON clinica_galeria;
DROP POLICY IF EXISTS "galeria_insert" ON clinica_galeria;
DROP POLICY IF EXISTS "galeria_update" ON clinica_galeria;
DROP POLICY IF EXISTS "galeria_delete" ON clinica_galeria;
CREATE POLICY "galeria_read"   ON clinica_galeria FOR SELECT USING (true);
CREATE POLICY "galeria_insert" ON clinica_galeria FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "galeria_update" ON clinica_galeria FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "galeria_delete" ON clinica_galeria FOR DELETE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));

-- EQUIPE
CREATE TABLE IF NOT EXISTS clinica_equipe (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id   UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  foto_url     TEXT,
  nome         TEXT NOT NULL,
  especialidade TEXT,
  cro          TEXT,
  descricao    TEXT,
  ordem        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clinica_equipe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipe_read"   ON clinica_equipe;
DROP POLICY IF EXISTS "equipe_insert" ON clinica_equipe;
DROP POLICY IF EXISTS "equipe_update" ON clinica_equipe;
DROP POLICY IF EXISTS "equipe_delete" ON clinica_equipe;
CREATE POLICY "equipe_read"   ON clinica_equipe FOR SELECT USING (true);
CREATE POLICY "equipe_insert" ON clinica_equipe FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "equipe_update" ON clinica_equipe FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "equipe_delete" ON clinica_equipe FOR DELETE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));

-- ANTES E DEPOIS
CREATE TABLE IF NOT EXISTS clinica_antes_depois (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  antes_url  TEXT,
  depois_url TEXT,
  titulo     TEXT NOT NULL,
  descricao  TEXT,
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clinica_antes_depois ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_read"   ON clinica_antes_depois;
DROP POLICY IF EXISTS "ad_insert" ON clinica_antes_depois;
DROP POLICY IF EXISTS "ad_update" ON clinica_antes_depois;
DROP POLICY IF EXISTS "ad_delete" ON clinica_antes_depois;
CREATE POLICY "ad_read"   ON clinica_antes_depois FOR SELECT USING (true);
CREATE POLICY "ad_insert" ON clinica_antes_depois FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "ad_update" ON clinica_antes_depois FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "ad_delete" ON clinica_antes_depois FOR DELETE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));

-- DEPOIMENTOS
CREATE TABLE IF NOT EXISTS clinica_depoimentos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  cidade     TEXT,
  comentario TEXT NOT NULL,
  nota       INTEGER NOT NULL DEFAULT 5 CHECK (nota BETWEEN 1 AND 5),
  foto_url   TEXT,
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clinica_depoimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dep_read"   ON clinica_depoimentos;
DROP POLICY IF EXISTS "dep_insert" ON clinica_depoimentos;
DROP POLICY IF EXISTS "dep_update" ON clinica_depoimentos;
DROP POLICY IF EXISTS "dep_delete" ON clinica_depoimentos;
CREATE POLICY "dep_read"   ON clinica_depoimentos FOR SELECT USING (true);
CREATE POLICY "dep_insert" ON clinica_depoimentos FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "dep_update" ON clinica_depoimentos FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "dep_delete" ON clinica_depoimentos FOR DELETE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));

-- SERVICOS
CREATE TABLE IF NOT EXISTS clinica_servicos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  icone      TEXT NOT NULL DEFAULT 'sparkle',
  imagem_url TEXT,
  nome       TEXT NOT NULL,
  descricao  TEXT,
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clinica_servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "srv_read"   ON clinica_servicos;
DROP POLICY IF EXISTS "srv_insert" ON clinica_servicos;
DROP POLICY IF EXISTS "srv_update" ON clinica_servicos;
DROP POLICY IF EXISTS "srv_delete" ON clinica_servicos;
CREATE POLICY "srv_read"   ON clinica_servicos FOR SELECT USING (true);
CREATE POLICY "srv_insert" ON clinica_servicos FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "srv_update" ON clinica_servicos FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "srv_delete" ON clinica_servicos FOR DELETE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));

-- ESTRUTURA
CREATE TABLE IF NOT EXISTS clinica_estrutura (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  imagem_url TEXT NOT NULL,
  titulo     TEXT NOT NULL,
  descricao  TEXT,
  categoria  TEXT NOT NULL DEFAULT 'Outros',
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clinica_estrutura ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "est_read"   ON clinica_estrutura;
DROP POLICY IF EXISTS "est_insert" ON clinica_estrutura;
DROP POLICY IF EXISTS "est_update" ON clinica_estrutura;
DROP POLICY IF EXISTS "est_delete" ON clinica_estrutura;
CREATE POLICY "est_read"   ON clinica_estrutura FOR SELECT USING (true);
CREATE POLICY "est_insert" ON clinica_estrutura FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "est_update" ON clinica_estrutura FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "est_delete" ON clinica_estrutura FOR DELETE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
