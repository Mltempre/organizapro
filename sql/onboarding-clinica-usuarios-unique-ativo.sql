-- P1.1: Fechar a Casa do OrganizaPro — Onboarding self-service.
-- PREPARADA, NÃO EXECUTADA. Aguardando GO explícito antes de rodar em
-- produção (SQL Safety Gate: confirmar produto/projeto/ambiente antes de
-- qualquer DDL).
--
-- Por quê: POST /api/minha-clinica/provisionar já reduz a janela de uma
-- corrida (dois cliques/abas simultâneos do MESMO usuário sem vínculo
-- ainda, criando duas clinicas) relendo o vínculo do banco antes de
-- inserir, mas isso não é atômico sem uma constraint real — hoje
-- clinica_usuarios não tem NENHUMA unicidade em usuario_id. A aplicação
-- já assume, em vários lugares (app/api/minha-clinica GET usa
-- .maybeSingle()), que existe no máximo um vínculo ATIVO por usuário —
-- este índice só torna essa suposição uma garantia real do banco.
--
-- Índice parcial (não único global): um usuário pode ter várias linhas
-- INATIVAS (ex.: vínculo revogado no passado) — só nunca duas ATIVAS ao
-- mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS clinica_usuarios_usuario_ativo_uniq
  ON public.clinica_usuarios (usuario_id)
  WHERE ativo = true;
