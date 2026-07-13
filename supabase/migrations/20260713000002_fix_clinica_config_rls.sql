-- =========================================================
-- OrganizaPro — CORREÇÃO DE SEGURANÇA (não relacionada ao Site
-- Premium 6.0, encontrada ao validar RLS antes de construir a edição
-- de Banner/Redes Sociais/SEO em cima da mesma tabela).
--
-- Diagnóstico confirmado por teste direto (dois tenants isolados e
-- descartáveis, já removidos): um cliente ANÔNIMO, sem login algum,
-- conseguiu dar UPDATE na clinica_config de outro tenant — incluindo
-- zapi_token/zapi_client_token (credenciais da integração de
-- WhatsApp), slug, logo_url, hero_url e os campos novos de
-- banner/redes sociais/SEO. RLS estava ausente ou com policy
-- permissiva demais (sem checagem de posse) nesta tabela.
--
-- Modelo de isolamento usado: clinica_id IN (SELECT clinica_id FROM
-- clinica_usuarios WHERE usuario_id = auth.uid()) — o mesmo padrão já
-- usado por clinica_faq/clinica_servicos/clinica_galeria/
-- clinica_depoimentos/clinica_estrutura/clinica_equipe. Suporta
-- múltiplos usuários por clínica (ex.: dono + recepcionista), ao
-- contrário de um modelo baseado só em user_id.
-- =========================================================

-- 1) Remove QUALQUER policy existente na tabela, seja qual for o nome.
--    Não há como enumerar policies via API antes desta migração (só
--    quem roda isto no SQL Editor tem acesso a pg_policies), então
--    este bloco varre e derruba tudo que existir hoje, garantindo que
--    nenhuma policy antiga permissiva sobreviva ao lado das novas.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clinica_config'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clinica_config', pol.policyname);
  END LOOP;
END $$;

-- 2) Garante RLS habilitado (idempotente).
ALTER TABLE clinica_config ENABLE ROW LEVEL SECURITY;

-- 3) SELECT: SEM leitura pública na tabela base. Só a própria clínica
--    do usuário autenticado. O site público (sem sessão) passa a ler
--    através da view clinica_config_publica (seção 6), não da tabela.
CREATE POLICY "clinica_config_select_own" ON clinica_config
  FOR SELECT USING (
    clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid())
  );

-- 4) INSERT: só para a própria clínica do usuário autenticado.
CREATE POLICY "clinica_config_insert_own" ON clinica_config
  FOR INSERT WITH CHECK (
    clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid())
  );

-- 5) UPDATE: USING restringe quais linhas podem ser alvo; WITH CHECK
--    impede trocar o clinica_id da linha para "sequestrá-la" para
--    outra clínica durante o UPDATE.
CREATE POLICY "clinica_config_update_own" ON clinica_config
  FOR UPDATE
  USING (clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));

-- 6) DELETE: nenhuma policy criada de propósito. Busquei no código do
--    projeto inteiro e nenhuma tela ou API faz DELETE em
--    clinica_config. Com RLS ativo e sem policy de DELETE, a operação
--    fica negada por padrão para qualquer cliente autenticado ou
--    anônimo — só o backend (service role, que sempre ignora RLS)
--    poderia remover, se algum dia for necessário.

-- 7) View pública somente-leitura: expõe só as colunas que o site
--    institucional (sem sessão) realmente precisa. Uma view comum
--    (sem security_invoker) roda com o privilégio de quem a criou, não
--    do usuário anônimo — por isso ela "atravessa" o RLS acima, mas só
--    para este conjunto de colunas. Nunca expõe zapi_token,
--    zapi_client_token, e-mail, telefone, endereço ou as mensagens
--    internas (msg_lembrete/msg_confirmacao/msg_avaliacao/etc.).
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
  instagram_url,
  facebook_url,
  linkedin_url,
  tiktok_url,
  seo_titulo,
  seo_descricao,
  seo_imagem_url
FROM clinica_config;

-- Revoga qualquer privilégio herdado/padrão antes de conceder só o
-- necessário — garante que a view nunca acumule INSERT/UPDATE/DELETE
-- por engano, mesmo que uma configuração futura do Postgres/Supabase
-- mude o comportamento padrão de GRANT em novos objetos.
REVOKE ALL PRIVILEGES ON clinica_config_publica FROM anon, authenticated;
GRANT SELECT ON clinica_config_publica TO anon, authenticated;
