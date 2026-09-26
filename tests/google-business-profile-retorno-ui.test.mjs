// Regressão da missão 2026-09-26 (Google Presença / última milha).
//
// O log do callback já distinguia a quota 0 (acesso à GBP API ainda não
// concedido ao projeto), mas a tela mostrava a mesma frase genérica para
// qualquer falha — o dono do negócio não tinha como saber que a pendência é
// do Google, e não do login ou da conta dele.
//
// Estes testes provam que o callback anexa `causa=acesso_google_pendente`
// SOMENTE quando a quota é 0, que o contrato `status=` segue inalterado, que
// nenhum texto do Google/segredo vai para a URL e que a página traduz cada
// retorno em uma mensagem humana própria.
//
// node --test tests/google-business-profile-retorno-ui.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fixture, request, Request } from "./helpers/gbp-fixture.mjs";

const oauth = f => f.load("lib/google-business-profile-oauth.ts");
const cookieName = "google_business_oauth_session";
const pagina = fs.readFileSync(new URL("../app/google-presenca/page.tsx", import.meta.url), "utf8");

const corpo429 = quota => ({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded access_token=ya29.fixture-token",
  details: [{ reason: "RATE_LIMIT_EXCEEDED", metadata: { quota_limit_value: quota } }] } });

async function retorno(fetch) {
  const f = fixture({ fetch });
  const session = await oauth(f).iniciarGoogle(request({ clinica_id: "tenant-a" }));
  const state = new URL(session.body.url).searchParams.get("state");
  const r = await oauth(f).concluirGoogle(new Request("https://fixture.test/api/google-business-profile/oauth/callback?code=fixture-code&state="
    + encodeURIComponent(state), { cookies: { [cookieName]: session.cookies.values.get(cookieName).value } }));
  return { f, url: new URL(r.location) };
}

test("quota 0 no callback: status=indisponivel (contrato inalterado) + causa=acesso_google_pendente", async () => {
  const { f, url } = await retorno(({ url }) => url.includes("/v1/accounts") ? { http: 429, body: corpo429("0") } : undefined);
  assert.equal(url.pathname, "/google-presenca");
  assert.equal(url.searchParams.get("status"), "indisponivel");
  assert.equal(url.searchParams.get("causa"), "acesso_google_pendente");
  assert.equal(f.saved.length, 0, "falta de liberação nunca grava conexão");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["causa", "status"], "URL não carrega nenhum outro dado");
  assert.ok(!url.href.includes("ya29") && !url.href.includes("fixture-code") && !url.href.includes("Quota"), "sem texto do Google nem segredo na URL");
});

test("429 com quota não zero (limite de taxa real) NÃO é apresentado como falta de liberação", async () => {
  const { url } = await retorno(({ url }) => url.includes("/v1/accounts") ? { http: 429, body: corpo429("300") } : undefined);
  assert.equal(url.searchParams.get("status"), "indisponivel");
  assert.equal(url.searchParams.get("causa"), null);
});

test("429 sem corpo/quota e falha 5xx: sem causa (nunca por heurística de 429)", async () => {
  // 5xx é resultado incerto por desenho (status=pendente); em nenhum dos casos há causa.
  for (const [resposta, status] of [[{ http: 429, body: {} }, "indisponivel"], [{ http: 503, body: {} }, "pendente"]]) {
    const { url } = await retorno(({ url }) => url.includes("/v1/accounts") ? resposta : undefined);
    assert.equal(url.searchParams.get("status"), status);
    assert.equal(url.searchParams.get("causa"), null);
  }
});

test("conexão bem-sucedida segue em status=connected, sem causa", async () => {
  const { f, url } = await retorno(() => undefined);
  assert.equal(url.searchParams.get("status"), "connected");
  assert.equal(url.searchParams.get("causa"), null);
  assert.equal(f.saved.length, 1);
});

test("página: cada retorno tem mensagem humana própria; pendência do Google nunca é tratada como erro do usuário", () => {
  assert.match(pagina, /function mensagemRetornoGoogle\(status: string, causa: string \| null\): string/);
  assert.match(pagina, /\.get\("causa"\)/);
  assert.match(pagina, /\{mensagemRetornoGoogle\(resultado, causaRetorno\)\}/);
  assert.match(pagina, /causa === "acesso_google_pendente"\) return "[^"]*o Google ainda não liberou o acesso do OrganizaPro[^"]*Não é um problema da sua conta nem do seu login[^"]*"/);
  for (const status of ["denied", "indisponivel", "sem_local", "oauth"]) assert.ok(pagina.includes(`status === "${status}"`), `mensagem para ${status}`);
  assert.ok(pagina.includes('return "Não foi possível concluir a conexão Google.";'), "demais códigos mantêm a mensagem genérica");
  assert.doesNotMatch(pagina, /mensagemRetornoGoogle[^\n]*(stack|diagnostico|httpGoogle)/, "tela nunca exibe diagnóstico técnico");
});
