// Testes do Motor de Cobrança portado (lib/motor-cobranca.ts) — etapa
// "receita" da cadeia orçamento → venda → receita.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/motor-cobranca.convergencia.test.mjs
// (build inclui lib/motor-cobranca.ts)

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");

const motor = await import(pathToFileURL(path.join(buildDir, "motor-cobranca.js")));

test("transicaoValida: pendente aceita em_cobranca, pago (direto) e cancelada", () => {
  assert.equal(motor.transicaoValida("pendente", "em_cobranca"), true);
  assert.equal(motor.transicaoValida("pendente", "pago"), true);
  assert.equal(motor.transicaoValida("pendente", "cancelada"), true);
});

test("transicaoValida: terminais (pago/cancelada) nunca transicionam", () => {
  assert.equal(motor.transicaoValida("pago", "pendente"), false);
  assert.equal(motor.transicaoValida("cancelada", "pendente"), false);
});

test("transicionar: pago sem valor_pago explícito usa o valor original (nunca null)", () => {
  const r = motor.transicionar({ status: "pendente", valor: 300 }, "pago", undefined, "2026-09-19T12:00:00Z");
  assert.equal(r.valor_pago, 300);
});

test("transicionar: pago com valor_pago negativo é rejeitado (null, nunca aceita valor inválido)", () => {
  const r = motor.transicionar({ status: "pendente", valor: 300 }, "pago", { valorPago: -10 }, "2026-09-19T12:00:00Z");
  assert.equal(r, null);
});

test("estaAtrasada/diasAtraso: vencimento futuro nunca é atraso", () => {
  assert.equal(motor.estaAtrasada("2026-10-01", "2026-09-19"), false);
  assert.equal(motor.diasAtraso("2026-10-01", "2026-09-19"), 0);
});

test("estaAtrasada/diasAtraso: vencimento passado calcula dias corretos", () => {
  assert.equal(motor.estaAtrasada("2026-09-10", "2026-09-19"), true);
  assert.equal(motor.diasAtraso("2026-09-10", "2026-09-19"), 9);
});

test("foiRecuperada: pagamento pontual (nunca em_cobranca, nunca atrasado) NÃO é recuperação", () => {
  assert.equal(motor.foiRecuperada({ status: "pago", vencimento: "2026-09-19", pago_em: "2026-09-19T10:00:00Z", em_cobranca_em: null }), false);
});

test("foiRecuperada: pago depois do vencimento É recuperação, mesmo sem ter passado por em_cobranca", () => {
  assert.equal(motor.foiRecuperada({ status: "pago", vencimento: "2026-09-10", pago_em: "2026-09-19T10:00:00Z", em_cobranca_em: null }), true);
});

test("calcularIndicadoresCobranca: valorRecebido nunca se confunde com valorRecuperado", () => {
  const mk = (status, opts = {}) => ({
    id: status + Math.random(), clinica_id: "c1", paciente_id: null, paciente_nome: "A", paciente_telefone: null,
    tratamento_origem_id: null, descricao: "x", valor: 100, vencimento: opts.vencimento ?? "2026-09-10",
    status, valor_pago: opts.valor_pago ?? null, motivo_cancelamento: null, observacao: null, created_by: null,
    em_cobranca_em: opts.em_cobranca_em ?? null, pago_em: opts.pago_em ?? null, cancelado_em: null,
    created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  });
  const indicadores = motor.calcularIndicadoresCobranca(
    [
      mk("pago", { pago_em: "2026-09-05T00:00:00Z", valor_pago: 100 }), // pago ANTES do vencimento (09-10) -> recebida, não recuperada
      mk("pago", { vencimento: "2026-08-01", pago_em: "2026-09-05T00:00:00Z", valor_pago: 100 }), // pago DEPOIS do vencimento (08-01) -> recuperada também
    ],
    "2026-09-19T00:00:00Z"
  );
  assert.equal(indicadores.valorRecebidoTotal, 200);
  assert.equal(indicadores.valorRecuperadoTotal, 100);
});
