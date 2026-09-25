// Regressão da missão 2026-09-25 (Google Presença / OAuth).
//
// Sintoma em produção: o callback voltou para /google-presenca?status=indisponivel
// e o log da função trouxe apenas `[GBP OAuth] { codigo: 'INDISPONIVEL', httpGoogle: 429 }`.
// Faltava endpoint, motivo e quota — não era possível PROVAR a causa (quota 0 =
// acesso à GBP API ainda não concedido ao projeto, limite de taxa real, API
// ausente/desativada ou endpoint errado).
//
// Estes testes provam que a recusa passa a ser verificável pelo corpo da resposta
// do Google (endpoint, status, razão e quota), sem vazar token/código/client
// secret e sem mudar o contrato HTTP das rotas de produto.
//
// node --test tests/google-business-profile-429-diagnostico.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { fixture, request, Request } from "./helpers/gbp-fixture.mjs";

const oauth = f => f.load("lib/google-business-profile-oauth.ts");
const handlers = f => f.load("lib/google-business-profile-handlers.ts");
const errors = f => f.load("lib/google-business-profile-errors.ts");
const cookieName = "google_business_oauth_session";

// Corpo real de quota zero do Google APIs (429 + RESOURCE_EXHAUSTED + ErrorInfo
// com quota_limit_value "0"), com um token falso embutido para provar a redação.
const corpoQuotaZero = () => ({ error: { code: 429, status: "RESOURCE_EXHAUSTED",
  message: "Quota exceeded for quota metric 'Requests' and limit 'Requests per minute' of service "
    + "'mybusinessaccountmanagement.googleapis.com' for consumer 'project_number:509712' access_token=ya29.fixture-token",
  details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "RATE_LIMIT_EXCEEDED", domain: "googleapis.com",
    metadata: { service: "mybusinessaccountmanagement.googleapis.com", quota_metric: "mybusinessaccountmanagement.googleapis.com/requests",
      quota_limit: "Requests per minute", quota_limit_value: "0", consumer: "projects/509712" } }] } });

async function start(f) {
  return oauth(f).iniciarGoogle(request({ clinica_id: "tenant-a" }));
}
function callback(session) {
  const state = new URL(session.body.url).searchParams.get("state");
  return new Request("https://fixture.test/api/google-business-profile/oauth/callback?code=fixture-code&state=" + encodeURIComponent(state),
    { cookies: { [cookieName]: session.cookies.values.get(cookieName).value } });
}
// Só o endpoint de Account Management responde 429; token/locations seguem default.
const recusa429 = () => ({ fetch: ({ url }) => url.includes("/v1/accounts") ? { http: 429, body: corpoQuotaZero() } : undefined });

test("callback OAuth 429: prova endpoint, status, razão e quota (0 = acesso GBP não concedido) sem vazar segredo", async () => {
  const f = fixture(recusa429());
  const session = await start(f);
  const r = await oauth(f).concluirGoogle(callback(session));

  assert.equal(new URL(r.location).searchParams.get("status"), "indisponivel");
  assert.equal(f.saved.length, 0, "429 nunca grava conexão");

  const log = f.logs.find(l => l[0] === "[GBP OAuth]");
  assert.ok(log, "callback precisa registrar o diagnóstico");
  assert.equal(log[1].codigo, "INDISPONIVEL");
  assert.equal(log[1].httpGoogle, 429);
  assert.equal(log[1].causa, "ACESSO_GBP_NAO_CONCEDIDO");
  assert.equal(log[1].diagnostico.servico, "mybusinessaccountmanagement.googleapis.com");
  assert.equal(log[1].diagnostico.statusGoogle, "RESOURCE_EXHAUSTED");
  assert.equal(log[1].diagnostico.razao, "RATE_LIMIT_EXCEEDED");
  assert.equal(log[1].diagnostico.quota.valor, "0");
  assert.equal(log[1].diagnostico.quota.metrica, "mybusinessaccountmanagement.googleapis.com/requests");

  const serializado = JSON.stringify(f.logs);
  assert.ok(!serializado.includes("ya29."), "access token nunca aparece no log");
  assert.ok(log[1].diagnostico.mensagem.includes("[redigido]"), "mensagem do Google só entra redigida");
  assert.ok(!serializado.includes("fixture-code"), "código de autorização nunca aparece no log");
  assert.ok(!serializado.includes("fixture-client-secret"));
  assert.ok(!r.location.includes("ya29"));
});

test("429 prova a causa mesmo onde o contrato do produto não expõe mensagem externa", async () => {
  const corpo = { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "fixture-sensitive",
    details: [{ reason: "RATE_LIMIT_EXCEEDED", metadata: { quota_limit_value: "0" } }] } };
  const f = fixture({ fetch: ({ url }) => url.includes("/v1/accounts") ? { http: 429, body: corpo } : undefined });
  const r = await handlers(f).lerGoogle(request(), "locations");

  assert.equal(r.status, 503);
  assert.equal(r.body.estado, "indisponivel");
  assert.equal(r.body.codigo, "INDISPONIVEL");
  assert.ok(!JSON.stringify(r.body).includes("fixture-sensitive"), "resposta HTTP segue sem texto do Google");

  const log = f.logs.find(l => l[0] === "[GBP]");
  assert.equal(log[1].httpGoogle, 429);
  assert.equal(log[1].servico, "mybusinessaccountmanagement.googleapis.com");
  assert.equal(log[1].causa, "ACESSO_GBP_NAO_CONCEDIDO");
  assert.equal(log[1].quota.valor, "0");
  assert.equal("mensagem" in log[1], false, "log do produto não carrega texto externo livre");
  assert.ok(!JSON.stringify(f.logs).includes("fixture-sensitive"));
});

test("diagnóstico: quota 0 nunca é confundido com limite de taxa e 429 sem quota nunca vira acesso negado", async () => {
  const h = errors(fixture());

  const d = h.diagnosticoGoogle(corpoQuotaZero(), "mybusinessaccountmanagement.googleapis.com");
  assert.equal(h.classificarDiagnosticoGoogle(d), "ACESSO_GBP_NAO_CONCEDIDO");
  const seguro = h.diagnosticoSeguro(d);
  assert.equal(seguro.causa, "ACESSO_GBP_NAO_CONCEDIDO");
  assert.equal("mensagem" in seguro, false);

  // Mesmo motivo, quota real > 0 → limite de taxa.
  assert.equal(h.classificarDiagnosticoGoogle(h.diagnosticoGoogle({ error: { status: "RESOURCE_EXHAUSTED",
    details: [{ reason: "RATE_LIMIT_EXCEEDED", metadata: { quota_limit_value: "300" } }] } })), "LIMITE_DE_TAXA");
  // 429 sem quota informada: limitação do Google, mas NUNCA afirmar "acesso não concedido".
  assert.equal(h.classificarDiagnosticoGoogle(h.diagnosticoGoogle({ error: { code: 429 } }, "mybusinessaccountmanagement.googleapis.com")), null);
  assert.equal(h.classificarDiagnosticoGoogle(h.diagnosticoGoogle({ error: { status: "PERMISSION_DENIED" } })), "PERMISSAO");
  assert.equal(h.classificarDiagnosticoGoogle(h.diagnosticoGoogle({ error: { errors: [{ reason: "SERVICE_DISABLED" }] } })), "API_AUSENTE_OU_DESATIVADA");
  assert.equal(h.diagnosticoGoogle(null), null);
  assert.equal(h.diagnosticoGoogle(null, "oauth2.googleapis.com").servico, "oauth2.googleapis.com");
  assert.equal(h.classificarDiagnosticoGoogle(null), null);
});

test("403 do Google: mensagem que ecoa client_secret é redigida antes do log", async () => {
  const f = fixture({ fetch: ({ url }) => url.includes("/v1/accounts") ? { http: 403,
    body: { error: { status: "PERMISSION_DENIED", message: "Caller lacks permission client_secret=fixture-client-secret" } } } : undefined });
  const session = await start(f);
  await oauth(f).concluirGoogle(callback(session));

  const log = f.logs.find(l => l[0] === "[GBP OAuth]");
  assert.equal(log[1].codigo, "GOOGLE");
  assert.equal(log[1].httpGoogle, 403);
  assert.equal(log[1].causa, "PERMISSAO");
  assert.ok(log[1].diagnostico.mensagem.includes("[redigido]"));
  assert.ok(!JSON.stringify(f.logs).includes("fixture-client-secret"));
});
