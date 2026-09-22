-- P1.3 — Google/Meta Ads + Atribuição (Fase 1: Origem Real).
-- PREPARADA, NÃO EXECUTADA. Aguardando GO explícito antes de rodar em
-- produção (SQL Safety Gate: confirmar produto/projeto/ambiente antes de
-- qualquer DDL).
--
-- Por quê: lib/atribuicao-origem.ts (captura/classificação pura) e
-- lib/origem-persistencia.ts (I/O real, fail-closed) já existem e já são
-- consumidos em produção — app/empresa/[slug]/page.tsx captura UTM/
-- gclid/fbclid a cada visita real do Site Premium; SiteEmpresaClient.tsx
-- e _components/Servicos.tsx anexam o código de rastreio aos links de
-- WhatsApp; app/api/chatbot/message/route.ts extrai esse código da
-- mensagem recebida e tenta vincular ao paciente. TODAS essas chamadas já
-- rodam hoje contra `origem_captacoes`, que ainda não existe — cada uma
-- falha silenciosamente (try/catch + warn, nunca quebra a página/webhook)
-- exatamente como os próprios arquivos já documentam. Esta migration é o
-- único passo que falta para a cadeia inteira (Origem → Lead/Oportunidade
-- → Contato/WhatsApp) passar a persistir de verdade, sem NENHUMA mudança
-- de código adicional.
--
-- RLS: nenhuma policy para authenticated/anon — mesmo padrão de
-- clinicas/clinica_usuarios/eventos_dominio (acesso só via rotas
-- service-role, que aplicam seu próprio filtro de tenant em código).
CREATE TABLE IF NOT EXISTS public.origem_captacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id      uuid NOT NULL REFERENCES public.clinicas(id),
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  gclid           text,
  fbclid          text,
  referrer_host   text,
  classificacao   text NOT NULL CHECK (classificacao IN ('google_ads', 'meta_ads', 'campanha_utm', 'busca_organica', 'referencia', 'direto')),
  codigo_rastreio text NOT NULL,
  capturado_em    timestamptz NOT NULL,
  paciente_id     uuid REFERENCES public.pacientes(id),
  vinculado_em    timestamptz,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

-- Um código de rastreio é único por clínica (gerarCodigoOrigem já garante
-- baixíssima colisão; o índice único é a garantia real do banco, mesmo
-- padrão de chave_idempotencia em eventos_dominio).
CREATE UNIQUE INDEX IF NOT EXISTS origem_captacoes_clinica_codigo_uniq
  ON public.origem_captacoes (clinica_id, codigo_rastreio);

CREATE INDEX IF NOT EXISTS origem_captacoes_clinica_idx ON public.origem_captacoes (clinica_id);
CREATE INDEX IF NOT EXISTS origem_captacoes_paciente_idx ON public.origem_captacoes (paciente_id) WHERE paciente_id IS NOT NULL;

ALTER TABLE public.origem_captacoes ENABLE ROW LEVEL SECURITY;
