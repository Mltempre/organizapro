// Testes do Motor de Tratamento portado (lib/motor-tratamento.ts) — etapa
// "venda" da cadeia orçamento → venda → receita. Mesma convenção: node:test
// contra o JS real compilado do TypeScript.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/motor-tratamento.convergencia.test.mjs
// (build inclui lib/motor-tratamento.ts)

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");

const motor = await import(pathToFileURL(path.join(buildDir, "motor-tratamento.js")));

test("transicaoValida: segue exatamente o grafo forward-only sem regressões", () => {
  assert.equal(motor.transicaoValida("criado", "em_andamento"), true);
  assert.equal(motor.transicaoValida("em_andamento", "retorno_agendado"), true);
  assert.equal(motor.transicaoValida("em_andamento", "interrompido"), true);
  assert.equal(motor.transicaoValida("retorno_agendado", "concluido"), true);
  assert.equal(motor.transicaoValida("interrompido", "abandonado"), true);
});

test("transicaoValida: pula de etapa é sempre inválido (ex: criado -> concluido)", () => {
  assert.equal(motor.transicaoValida("criado", "concluido"), false);
  assert.equal(motor.transicaoValida("criado", "retorno_agendado"), false);
});

test("transicaoValida: terminais (concluido/abandonado) nunca transicionam, nem para si mesmos", () => {
  assert.equal(motor.transicaoValida("concluido", "em_andamento"), false);
  assert.equal(motor.transicaoValida("abandonado", "em_andamento"), false);
  assert.equal(motor.transicaoValida("concluido", "concluido"), false);
});

test("transicionar: interrompido grava motivo_interrupcao e interrompido_em", () => {
  const r = motor.transicionar({ status: "em_andamento" }, "interrompido", { motivoInterrupcao: "financeiro" }, "2026-09-19T12:00:00Z");
  assert.deepEqual(r, { status: "interrompido", interrompido_em: "2026-09-19T12:00:00Z", motivo_interrupcao: "financeiro" });
});

test("transicionar: transição inválida devolve null, nunca lança", () => {
  assert.equal(motor.transicionar({ status: "concluido" }, "em_andamento", undefined, "2026-09-19T12:00:00Z"), null);
});

test("precisaRetorno: só se aplica a em_andamento, e só quando não há data ou ela já passou", () => {
  assert.equal(motor.precisaRetorno({ status: "em_andamento", proxima_data_prevista: null }, "2026-09-19"), true);
  assert.equal(motor.precisaRetorno({ status: "em_andamento", proxima_data_prevista: "2026-09-10" }, "2026-09-19"), true);
  assert.equal(motor.precisaRetorno({ status: "em_andamento", proxima_data_prevista: "2026-09-25" }, "2026-09-19"), false);
  assert.equal(motor.precisaRetorno({ status: "concluido", proxima_data_prevista: null }, "2026-09-19"), false);
});

test("calcularIndicadoresTratamento: receitaPotencial e receitaConvertida nunca se misturam", () => {
  const mk = (status, valor) => ({
    id: status + valor, clinica_id: "c1", paciente_id: null, paciente_nome: "A", paciente_telefone: null,
    orcamento_origem_id: null, tipo_tratamento: "x", status, motivo_interrupcao: null,
    proxima_data_prevista: null, valor_estimado: valor, observacao: null, created_by: null,
    iniciado_em: "2026-09-01T00:00:00Z", concluido_em: status === "concluido" ? "2026-09-15T00:00:00Z" : null,
    interrompido_em: null, abandonado_em: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  });
  const indicadores = motor.calcularIndicadoresTratamento(
    [mk("em_andamento", 1000), mk("concluido", 500)],
    "2026-09-19T00:00:00Z"
  );
  assert.equal(indicadores.receitaPotencial, 1000);
  assert.equal(indicadores.receitaConvertida, 500);
});
