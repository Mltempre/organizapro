// Guarda estática da CONVERGÊNCIA (Google Presença + Reputação +
// Atribuição de Origem) — prova, a cada execução, que:
//   1. app/r/[codigo] usa o schema REAL (codigo/clicado_em/clinica_config.
//      link_google), nunca as colunas fictícias (codigo_rastreio/
//      link_destino) da versão isolada original;
//   2. o cron de avaliações agora gera e persiste o código de rastreio;
//   3. /reputacao nunca afirma "Respondeu" como fato confirmado;
//   4. a Fase D (webhook do chatbot) foi portada sem trazer o classificador
//      de tópicos experimental (lib/chatbot-topico.ts) do Smart Commerce
//      incompatível;
//   5. o site público propaga codigoRastreio ponta a ponta;
//   6. a migration de origem_captacoes mantém o hardening de segurança já
//      auditado (nenhuma policy de escrita para anon/authenticated).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const normalizar = (s) => s.replace(/\r\n/g, "\n");
const ler = (p) => normalizar(readFileSync(path.join(root, p), "utf8"));
// Remove comentários de linha (`// ...`) antes das guardas de "nunca usa
// coluna fictícia X" — os próprios comentários deste arquivo citam
// `codigo_rastreio`/`link_destino` entre crases para explicar por que
// foram abandonados (ver cabeçalho de app/r/[codigo]/route.ts); sem isso,
// a guarda falharia contra a própria documentação que ela deveria permitir.
const semComentariosDeLinha = (s) => s.replace(/\/\/.*$/gm, "");

const rotaR = ler("app/r/[codigo]/route.ts");
const cron = ler("app/api/cron/avaliacoes/route.ts");
const reputacaoPage = ler("app/reputacao/page.tsx");
const chatbotRoute = ler("app/api/chatbot/message/route.ts");
const siteClient = ler("app/empresa/[slug]/SiteEmpresaClient.tsx");
const servicosComp = ler("app/empresa/[slug]/_components/Servicos.tsx");
const pageServer = ler("app/empresa/[slug]/page.tsx");
const migration = ler("supabase/migrations/20260920000002_origem_captacoes_atribuicao_v1.sql");

test("app/r/[codigo]: consulta avaliacoes.codigo (real), nunca codigo_rastreio (fictício)", () => {
  assert.match(rotaR, /\.eq\("codigo", codigo\)/);
  assert.doesNotMatch(semComentariosDeLinha(rotaR), /codigo_rastreio/);
});

test("app/r/[codigo]: resolve o destino via clinica_config.link_google, nunca uma coluna link_destino inexistente", () => {
  assert.match(rotaR, /\.from\("clinica_config"\)\s*\.select\("link_google"\)\s*\.eq\("clinica_id", solicitacao\.clinica_id\)/);
  assert.doesNotMatch(semComentariosDeLinha(rotaR), /link_destino/);
});

test("app/r/[codigo]: grava clicado_em de forma idempotente (só no primeiro clique)", () => {
  assert.match(rotaR, /podeRegistrarClique\(\{ clicadoEm: solicitacao\.clicado_em \}\)/);
  assert.match(rotaR, /\.is\("clicado_em", null\)/);
});

test("cron/avaliacoes: gera um código de rastreio real e envia o link /r/[codigo], nunca o link direto do Google", () => {
  assert.match(cron, /gerarCodigoRastreio\(\)/);
  assert.match(cron, /`\$\{baseUrl\}\/r\/\$\{codigo\}`/);
  assert.match(cron, /codigo,\s*\n\s*\}\);/);
});

test("/reputacao: nunca afirma 'Respondeu' como fato confirmado — usa rotuloRespondeu", () => {
  assert.match(reputacaoPage, /rotuloRespondeu\(a\.respondeu\)/);
  assert.doesNotMatch(reputacaoPage, /'✅ Respondeu'/);
});

test("/reputacao: painel de Presença Digital usa o motor real (calcularPresencaDigital), nunca inventa completude", () => {
  assert.match(reputacaoPage, /calcularPresencaDigital\(\{/);
  assert.match(reputacaoPage, /from\('clinica_config'\)/);
});

test("chatbot/message: Fase D (vínculo de origem) portada sem trazer o classificador de tópicos experimental", () => {
  assert.match(chatbotRoute, /vincularOrigemSeReferenciada\(clinica_id, telefone, mensagem\)/);
  assert.match(chatbotRoute, /extrairCodigoRastreio\(mensagem\)/);
  // Nunca importa o motor experimental do Smart Commerce incompatível.
  assert.doesNotMatch(chatbotRoute, /chatbot-topico/);
});

test("chatbot/message: Fase D nunca bloqueia o fluxo normal do chatbot (sempre .catch, nunca lança)", () => {
  const idx = chatbotRoute.indexOf("vincularOrigemSeReferenciada(clinica_id, telefone, mensagem)");
  const trecho = chatbotRoute.slice(idx, idx + 120);
  assert.match(trecho, /\.catch\(/);
});

test("Site público: codigoRastreio propaga page.tsx -> SiteEmpresaClient -> Servicos, ponta a ponta", () => {
  assert.match(pageServer, /codigoRastreio\s*=\s*resumo\?\.clinica_id/);
  assert.match(pageServer, /<SiteEmpresaClient slug=\{slug\} codigoRastreio=\{codigoRastreio\} \/>/);
  assert.match(siteClient, /codigoRastreio \}: \{ slug: string; codigoRastreio\?: string \}/);
  assert.match(siteClient, /codigoRastreio=\{codigoRastreio\}/);
  assert.match(servicosComp, /construirLinkComRastreio\(link, codigoRastreio\)/);
});

test("Site público: origem só é gravada via service_role (nunca client anônimo)", () => {
  assert.match(pageServer, /persistirOrigemCaptada\(supabaseServiceRole,/);
  assert.match(pageServer, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("migration origem_captacoes: nenhuma policy de escrita para anon/authenticated (hardening Fase 1.1 preservado)", () => {
  assert.doesNotMatch(migration, /for insert/i);
  assert.doesNotMatch(migration, /for update/i);
  assert.doesNotMatch(migration, /for delete/i);
  assert.match(migration, /for select\s*\n\s*to authenticated/i);
  assert.match(migration, /revoke all on public\.origem_captacoes from anon, authenticated/);
});

test("migration origem_captacoes: classificacao é NOT NULL com CHECK fechado nos 6 valores reais de TipoOrigem", () => {
  assert.match(migration, /classificacao\s+text not null check \(\s*classificacao in \('google_ads','meta_ads','campanha_utm','busca_organica','referencia','direto'\)/);
});
