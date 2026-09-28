# Meta Ads V1 Enxuto — pesquisa oficial, escopo e entrega

## 1. Pesquisa OFICIAL (consulta em 2026-09-28)

Páginas consultadas (Meta for Developers / Marketing API):

| Página | URL |
|---|---|
| Authorization | https://developers.facebook.com/docs/marketing-api/get-started/authorization/ |
| Authentication | https://developers.facebook.com/docs/marketing-api/get-started/authentication/ |
| Permissions Reference | https://developers.facebook.com/docs/permissions/ |
| Access Levels | https://developers.facebook.com/docs/graph-api/overview/access-levels/ |
| Ads Insights API | https://developers.facebook.com/docs/marketing-api/insights |
| Get Started (Marketing API) | https://developers.facebook.com/docs/marketing-api/get-started |

Fatos confirmados:

- **Versão:** Graph API **v25.0** (versão dos exemplos oficiais de authorization/insights).
- **Leitura de relatórios/métricas** (insights: spend, impressions, reach, clicks, ctr; campaigns: status) exige a permissão **`ads_read`**.
- **Criação/gestão** de campanhas exige **`ads_management`** + App Review + Marketing API Access Tier (antes "Advanced Access", hoje "Full Access": App Review + ≥500 chamadas/15 dias com erro <15%).
- **Standard/Limited Access** (padrão) só permite solicitar permissões a usuários **com papel no app**. Conectar contas de **clientes** (SaaS) exige **Advanced Access = App Review + Business Verification** (obrigatória desde 01/02/2023), mais Data Use Checkup anual.
- **Tokens:** fluxo server-side devolve token persistente; troca opcional por long-lived (`grant_type=fb_exchange_token`, ~60 dias); armazenar cifrado no servidor, prever re-autorização (revogação/senha/não uso por 90 dias). System user token não expira (uso server-to-server avançado).
- **Dialog:** `https://www.facebook.com/v25.0/dialog/oauth?...&scope=ads_management|ads_read` — pedir somente o necessário.

## 2. O que o OrganizaPro já tinha (reusado, nada duplicado)

- Captura e classificação de origem (`lib/atribuicao-origem.ts`: UTM/GCLID/FBCLID, classe `meta_ads`), tabela `origem_captacoes` com `identificadores_ads`.
- Relatório/API/tela canônicos de atribuição (`/atribuicao`, `lib/atribuicao-*`, `eventos_dominio`/`atribuicao.vinculo`).
- Contrato `ConexaoAds`/`CONEXOES_ADS_V1` (`lib/ads-contratos.ts`) — vocabulário de estados reusado.
- Padrão OAuth completo do Google Presença (state assinado, cookie HttpOnly cifrado AES-256-GCM, revalidação de tenant) — **reusado por import puro** em `lib/meta-ads.ts`, sem alterar o Google Presença.
- Gate de autorização `autorizarUsuarioNaClinica` + shell AdminShell.

## 3. Escopo do V1 (e o que ficou DEFORA)

Dentro:

1. Seção "Meta Ads" em `/atribuicao` (sem nova nav).
2. Estados honestos: `nao_configurada` (env ausente / sem conexão), `conectada`, `revogada`, `pendente_homologacao`; schema pendente → 503 indisponível.
3. Conexão OAuth real (server-side) com escopo mínimo `ads_read` — funciona para usuários com papel no app; para clientes depende de App Review (declarado na UI).
4. Leitura de campanhas + insights (`last_30d`): status, gasto, impressões, alcance, cliques, CTR.
5. Junção com atribuição **somente por `campaign_id` exato** (captura `identificadores_ads.campaign_id` em plataforma `meta_ads`) → capturas/leads/oportunidades/conversões/receita; sem correspondência = "—".

Fora (deliberado):

- Criação/edição de campanhas, ad sets, criativos (`ads_management` + App Review).
- Leads de formulário Meta (`leads_retrieval`), Pixel/CAPI/Conversions API, Instagram.
- Cálculo de CAC/ROAS na agregação legada (permanece "—"; custo não entra em `agregarAtribuicao`).
- Google Ads (contrato próprio já existente; intocado).

## 4. Arquivos

- `supabase/migrations/20260928000002_meta_ads_conexoes_v1.sql` (PREPARADA, NÃO EXECUTADA)
- `lib/meta-ads.ts`, `lib/meta-ads-api.ts`, `lib/meta-ads-metricas.ts`, `lib/meta-ads-dados.ts`, `lib/meta-ads-oauth.ts`
- `app/api/meta-ads/route.ts`, `app/api/meta-ads/oauth/start/route.ts`, `app/api/meta-ads/oauth/callback/route.ts`
- `app/atribuicao/MetaAdsSecao.tsx` (+ wiring em `app/atribuicao/page.tsx`)
- `tests/meta-ads-v1.test.mjs` (+ stub do filho em `tests/ads-atribuicao-ui.test.mjs`)

## 5. Segurança

- Token: cifra AES-256-GCM no servidor; nunca no browser, nunca em log, nunca commitado; resposta da API não contém `access_token` nem cifra.
- Multi-tenant: `clinica_id` derivado da sessão via `autorizarUsuarioNaClinica`; tabela `unique` por tenant com RLS e `revoke all` para `public/anon/authenticated` (somente service_role).
- OAuth: state assinado com TTL + cookie HttpOnly cifrado + revalidação do bearer no retorno; Origin checado no start; status de retorno em enum fixo.

## 6. Ações externas pendentes (para Marcos — executadas FORA desta missão)

1. Criar app Meta (tipo Business) e habilitar o produto **Marketing API**.
2. Configurar Facebook Login com permissão `ads_read` (Standard Access) e **WhatsApp/redirect** — adicionar a redirect URI de produção em Valid Redirect URIs.
3. Exportar `META_APP_ID`, `META_APP_SECRET`, `META_TOKEN_KEY` (32+ bytes) para o ambiente (Vercel/local `.env.local`).
4. Aplicar a migration `20260928000002_meta_ads_conexoes_v1.sql` no Supabase (manual).
5. Para conectar contas de CLIENTES: submeter App Review para `ads_read` (Advanced Access) + Business Verification — dependência oficial da Meta, não do código.
