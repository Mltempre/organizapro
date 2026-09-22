import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const motor = await import(pathToFileURL(path.join(buildDir, "pesquisa-precos.js")));

test("normaliza 500 g para preço por kg", () => {
  const r = motor.normalizarPrecoObservado({ precoCentavos: 500, quantidade: 500, unidadeObservada: "g", unidadeCanonica: "kg" });
  assert.equal(r.comparavel, true);
  assert.equal(r.precoNormalizadoCentavos, 1000);
});

test("normaliza litro e mililitro de forma determinística", () => {
  const r = motor.normalizarPrecoObservado({ precoCentavos: 750, quantidade: 1500, unidadeObservada: "ml", unidadeCanonica: "l" });
  assert.equal(r.comparavel, true);
  assert.equal(r.precoNormalizadoCentavos, 500);
});

test("normaliza metro e centímetro", () => {
  const r = motor.normalizarPrecoObservado({ precoCentavos: 300, quantidade: 150, unidadeObservada: "cm", unidadeCanonica: "m" });
  assert.equal(r.comparavel, true);
  assert.equal(r.precoNormalizadoCentavos, 200);
});

test("caixa não é comparável com unidade sem quantidade conhecida", () => {
  const r = motor.normalizarPrecoObservado({ precoCentavos: 1000, quantidade: 1, unidadeObservada: "caixa", unidadeCanonica: "un" });
  assert.deepEqual(r, { comparavel: false, precoNormalizadoCentavos: null, unidadeCanonica: "un", motivo: "unidade_incompativel" });
});

test("preço zero e preço negativo nunca entram na comparação", () => {
  for (const precoCentavos of [0, -1]) {
    const r = motor.normalizarPrecoObservado({ precoCentavos, quantidade: 1, unidadeObservada: "un", unidadeCanonica: "un" });
    assert.equal(r.comparavel, false);
    assert.equal(r.motivo, "preco_invalido");
  }
});

test("quantidade ausente ou inválida não é transformada em zero", () => {
  for (const quantidade of [0, -1, Number.NaN]) {
    const r = motor.normalizarPrecoObservado({ precoCentavos: 100, quantidade, unidadeObservada: "un", unidadeCanonica: "un" });
    assert.equal(r.comparavel, false);
    assert.equal(r.precoNormalizadoCentavos, null);
  }
});

test("moedas diferentes não são convertidas implicitamente", () => {
  const r = motor.normalizarPrecoObservado({ precoCentavos: 100, quantidade: 1, unidadeObservada: "un", unidadeCanonica: "un", moeda: "USD" });
  assert.equal(r.comparavel, false);
  assert.equal(r.motivo, "moeda_incompativel");
});

test("lista vazia produz estado honesto sem observações", () => {
  assert.equal(motor.compararObservacoes([]).estado, "sem_observacoes");
});

test("somente unidades incompatíveis produz sem observações comparáveis", () => {
  const r = motor.compararObservacoes([{ id: "1", fonteId: "f1", fonteNome: "A", precoCentavos: 100, quantidade: 1, unidadeObservada: "caixa", unidadeCanonica: "un", moeda: "BRL", observadoEm: "2026-09-20T12:00:00Z" }], "2026-09-22T12:00:00Z");
  assert.equal(r.estado, "sem_observacoes_comparaveis");
  assert.deepEqual(r.naoComparaveis, [{ id: "1", motivo: "unidade_incompativel" }]);
});

test("uma única fonte atual é insuficiente para comparação de mercado", () => {
  const r = motor.compararObservacoes([{ id: "1", fonteId: "f1", fonteNome: "A", precoCentavos: 100, quantidade: 1, unidadeObservada: "un", unidadeCanonica: "un", moeda: "BRL", observadoEm: "2026-09-20T12:00:00Z" }], "2026-09-22T12:00:00Z");
  assert.equal(r.estado, "fonte_insuficiente");
  assert.equal(r.fontesDistintas, 1);
});

test("duas fontes atuais comparáveis são ordenadas por preço normalizado", () => {
  const r = motor.compararObservacoes([
    { id: "1", fonteId: "f1", fonteNome: "A", precoCentavos: 1200, quantidade: 1, unidadeObservada: "kg", unidadeCanonica: "kg", moeda: "BRL", observadoEm: "2026-09-20T12:00:00Z" },
    { id: "2", fonteId: "f2", fonteNome: "B", precoCentavos: 500, quantidade: 500, unidadeObservada: "g", unidadeCanonica: "kg", moeda: "BRL", observadoEm: "2026-09-21T12:00:00Z" },
  ], "2026-09-22T12:00:00Z");
  assert.equal(r.estado, "comparacao_disponivel");
  assert.deepEqual(r.comparaveis.map((x) => x.id), ["2", "1"]);
  assert.deepEqual(r.comparaveis.map((x) => x.precoNormalizadoCentavos), [1000, 1200]);
});

test("dados com mais de 30 dias são preservados e sinalizados como antigos", () => {
  const r = motor.compararObservacoes([{ id: "1", fonteId: "f1", fonteNome: "A", precoCentavos: 100, quantidade: 1, unidadeObservada: "un", unidadeCanonica: "un", moeda: "BRL", observadoEm: "2026-07-01T12:00:00Z" }], "2026-09-22T12:00:00Z");
  assert.equal(r.estado, "dados_antigos");
  assert.equal(r.comparaveis[0].antigo, true);
});
