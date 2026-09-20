// Testes do Motor de Orçamentos portado (lib/motor-orcamentos.ts) — mesma
// convenção já usada no worktree audit/smart-commerce-precheck: node:test
// contra o JS real, compilado a partir do TypeScript, nunca uma
// reimplementação em paralelo.
//
// Como rodar:
//   npx tsc --module commonjs --target es2020 --esModuleInterop --skipLibCheck --strict false \
//     --outDir <tmp>/build lib/motor-orcamentos.ts lib/oportunidades-clientes.ts
//   CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/motor-orcamentos.convergencia.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) {
  throw new Error("CONVERGENCIA_BUILD_DIR não definido — ver instruções no cabeçalho deste arquivo");
}

const motor = await import(pathToFileURL(path.join(buildDir, "motor-orcamentos.js")));
const radar = await import(pathToFileURL(path.join(buildDir, "oportunidades-clientes.js")));

test("transicaoValida: apresentado pode ir para os 3 estados finais", () => {
  assert.equal(motor.transicaoValida("apresentado", "aprovado"), true);
  assert.equal(motor.transicaoValida("apresentado", "recusado"), true);
  assert.equal(motor.transicaoValida("apresentado", "expirado"), true);
});

test("transicaoValida: estados finais nunca transicionam, nem entre si nem de volta", () => {
  assert.equal(motor.transicaoValida("aprovado", "recusado"), false);
  assert.equal(motor.transicaoValida("recusado", "aprovado"), false);
  assert.equal(motor.transicaoValida("aprovado", "apresentado"), false);
  assert.equal(motor.transicaoValida("expirado", "aprovado"), false);
});

test("transicaoValida: mesmo estado nunca é transição válida", () => {
  assert.equal(motor.transicaoValida("apresentado", "apresentado"), false);
});

test("transicionar: devolve null para transição inválida, nunca lança exceção", () => {
  const resultado = motor.transicionar({ status: "aprovado" }, "recusado", undefined, "2026-09-19T12:00:00Z");
  assert.equal(resultado, null);
});

test("transicionar: aplica motivo_decisao e decidido_em na transição válida", () => {
  const resultado = motor.transicionar({ status: "apresentado" }, "recusado", "preco", "2026-09-19T12:00:00Z");
  assert.deepEqual(resultado, { status: "recusado", decidido_em: "2026-09-19T12:00:00Z", motivo_decisao: "preco" });
});

test("estaParado: falso antes do limite, verdadeiro no limite e depois", () => {
  const apresentadoEm = "2026-09-01T00:00:00Z";
  assert.equal(motor.estaParado(apresentadoEm, "2026-09-02T00:00:00Z"), false); // 1 dia
  assert.equal(motor.estaParado(apresentadoEm, "2026-09-04T00:00:00Z"), true);  // 3 dias — limite exato
  assert.equal(motor.estaParado(apresentadoEm, "2026-09-10T00:00:00Z"), true);  // 9 dias
});

test("calcularScoreOportunidade: nunca ultrapassa 100 nem fica negativo", () => {
  const score = motor.calcularScoreOportunidade({
    diasParado: 999, valor: 999999, valorMaximoEntreAbertos: 1, quantidadeAbertosDoMesmoPaciente: 999,
  });
  assert.ok(score <= 100 && score >= 0, `score fora da faixa: ${score}`);
});

test("calcularScoreOportunidade: orçamento parado há mais tempo pontua mais (outros fatores iguais)", () => {
  const base = { valor: 1000, valorMaximoEntreAbertos: 1000, quantidadeAbertosDoMesmoPaciente: 1 };
  const scoreRecente = motor.calcularScoreOportunidade({ ...base, diasParado: 1 });
  const scoreAntigo  = motor.calcularScoreOportunidade({ ...base, diasParado: 10 });
  assert.ok(scoreAntigo > scoreRecente, `esperava ${scoreAntigo} > ${scoreRecente}`);
});

test("calcularIndicadoresOrcamentos: taxaAprovacao e tempoMedioDecisaoDias null sem decisões", () => {
  const indicadores = motor.calcularIndicadoresOrcamentos(
    [{ id: "1", clinica_id: "c1", paciente_nome: "A", telefone: null, procedimento: "x", valor: 100,
       status: "apresentado", motivo_decisao: null, observacao: null, created_by: null,
       apresentado_em: "2026-09-01T00:00:00Z", decidido_em: null, criado_em: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" }],
    "2026-09-10T00:00:00Z"
  );
  assert.equal(indicadores.taxaAprovacao, null);
  assert.equal(indicadores.tempoMedioDecisaoDias, null);
  assert.equal(indicadores.quantidadeParada, 1);
});

test("calcularIndicadoresOrcamentos: taxaAprovacao real com decisões mistas", () => {
  const mk = (status, decidido) => ({
    id: status, clinica_id: "c1", paciente_nome: "A", telefone: null, procedimento: "x", valor: 100,
    status, motivo_decisao: status === "recusado" ? "preco" : null, observacao: null, created_by: null,
    apresentado_em: "2026-09-01T00:00:00Z", decidido_em: decidido, criado_em: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  });
  const indicadores = motor.calcularIndicadoresOrcamentos(
    [mk("aprovado", "2026-09-03T00:00:00Z"), mk("recusado", "2026-09-02T00:00:00Z")],
    "2026-09-10T00:00:00Z"
  );
  assert.equal(indicadores.taxaAprovacao, 0.5);
});

// ── Integração aditiva com o Radar (lib/oportunidades-clientes.ts) ────────

test("Radar: orcamentosParados ausente não muda nenhum comportamento existente", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [{ id: "1", nome: "Ana", telefone: "11999999999", data: "2026-09-17" }],
    confirmacoesPendentes: [],
  });
  assert.equal(oportunidades.length, 1);
  assert.equal(oportunidades[0].sinais[0].tipo, "cancelamento_sem_reagendamento");
});

test("Radar: orcamento parado vira sinal 'orcamento_parado' com prioridade alta", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    agora: "2026-09-19T12:00:00Z",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    orcamentosParados: [
      { id: "o1", pacienteNome: "Carlos", telefone: "11988887777", procedimento: "Consulta", valor: 500, apresentadoEm: "2026-09-10T12:00:00Z" },
    ],
  });
  assert.equal(oportunidades.length, 1);
  assert.equal(oportunidades[0].sinais[0].tipo, "orcamento_parado");
  assert.equal(oportunidades[0].prioridade, "alta");
  assert.match(oportunidades[0].motivoPrincipal, /Carlos/);
  assert.match(oportunidades[0].motivoPrincipal, /R\$/); // valor formatado, nunca omitido
});

test("Radar: orcamento recém-apresentado (dentro do limite de 'parado') não vira sinal", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    agora: "2026-09-19T12:00:00Z",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    orcamentosParados: [
      { id: "o1", pacienteNome: "Bia", telefone: "11977776666", procedimento: "Consulta", valor: 300, apresentadoEm: "2026-09-19T10:00:00Z" },
    ],
  });
  assert.equal(oportunidades.length, 0);
});

test("Radar: orcamento parado do mesmo cliente com outro sinal existente vira segundo sinal, não duplica cliente", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    agora: "2026-09-19T12:00:00Z",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [{ id: "1", nome: "Duda", telefone: "11966665555", data: "2026-09-17" }],
    confirmacoesPendentes: [],
    orcamentosParados: [
      { id: "o1", pacienteNome: "Duda", telefone: "11966665555", procedimento: "Consulta", valor: 800, apresentadoEm: "2026-09-05T12:00:00Z" },
    ],
  });
  assert.equal(oportunidades.length, 1); // mesmo telefone -> mesmo cliente, não duplica
  assert.equal(oportunidades[0].sinaisAdicionais, 1);
  // cancelamento (peso 0) continua vencendo orcamento_parado (peso 1) como sinal principal
  assert.equal(oportunidades[0].sinais[0].tipo, "cancelamento_sem_reagendamento");
});

test("Radar: sem 'agora', orcamentosParados é ignorado com segurança (nunca lança, nunca gera sinal)", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    orcamentosParados: [
      { id: "o1", pacienteNome: "Zeca", telefone: "11955554444", procedimento: "Consulta", valor: 400, apresentadoEm: "2026-08-01T12:00:00Z" },
    ],
  });
  assert.equal(oportunidades.length, 0);
});
