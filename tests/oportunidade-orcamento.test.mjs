// Última milha: Oportunidade → Orçamento. Prova a passagem entre os dois
// contratos canônicos já existentes (lib/oportunidades-demanda.ts,
// POST /api/orcamentos) sem reconstruir nenhum dos dois motores.
//
// Parte pura (elegibilidade/anti-duplicação): roda direto contra o TS via
// node --test (sem build dir — mesmo padrão de tests/oportunidades-
// demanda.test.mjs, que já importa lib/oportunidades-demanda.ts com
// extensão .ts explícita).
// Parte de wiring (contrato da rota nova): guarda estática por leitura do
// arquivo — mesmo padrão de tests/tratamentos-cobrancas-tenant.test.mjs e
// tests/presenca-reputacao-atribuicao-wiring.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { oportunidadeElegivelParaOrcamento } from "../lib/oportunidades-demanda.ts";

const rota = fs.readFileSync(new URL("../app/api/oportunidades/[id]/gerar-orcamento/route.ts", import.meta.url), "utf8");
const rotaOrcamentos = fs.readFileSync(new URL("../app/api/orcamentos/route.ts", import.meta.url), "utf8");

// ── Elegibilidade / anti-duplicação (pura) ──────────────────────────────

test("oportunidadeElegivelParaOrcamento: true para status aberto sem orçamento vinculado", () => {
  assert.equal(oportunidadeElegivelParaOrcamento({ status: "sinalizada", orcamento_vinculado_id: null }), true);
  assert.equal(oportunidadeElegivelParaOrcamento({ status: "em_contato", orcamento_vinculado_id: null }), true);
  assert.equal(oportunidadeElegivelParaOrcamento({ status: "agendada", orcamento_vinculado_id: null }), true);
  assert.equal(oportunidadeElegivelParaOrcamento({ status: "atendida", orcamento_vinculado_id: null }), true);
});

test("oportunidadeElegivelParaOrcamento: false para qualquer status terminal, mesmo sem vínculo", () => {
  assert.equal(oportunidadeElegivelParaOrcamento({ status: "convertida", orcamento_vinculado_id: null }), false);
  assert.equal(oportunidadeElegivelParaOrcamento({ status: "perdida", orcamento_vinculado_id: null }), false);
  assert.equal(oportunidadeElegivelParaOrcamento({ status: "expirada", orcamento_vinculado_id: null }), false);
});

test("oportunidadeElegivelParaOrcamento: false quando já há orcamento_vinculado_id, mesmo em status aberto (nunca duplica)", () => {
  assert.equal(oportunidadeElegivelParaOrcamento({ status: "sinalizada", orcamento_vinculado_id: "algum-uuid" }), false);
  assert.equal(oportunidadeElegivelParaOrcamento({ status: "atendida", orcamento_vinculado_id: "algum-uuid" }), false);
});

// ── Contrato da rota /gerar-orcamento (wiring estático) ─────────────────

test("gerar-orcamento: clinica_id nunca vem do body — só do vínculo real do usuário autenticado", () => {
  assert.doesNotMatch(rota, /clinica_id\?:/);
  assert.match(rota, /autorizarUsuarioNaClinica/);
  assert.match(rota, /clinica_usuarios/);
});

test("gerar-orcamento: toda consulta a oportunidades_demanda é filtrada por clinica_id", () => {
  assert.match(rota, /\.from\("oportunidades_demanda"\)\s*\.select\([^)]*\)\s*\.eq\("id", id\)\s*\.eq\("clinica_id", auth\.clinicaId\)/);
});

test("gerar-orcamento: usa a função de elegibilidade real do motor, nunca uma checagem de status solta", () => {
  assert.match(rota, /oportunidadeElegivelParaOrcamento\(oportunidade\)/);
});

test("gerar-orcamento: replay idempotente quando já vinculada, nunca cria um segundo orçamento", () => {
  assert.match(rota, /oportunidade\.orcamento_vinculado_id !== null/);
  assert.match(rota, /idempotente: true/);
});

test("gerar-orcamento: guarda contra duplicação é uma condição de banco (.is(\"orcamento_vinculado_id\", null)), nunca só uma checagem de aplicação", () => {
  assert.match(rota, /\.update\(\{ orcamento_vinculado_id: novoOrcamento!\.id/);
  assert.match(rota, /\.eq\("clinica_id", auth\.clinicaId\)\s*\.is\("orcamento_vinculado_id", null\)/);
});

test("gerar-orcamento: corrida na vinculação (0 linhas afetadas) é rejeitada explicitamente, nunca ignorada em silêncio", () => {
  assert.match(rota, /if \(!vinculado\)/);
  assert.match(rota, /409/);
});

test("gerar-orcamento: reusa o MESMO contrato de insert de POST \\/api\\/orcamentos (mesmos campos, nenhum segundo motor de orçamento)", () => {
  // Nomes de campo, sem exigir ":" — /api/orcamentos usa shorthand
  // (`clinica_id,`) por destructuring, enquanto gerar-orcamento usa
  // `clinica_id: auth.clinicaId` — mesmo campo, sintaxe diferente.
  for (const campo of ["clinica_id", "paciente_nome", "telefone", "procedimento", "valor", "apresentado", "created_by", "apresentado_em"]) {
    const regex = new RegExp(`\\b${campo}\\b`);
    assert.match(rota, regex, `campo ausente no insert de gerar-orcamento: ${campo}`);
    assert.match(rotaOrcamentos, regex, `campo ausente no contrato canônico de orcamentos: ${campo}`);
  }
});

test("gerar-orcamento: reusa o MESMO prefixo/formato de chave de idempotência de POST /api/orcamentos", () => {
  assert.match(rota, /`criar-orcamento:\$\{idempotency_key\}`/);
  assert.match(rotaOrcamentos, /`criar-orcamento:\$\{idempotency_key\}`/);
});

test("gerar-orcamento: evento de auditoria referencia a oportunidade de origem (evidência), usando eventos_dominio já existente", () => {
  assert.match(rota, /entidade_tipo: "orcamento"/);
  assert.match(rota, /oportunidade_id: id/);
});
