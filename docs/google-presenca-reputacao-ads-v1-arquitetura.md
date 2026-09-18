# Google Presença + Reputação + Demanda/Ads — Arquitetura V1 (pré-migration, pré-OAuth)

Status: **PROPOSTA — nenhuma migration executada, nenhum SQL rodado contra
Supabase, nenhuma credencial/OAuth do Google ou Meta configurada.**
Construído inteiramente no OrganizaPro (`C:\Users\User\organizapro-work\smart-commerce-precheck`,
branch `audit/smart-commerce-precheck`, sobre o checkpoint `43e5e45`). A
ClínicaFlow foi consultada **somente em leitura** para localizar patrimônio
técnico reaproveitável — nenhum arquivo dela foi alterado.

Objetivo de produto: uma cadeia coerente, não três motores desconectados —

```
PRESENÇA → DESCOBERTA → CONTATO/LEAD → OPORTUNIDADE → CONVERSÃO
→ AVALIAÇÃO → REPUTAÇÃO → NOVA DEMANDA → RESULTADO MENSURÁVEL
```

convergindo no mesmo motor econômico que já existe (Sinal Canônico → Radar
→ Central de Oportunidades → Próxima Melhor Ação → Missão do Dia → Diretor
Digital → lifecycle Orçamento→Venda→Receita — ver
`docs/orcamento-venda-receita-v1-arquitetura.md`), nunca um motor paralelo.

---

## A. Mapa do que já existia no OrganizaPro (Fase 1)

Auditoria exaustiva do repositório (`lib/`, `app/`, `supabase/migrations/`).
Classificação: **A** = construído/conectado · **B** = parcial · **C** = ausente.

| # | Tópico | Classe | Evidência / observação |
|---|---|---|---|
| 1 | Reputação/avaliações | **B** | `app/api/cron/avaliacoes/route.ts` envia pedido de avaliação via WhatsApp (cron diário); tabela `avaliacoes` grava `respondeu:false` no envio. **`respondeu` nunca é atualizado por nenhum caminho real** — só aparece como `true` em scripts de seed/demo. `app/reputacao/page.tsx` exibe essa coluna como "✅ Respondeu"/"Taxa de Resposta": hoje sempre mostra 0% em produção real, porque nada confirma resposta de fato. |
| 2 | Google Business Profile / OAuth | **C** | Zero `googleapis`/OAuth/credencial no `package.json` ou no código. |
| 3 | Link de avaliação por clínica | **B** | `clinica_config.link_google` — colado manualmente pelo dono do negócio (`app/configuracoes/page.tsx`), nunca gerado/derivado pelo sistema (sem Place ID lookup). |
| 4 | Solicitação de avaliação (automação) | **B** | Cron diário (`vercel.json`, `0 23 * * *`) funcional — mas latência de até 24h (não é evento imediato pós-atendimento) e o laço nunca fecha (item 1). |
| 5 | Automações pós-atendimento | **B** | Dois crons reais (`avaliacoes`, `lembretes`) — hardcoded, não um motor de regras genérico. `app/automacao/page.tsx` é só um painel de logs. |
| 6 | Métricas/dashboard | **B** | `app/metricas`, `app/raio-x` (score "Índice OrganizaPro" com IA), `app/dashboard` — todos operacionais (agenda, pacientes, WhatsApp). Nenhum mostra dado de marketing/ads/CAC/ROAS. |
| 7 | Origem de clientes/leads | **C** | `chatbot_leads.origem` existe na coluna mas **nunca é escrita em lugar nenhum** — sempre null na prática. Não existe em `pacientes`/`agendamentos`. |
| 8 | Campanhas/anúncios | **C** | Nenhuma tabela/rota/lib. Único achado: gerador de ideias de post para Instagram (`app/conteudo`) — conteúdo, não gestão de anúncio/verba. |
| 9 | UTM (utm_source/medium/campaign/content) | **C** | Zero captura em código — único hit é o boilerplate do README do Vercel. |
| 10 | GCLID/fbclid | **C** | Zero ocorrências no repositório inteiro. |
| 11 | Conversões/atribuição | **C** | Nenhum código liga lead/venda a uma origem de marketing. |
| 12 | CAC/ROAS | **C** | Nenhuma ocorrência. |
| 13 | Conteúdo/local presence | **B** | `app/conteudo` é ideação de post via IA — não é gestão de SEO local/Google Business Profile. |
| 14 | Motor Smart Commerce (referência) | confirmado presente | `lib/oportunidades-clientes.ts`, `lib/nucleo-inteligente.ts`, `lib/ia-comercial.ts`, `lib/recomendacoes.ts`, `lib/orcamentos-state-machine.ts`. |
| 15 | Auth/isolamento de tenant | **A** | `lib/auth-clinica.ts` (`autorizarUsuarioNaClinica`) — bearer token → vínculo ativo em `clinica_usuarios` → `clinicas.produto==='organizapro'` literal. `clinica_id` pervasivo em toda tabela. |
| 16 | Rotas `app/` candidatas | **B** | Existem `reputacao`, `metricas`, `conteudo`, `automacao`. Não existem `google`, `presenca`, `ads`, `campanhas`, `marketing`, `crescimento`. |

**O maior achado da Fase 1 não é uma lacuna — é um dado fabricado por
omissão**: a página de Reputação promete uma confirmação ("✅ Respondeu")
que o sistema não tem como dar. A Fase 3 fecha exatamente isso.

---

## B. Patrimônio REAL encontrado na ClínicaFlow (Fase 2, somente leitura)

`main`/`master` da ClínicaFlow são finos (só uma página de reputação
inicial, sem cron, sem `auth-clinica`). **Todo o trabalho substancial vive
em branches de feature não mergeadas** — consultado aqui só como referência
arquitetural, nunca copiado literalmente (produto diferente, schema
diferente, `clinicas.produto==='clinicaflow'` != `'organizapro'`).

| # | Peça | Classificação | Onde | Nota |
|---|---|---|---|---|
| 1 | Solicitação automática de avaliação Google | **IMPLEMENTADO** | `feature/motor-reputacao-indicacao` | Cron entitlement-gated, link **rastreado** via `/r/[codigo]`, nunca fabrica "respondeu" — só "clicou". Modelo honesto, adotado como referência direta da Fase 3 abaixo. |
| 2 | "Reputação" (motor + estado) | **IMPLEMENTADO** | idem | `lib/motor-reputacao.ts`/`lib/motor-reputacao-indicacao.ts` — clique idempotente, indicação nunca condicionada a sentimento da avaliação (nota de compliance no próprio código). |
| 3a | Google Presença — diagnóstico manual honesto | **IMPLEMENTADO** | `feat/site-oficial-comercial` | `integracaoExternaGoogle: { ativa:false, observacao:"Nenhuma API..." }` — autodocumentado como não-integrado. Referência direta da Fase 4 abaixo. |
| 3b | Google Presença — OAuth real + API viva | **IMPLEMENTADO** (não mergeado) | `rei/revenue-reputacao-90e61f1` | OAuth2 completo, tokens AES-256-GCM amarrados a `clinica_id`, chamadas reais à Google Business Profile API, testes com fetch mockado. A peça mais robusta encontrada em toda a auditoria — mas é exatamente o tipo de coisa que este bloco foi instruído a **não** replicar sem gate explícito (credencial real). |
| 4 | Demanda Local | **IMPLEMENTADO** | `feature/motor-reputacao-indicacao` | `lib/motor-demanda.ts` — classificação determinística (regex, não LLM) de intenção comercial em mensagens WhatsApp, sem cron (expiração preguiçosa). Um sub-item (`document.referrer` "google."-origin no formulário do site) existe só num commit isolado, não confirmado nas branches seguintes — tratado como não-confiável. |
| 5 | `/crescimento` | **IMPLEMENTADO** | idem | Painel grande (1251 linhas), orquestra reputação/indicação/demanda/orçamento/tratamento/cobrança — não é mockup, mas também não é o que este bloco deve construir (Dashboard/Visual Lab está fora de escopo aqui). |
| 6 | Google Ads / Meta Ads (OAuth, API, GCLID/fbclid, atribuição) | **AUSENTE** | — | Confirmado por `git log --all` + `git grep` em todas as branches: zero commits, zero arquivos. |
| 7 | CAC/ROAS | **AUSENTE** (nem plano) | `app/blog/data/articles-part2.ts` | Único hit é **prosa de blog de marketing** explicando a fórmula de CAC para leitores — não é especificação técnica, não é código. |

**Conclusão que orienta a decisão de arquitetura**: existe patrimônio real e
testado para Reputação/Presença/Demanda (não copiável, mas replicável em
desenho nativo do OrganizaPro); não existe **nada**, em lugar nenhum, para
Ads — nem código, nem plano técnico. Este bloco parte de zero nesse eixo.

---

## C. O que era apenas pesquisa/plano (não código)

- CAC/ROAS: só prosa de blog (ClínicaFlow) explicando o conceito ao
  leitor final — não uma especificação técnica, muito menos código.
- Instagram/Facebook em `app/crescimento` (ClínicaFlow): explicitamente
  rotulado no próprio código como "não integrado ainda".
- Qualquer menção a Google Ads/Meta Ads em qualquer lugar do histórico:
  inexistente — nem como pesquisa, nem como plano.

Nada nesta categoria foi tratado como base para código nesta sessão —
regra da missão: só evidência real vira "implementado".

---

## D. Arquitetura — Google Presença + Reputação + Ads V1

### D.1 Princípio geral (aplicado em toda peça abaixo)

Mesma disciplina já estabelecida em
`docs/orcamento-venda-receita-v1-arquitetura.md`: **um campo ausente é
`null`, nunca um valor inventado; uma classificação sem evidência suficiente
cai no valor mais conservador, nunca no mais otimista.** Concretamente:
nunca fabricar estrelas, nota, quantidade de avaliações, "avaliou",
CAC ou ROAS sem o dado real correspondente.

### D.2 Reputação V1 — de "fabricado por omissão" a honesto (Fase 3)

Problema real encontrado (seção A.1): `avaliacoes.respondeu` nunca é
escrito, mas a UI já promete "✅ Respondeu". Correção, inspirada no modelo
honesto da ClínicaFlow (B.1/B.2) mas **implementada nativa** para o schema
do OrganizaPro:

- Trocar a pergunta impossível de responder ("o cliente avaliou?") pela
  pergunta que o próprio sistema pode confirmar ("o cliente clicou no
  link que levamos até ele?"). Clique é servido pelo próprio produto — é
  fato, não inferência.
- `lib/motor-reputacao.ts` (**construído, testado, 21 testes**): estado
  `"enviado" | "clicado"` (nunca `"avaliou"`/`"respondeu"` como valor
  possível do tipo), geração de código de rastreio, validação do link de
  destino contra esquemas perigosos (`javascript:`/`data:` — nunca um
  open-redirect), guarda anti-spam por janela de dias, `taxaDeCliquePct`
  (rótulo sempre "taxa de clique", nunca "taxa de resposta").
- `app/r/[codigo]/route.ts` (**construído**): redirect público (sem
  `Authorization` — o clique vem de fora, mesmo padrão de
  `app/api/webhook/zapi/route.ts`), idempotente (só grava o primeiro
  clique, com dupla proteção — leitura + `UPDATE ... WHERE clicado_em IS NULL`
  contra corrida de dois cliques quase simultâneos), sempre valida o
  destino antes de redirecionar.
- **Ainda não ligado a dado real**: a rota depende de duas colunas novas em
  `avaliacoes` (`codigo_rastreio`, `link_destino`) propostas na migration
  da seção H e **não executadas**. Até lá, qualquer clique cai no
  fallback seguro (redirect para `/`) sem quebrar nada que já funciona.
  **Decisão deliberada**: não tocar `app/api/cron/avaliacoes/route.ts` nem
  `app/reputacao/page.tsx` nesta sessão — ambos leem/escrevem colunas que
  já existem hoje em produção; adicionar `codigo_rastreio`/`link_destino`
  ao `INSERT` do cron antes da migration rodar quebraria o envio real de
  hoje. A ligação (cron passa a gerar o código e a usar o link rastreado;
  página de Reputação passa a mostrar "clicou" em vez de "respondeu") é
  um passo único, atômico com a migration — ver seção K.

### D.3 Estrutura canônica de origem/atribuição (Fase 5, prioridade 2)

`lib/atribuicao-origem.ts` (**construído, testado, ~24 testes**):

- `OrigemCaptada`: `utmSource/Medium/Campaign/Content`, `gclid`, `fbclid`,
  `referrerHost`, `capturadoEm` — tudo `string | null`, nunca inventado.
- `capturarOrigem(params, referrer, agora)`: função pura sobre dado já
  lido da requisição real (query string + `Referer`) — nunca consulta
  nada, mesmo padrão de `gerarOportunidadesClientes`.
- `classificarOrigem`: `google_ads` (gclid) > `meta_ads` (fbclid) >
  `campanha_utm` (utm sem click id) > `busca_organica` (referrer de motor
  de busca conhecido) > `referencia` (outro referrer) > `direto` (nada).
  Click id sempre vence UTM textual — é o sinal mais difícil de forjar
  por acidente (quem anexa é o próprio Google/Meta, não o operador da
  campanha).
- **Como fechar o loop sem precisar de API de Ads**: o clique no anúncio
  leva ao site público (`app/empresa/[slug]`, onde a origem É capturável
  via query string), mas o contato de fato acontece pelo WhatsApp — um
  link externo, fora do controle do sistema. `construirLinkComRastreio`
  injeta um código curto (`ref:<codigo>`) no texto pré-preenchido do link
  `wa.me`; `extrairCodigoRastreio` reconhece esse formato exato numa
  mensagem recebida (nunca adivinha a partir de texto livre do cliente).
  Isso fecha CAPTURA→ATRIBUIÇÃO sem OAuth, sem API de Ads, sem depender
  do parâmetro oficial de "click to WhatsApp ads" da Meta (que exigiria
  integração Business oficial — gate, seção G).
- `calcularCAC`/`calcularROAS`: `null` sempre que o custo real não existir
  (nunca dividido por zero, nunca inventado) — mesmo princípio de
  `calcularStatusPagamento` em `lib/orcamentos-state-machine.ts`. `ROAS`
  pode ser `0` legitimamente (campanha rodou, ainda não gerou receita
  atribuída) — `0` é um fato, não uma ausência.
- **Ainda não ligado a dado real**: nenhuma UI/rota chama
  `capturarOrigem` hoje. Wiring natural (não feito nesta sessão para não
  arriscar quebrar a renderização do site público sem poder testar em
  navegador real neste ambiente): `app/empresa/[slug]/page.tsx` já é um
  server component (`params: Promise<{slug}>`) — adicionar
  `searchParams: Promise<Record<string,string|string[]|undefined>>`,
  capturar a origem ali, repassar para `SiteEmpresaClient` →
  `Contato.tsx`/`Hero.tsx`, e trocar `waLink` por
  `construirLinkComRastreio(waLink, codigo)`. Ver seção K.

### D.4 Google Presença — diagnóstico honesto (Fase 4, prioridade 3)

`lib/presenca-digital.ts` (**construído, testado, 8 testes**) — nativo
para os campos que já existem em `clinica_config` hoje (nenhuma tabela
nova necessária para o diagnóstico em si):

- `calcularPresencaDigital`: checklist de completude de cadastro (8 itens
  — slug, link de avaliação, nota Google, nº de avaliações, telefone,
  endereço, horário, SEO), pontuação 0–100.
- `integracaoGoogleAtiva` é **literal `false`** no tipo — nunca lido de
  config, nunca vira `true` nesta fase. `observacaoIntegracao` explica
  por quê: nota/nº de avaliações são digitados manualmente, nunca lidos
  do Google. Mesmo padrão autodocumentado da referência B.3a.
- **Gate explícito (seção G)**: a integração real (B.3b — OAuth2 +
  Google Business Profile API) **não foi implementada nesta sessão**.
  Ela exige um app OAuth registrado no Google Cloud Console,
  `client_id`/`client_secret` reais e um usuário passando pela tela de
  consentimento do Google — nenhuma dessas três coisas existe neste
  ambiente. Só o **contrato** é projetado (seção G.1) — código real de
  troca de token, criptografia de credencial e chamada à API fica para
  quando o gate for resolvido.

### D.5 Contratos para Ads (Fase 5, prioridade 4 — só contrato + captura)

Coberto por `lib/atribuicao-origem.ts` (D.3): captura e classificação de
origem, `calcularCAC`/`calcularROAS` null-safe. **Nenhum "Ads Manager"
construído** — V1 prioriza captura + atribuição + prova de resultado,
exatamente como a missão pediu. Integração oficial com Google
Ads/Meta Ads (ler custo real de campanha, importar conversões, disparar
eventos de conversão) é **gate externo** (seção G.2/G.3) — projetada em
contrato, não implementada.

### D.6 Convergência com o motor existente

Nenhum motor novo, nenhuma duplicação:

- Um clique confirmado num link de avaliação (D.2) é o tipo de fato que
  já cabe como sinal no Radar — ex.: "avaliação enviada há N dias, sem
  clique" é estruturalmente idêntico a `orcamento_sem_resposta`
  (dado confirmado, nunca heurístico). Não implementado nesta sessão
  (ver K) para não expandir `lib/oportunidades-clientes.ts` sem a coluna
  `clicado_em` existir de verdade — mas o desenho é imediato quando a
  migration rodar.
- Uma origem atribuída (D.3) que termina em venda paga (lifecycle
  `orcamentos`/`agendamentos` já existente) é "receita atribuída" — o
  numerador de `calcularROAS`. Isso significa que `orcamentos` precisará,
  no futuro, de uma FK opcional `origem_captacao_id` (proposta na seção
  H.2, não executada) para fechar CAMPANHA→LEAD→...→RECEITA COMPROVADA
  sem inventar uma segunda fonte de verdade de receita — a receita
  comprovada continua sendo exclusivamente `orcamento_pagamentos` (ver
  `docs/orcamento-venda-receita-v1-arquitetura.md`, seção 8).
- Diagnóstico de presença (D.4) é candidato natural a um item do "Índice
  OrganizaPro" (`lib/raio-x.ts`) — não tocado nesta sessão para não
  arriscar uma peça grande e já em produção sem poder testar em
  navegador real.

---

## E. Código efetivamente construído nesta sessão

| Arquivo | O que é | Testes |
|---|---|---|
| `lib/motor-reputacao.ts` | Estado honesto de solicitação de avaliação (enviado/clicado), geração/validação de código e link, guarda anti-spam, taxa de clique | 21 |
| `lib/atribuicao-origem.ts` | Captura/classificação de origem (UTM/gclid/fbclid/referrer), link rastreado no WhatsApp, extração de código, CAC/ROAS null-safe | ~24 |
| `lib/presenca-digital.ts` | Diagnóstico honesto de completude de presença (sem API Google) | 8 |
| `app/r/[codigo]/route.ts` | Redirect público idempotente para o link de avaliação, com rastreio de clique | validado por `next build` (rota real), lógica pura coberta pelos testes de `motor-reputacao.ts` |
| `docs/google-presenca-reputacao-ads-v1-arquitetura.md` | Este documento | — |
| `tests/motor-reputacao.test.mjs`, `tests/atribuicao-origem.test.mjs`, `tests/presenca-digital.test.mjs` | Suítes node:test contra o build real | 53 testes novos |
| `tests/README-TESTES.md` | Atualizado com os 3 novos módulos no comando de compilação | — |

Nenhum arquivo pré-existente foi alterado (diferente do bloco de
orçamento, que estendia `oportunidades-clientes.ts`/`nucleo-inteligente.ts`
— aqui, por decisão deliberada da seção D.2/D.3, tudo é aditivo e ainda
não está ligado ao caminho de dado real em produção).

---

## F. Dados reais utilizados

Todo tipo/função foi desenhado contra o schema **real, já auditado**:
`clinica_config` (`link_google`, `nota_google`, `num_avaliacoes`, `slug`,
`telefone`, `endereco`, `horario_funcionamento`, `seo_titulo`,
`seo_descricao` — confirmados em `app/configuracoes/page.tsx` e
`app/site/page.tsx`), `avaliacoes` (`id`, `clinica_id`, `agendamento_id`,
`paciente_nome`, `telefone`, `enviado_em`, `respondeu` — confirmados em
`app/api/cron/avaliacoes/route.ts` e `app/reputacao/page.tsx`), e a rota
pública `app/empresa/[slug]` (server component com `params` assíncrono,
padrão Next 16). Nenhum dado foi fabricado nem assumido sem essa
verificação prévia no código real.

---

## G. Integrações externas ainda necessárias (GATES — não implementados)

### G.1 Google Business Profile — OAuth + API real

**Bloqueio**: requer um app OAuth registrado no Google Cloud Console
(`client_id`/`client_secret`), escopo `business.manage` aprovado pelo
Google, e um usuário passando pela tela de consentimento. Nenhuma dessas
peças existe neste ambiente — **parado aqui, não improvisado**.

Contrato projetado (referência direta de B.3b, para quando o gate for
resolvido):

```ts
type GoogleBusinessConexao = {
  clinicaId: string;
  contaGoogleId: string;
  localizacaoId: string | null;
  escopo: string;               // deve incluir "business.manage"
  tokenAcessoCifrado: string;   // AES-256-GCM, AAD = clinica_id
  tokenRefreshCifrado: string;
  expiraEm: string;             // ISO
  conectadoEm: string;
  desconectadoEm: string | null;
};
```

Passos reais quando o gate for resolvido: registrar app no Google Cloud
Console → obter `client_id`/`client_secret` → implementar troca de
código por token (fluxo padrão OAuth2 authorization-code) → cifrar e
persistir tokens vinculados a `clinica_id` → só então ler nota/avaliações
reais da API. Nenhum desses passos foi executado nesta sessão.

### G.2 Google Ads — leitura de custo/conversão real

**Bloqueio**: requer conta de Google Ads vinculada, API de Google Ads
habilitada, `developer_token` aprovado. Contrato mínimo projetado:

```ts
type CustoCampanhaGoogleAds = {
  clinicaId: string;
  campanhaId: string;
  gclid: string | null;         // quando disponível, liga a uma OrigemCaptada real
  custoCentavos: number;        // só de fonte oficial — nunca estimado
  periodoInicio: string;
  periodoFim: string;
  importadoEm: string;
};
```

`calcularCAC`/`calcularROAS` (D.3) já aceitam este formato de custo — não
precisam de nenhuma mudança quando a integração real existir.

### G.3 Meta Ads — leitura de custo/conversão real

Mesmo bloqueio (Meta Business API, token de sistema, permissão de
`ads_read`). Mesmo contrato mínimo de `CustoCampanhaGoogleAds`, trocando
`gclid` por `fbclid`. **Não implementado.**

---

## H. Migrations preparadas — NÃO EXECUTADAS

Como no bloco de orçamento, propositalmente **não copiadas para
`supabase/migrations/`** — ficam só neste documento, para não serem
aplicadas automaticamente por nenhuma ferramenta que varra aquele
diretório. Requerem novo GO explícito.

### H.1 Reputação — rastreio de clique em `avaliacoes`

```sql
-- PROPOSTA — auditoria apenas, NÃO EXECUTAR sem GO explícito.
ALTER TABLE avaliacoes
  ADD COLUMN IF NOT EXISTS codigo_rastreio TEXT,
  ADD COLUMN IF NOT EXISTS link_destino    TEXT,
  ADD COLUMN IF NOT EXISTS clicado_em      TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS avaliacoes_codigo_rastreio_uidx
  ON avaliacoes (codigo_rastreio)
  WHERE codigo_rastreio IS NOT NULL;

-- respondeu: NÃO removida nesta migration (evita quebrar leitura existente
-- de app/reputacao/page.tsx antes do deploy do novo front); passa a ser
-- tratada como legada/não confiável na próxima revisão da UI (seção K).
```

**Impacto**: aditivo, três colunas nullable + índice único parcial.
Zero risco para dado existente. **Rollback**:
`ALTER TABLE avaliacoes DROP COLUMN codigo_rastreio, DROP COLUMN link_destino, DROP COLUMN clicado_em;`

### H.2 Atribuição de origem — nova tabela + FK opcional

```sql
-- PROPOSTA — auditoria apenas, NÃO EXECUTAR sem GO explícito.
CREATE TABLE IF NOT EXISTS origem_captacoes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id      UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  gclid           TEXT,
  fbclid          TEXT,
  referrer_host   TEXT,
  tipo_origem     TEXT NOT NULL CHECK (tipo_origem IN
                    ('google_ads','meta_ads','campanha_utm','busca_organica','referencia','direto')),
  capturado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  convertido_em   TIMESTAMPTZ  -- setado quando a origem vira um lead/orçamento real; nunca inferido
);

CREATE UNIQUE INDEX IF NOT EXISTS origem_captacoes_codigo_uidx
  ON origem_captacoes (clinica_id, codigo);

CREATE INDEX IF NOT EXISTS origem_captacoes_clinica_tipo_idx
  ON origem_captacoes (clinica_id, tipo_origem);

ALTER TABLE origem_captacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "origem_select" ON origem_captacoes FOR SELECT USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "origem_insert" ON origem_captacoes FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
-- Sem policy de UPDATE/DELETE: captura de origem é fato histórico
-- imutável (fail-closed nativo do Postgres — ausência de policy nega a
-- operação, mesmo padrão já usado em orcamentos, seção 7).

-- FK opcional para fechar CAMPANHA → ... → RECEITA (não altera nenhuma
-- linha existente; nullable; só usada quando uma venda for de fato
-- atribuível a uma origem capturada real):
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS origem_captacao_id UUID REFERENCES origem_captacoes(id) ON DELETE SET NULL;
```

**Impacto**: aditivo. `origem_captacoes` é tabela nova; a coluna em
`orcamentos` é nullable e não afeta nenhuma linha existente (nota: como
`orcamentos` em si também ainda não foi criada — ver
`docs/orcamento-venda-receita-v1-arquitetura.md` seção 11 — esta parte da
migration só se aplica depois daquela). **Rollback**:
`DROP TABLE IF EXISTS origem_captacoes; ALTER TABLE orcamentos DROP COLUMN IF EXISTS origem_captacao_id;`

### H.3 RLS fail-closed — mesmo contrato de aplicação já estabelecido

Nenhuma rota nova de escrita autenticada foi criada nesta sessão (o
redirect `/r/[codigo]` é público por natureza, sem `clinica_id` de
entrada — não há tenant a isolar ali, só um código opaco). Quando uma
rota `/api/origem-captacoes` ou equivalente for criada, ela segue
**exatamente** o contrato já fechado em
`docs/orcamento-venda-receita-v1-arquitetura.md` seção 7.1: nunca confiar
em `clinica_id` do corpo/query, `auth.uid()` sempre do bearer token via
`autorizarUsuarioNaClinica`, `.eq('clinica_id', ...)` explícito em toda
query como defesa em profundidade.

---

## I. Testes / gates de validação executados

- **109/109 testes** (`node --test`) — 59 já existentes (Smart
  Commerce/orçamento, intactos) + 50 novos (21 `motor-reputacao` + 21
  `atribuicao-origem` + 8 `presenca-digital` — ver contagem exata na
  saída do runner).
- `npx tsc --noEmit` — limpo, projeto inteiro.
- `npx eslint` nos 4 arquivos novos (3 libs + rota) — limpo.
- `npx next build` — build de produção completo, **rota `/r/[codigo]`
  registrada corretamente** como dinâmica (`ƒ /r/[codigo]`), nenhuma
  rota existente quebrada.

---

## J. Diff / status

Ver saída do comando ao final da entrega desta sessão (`git status --short`,
`git diff --stat`, `git diff --check`). Resumo: 3 arquivos novos em `lib/`,
1 rota nova em `app/r/[codigo]/`, 3 arquivos novos em `tests/`, 1 doc novo,
1 doc de testes atualizado. Nenhum arquivo pré-existente de produção foi
modificado.

---

## K. Próximo gate objetivo

Nesta ordem, cada um desbloqueia o seguinte:

1. **Auditoria do REI sobre este documento e este código** (gate atual).
2. **Aprovar e executar a migration H.1** (`avaliacoes`: `codigo_rastreio`,
   `link_destino`, `clicado_em`) — depois disso, e só depois, ligar
   `app/api/cron/avaliacoes/route.ts` para gerar o código/link rastreado
   no envio, e `app/reputacao/page.tsx` para mostrar "clicou" em vez de
   "respondeu" (deploy atômico — código novo + migration juntos, nunca
   um sem o outro, para não quebrar o cron em produção).
3. **Aprovar e executar a migration H.2** (`origem_captacoes` +
   `orcamentos.origem_captacao_id`) — depois, ligar
   `app/empresa/[slug]/page.tsx` (captura de `searchParams`) e o link do
   WhatsApp no site público (`construirLinkComRastreio`), com teste real
   em navegador antes de reportar como concluído (exigência padrão para
   mudança de UI/frontend).
4. **Gate externo G.1** (Google Business Profile OAuth): só quando o REI
   fornecer um app OAuth real no Google Cloud Console. Sem isso, o
   diagnóstico honesto de D.4 continua sendo a única verdade sobre
   presença no Google.
5. **Gates externos G.2/G.3** (Google Ads / Meta Ads): só quando o REI
   fornecer as credenciais oficiais correspondentes.
