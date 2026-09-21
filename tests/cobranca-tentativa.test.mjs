// Guarda estática do Cobrador Digital V1 (POST /api/cobrancas/[id]/tentativa)
// — mesmo papel de tests/pedidos-tenant.test.mjs: prova por leitura do
// próprio código-fonte (nunca por execução contra um banco real).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const normalizar = (s) => s.replace(/\r\n/g, "\n");
const rota = normalizar(readFileSync(path.join(root, "app/api/cobrancas/[id]/tentativa/route.ts"), "utf8"));
const dashboard = normalizar(readFileSync(path.join(root, "app/cobrancas/page.tsx"), "utf8"));

test("POST /api/cobrancas/[id]/tentativa: autoriza antes de qualquer leitura da cobrança", () => {
  const idxAuth = rota.indexOf("autorizarUsuarioNaClinica(req, clinica_id)");
  const idxBusca = rota.indexOf('.from("cobrancas")');
  assert.ok(idxAuth > -1 && idxBusca > -1);
  assert.ok(idxAuth < idxBusca, "autorização deveria acontecer antes da busca da cobrança");
});

test("POST /api/cobrancas/[id]/tentativa: busca da cobrança é escopada por id E clinica_id (nunca só por id)", () => {
  const idxBusca = rota.indexOf('.from("cobrancas")');
  const trecho = rota.slice(idxBusca, idxBusca + 200);
  assert.match(trecho, /\.eq\("id", id\)/);
  assert.match(trecho, /\.eq\("clinica_id", clinica_id\)/);
});

test("POST /api/cobrancas/[id]/tentativa: idempotência via eventos_dominio inclui a data — no máximo uma tentativa por dia por cobrança", () => {
  assert.match(rota, /chaveIdempotencia = `\$\{id\}:cobranca\.tentativa:\$\{hoje\}`/);
  assert.match(rota, /chave_idempotencia: chaveIdempotencia/);
  assert.match(rota, /\.eq\("clinica_id", clinica_id\)\s*\n\s*\.eq\("chave_idempotencia", chaveIdempotencia\)/);
});

test("POST /api/cobrancas/[id]/tentativa: elegibilidade é fail-closed — decidida pelo motor real, nunca inline na rota", () => {
  assert.match(rota, /elegivelParaTentativaCobranca\(cobranca, hoje, !!tentativaExistente\)/);
  assert.match(rota, /if \(!elegibilidade\.elegivel\)/);
});

test("POST /api/cobrancas/[id]/tentativa: NUNCA chama o adaptador de envio real (Z-API/WhatsApp) — modo estritamente preparatório", () => {
  // A string "/api/whatsapp" pode aparecer só em COMENTÁRIO explicando o
  // gate futuro — a prova real é que não existe nenhum fetch/chamada real.
  assert.doesNotMatch(rota, /fetch\(.*whatsapp/i);
  assert.doesNotMatch(rota, /z-api\.io/i);
  assert.doesNotMatch(rota, /send-text/);
  assert.match(rota, /modo: "preparatorio"/);
  assert.match(rota, /resultado: null/); // nunca um resultado de envio fabricado
});

test("POST /api/cobrancas/[id]/tentativa: mensagem/valor/telefone gravados no evento vêm da cobrança real, nunca do body da requisição", () => {
  const idxInsert = rota.indexOf('tipo: "cobranca.tentativa"');
  const trecho = rota.slice(idxInsert, idxInsert + 400);
  assert.match(trecho, /telefone: cobranca\.paciente_telefone/);
  assert.match(trecho, /valor: cobranca\.valor/);
  assert.match(trecho, /vencimento: cobranca\.vencimento/);
  assert.match(trecho, /mensagem: mensagem\.texto/);
});

test("dashboard: botão 'Preparar cobrança' fica desabilitado quando não há telefone (fail-closed também na UI)", () => {
  const idxOnClick = dashboard.indexOf("onClick={() => prepararTentativa(c)}");
  assert.ok(idxOnClick > -1, "botão de preparar tentativa não encontrado");
  const trecho = dashboard.slice(Math.max(0, idxOnClick - 200), idxOnClick + 600);
  assert.match(trecho, /disabled=\{!c\.paciente_telefone \|\| preparando === c\.id\}/);
  assert.match(trecho, /Preparar cobrança/);
});
