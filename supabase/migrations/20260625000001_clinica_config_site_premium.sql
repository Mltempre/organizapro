-- Adiciona colunas de site premium em clinica_config
ALTER TABLE clinica_config
  ADD COLUMN IF NOT EXISTS logo_url       TEXT,
  ADD COLUMN IF NOT EXISTS hero_url       TEXT,
  ADD COLUMN IF NOT EXISTS nota_google    NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS num_avaliacoes INTEGER;
