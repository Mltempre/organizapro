// Prova ponta a ponta (domínio puro) das duas novas etapas da cadeia
// orçamento → venda → receita: cobranca_atrasada e tratamento_sem_retorno
// chegam ao Radar, à Missão do Dia e ao Diretor Digital — mesmo padrão já
// provado para orcamento_parado em orcamento-parado-diretor.convergencia.test.mjs.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/venda-receita-diretor.convergencia.test.mjs
// (build inclui motor-orcamentos, motor-tratamento, motor-cobranca,
// oportunidades-clientes, nucleo-inteligente, ia-comercial)

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");

const radar = await import(pathToFileURL(path.join(buildDir, "oportunidades-clientes.js")));
const nucleo = await import(pathToFileURL(path.join(buildDir, "nucleo-inteligente.js")));
const diretor = await import(pathToFileURL(path.join(buildDir, "ia-comercial.js")));

test("cobranca_atrasada: Radar -> Missão do Dia -> Diretor Digital, sem destino inventado", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    cobrancasAtrasadas: [
      { id: "cob-1", pacienteNome: "Renato Alves", telefone: "11911112222", descricao: "Mensalidade", valor: 450, vencimento: "2026-09-05", status: "pendente" },
    ],
  });
  assert.equal(oportunidades.length, 1);
  assert.equal(oportunidades[0].sinais[0].tipo, "cobranca_atrasada");
  assert.equal(oportunidades[0].prioridade, "alta");

  const sinaisCanonicos = nucleo.adaptarOportunidadesClientes(oportunidades);
  assert.equal(sinaisCanonicos[0].destino, undefined); // /cobrancas ainda não existe — nunca aponta para tela errada
  assert.match(sinaisCanonicos[0].evidencia, /cobrança real registrada/i);

  const missaoDoDia = nucleo.gerarMissaoDoDia(sinaisCanonicos);
  assert.equal(missaoDoDia.length, 1);

  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: 50,
  });
  assert.equal(recomendacoes[0].categoria, "cobranca_atrasada");
  assert.equal(recomendacoes[0].destino, undefined);
});

test("cobranca_atrasada: cobrança dentro do vencimento nunca vira sinal (nunca fabrica atraso)", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    cobrancasAtrasadas: [
      { id: "cob-2", pacienteNome: "Bia", telefone: "11900001111", descricao: "Consulta", valor: 200, vencimento: "2026-09-25", status: "pendente" },
    ],
  });
  assert.equal(oportunidades.length, 0);
});

test("tratamento_sem_retorno (em_andamento sem próxima data): Radar -> Diretor Digital", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    agora: "2026-09-19T12:00:00Z",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    tratamentosSemRetorno: [
      { id: "trat-1", pacienteNome: "Sofia Reis", telefone: "11933334444", tipoTratamento: "Acompanhamento mensal", status: "em_andamento", proximaDataPrevista: null, updatedAt: "2026-09-10T12:00:00Z", interrompidoEm: null },
    ],
  });
  assert.equal(oportunidades.length, 1);
  assert.equal(oportunidades[0].sinais[0].tipo, "tratamento_sem_retorno");
  assert.equal(oportunidades[0].prioridade, "media");

  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: 50,
  });
  assert.equal(recomendacoes[0].categoria, "tratamento_sem_retorno");
  assert.match(recomendacoes[0].identificado, /Sofia Reis/);
});

test("tratamento_sem_retorno (interrompido): gera sinal com dias desde a interrupção", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    agora: "2026-09-19T12:00:00Z",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    tratamentosSemRetorno: [
      { id: "trat-2", pacienteNome: "Caio", telefone: "11955556666", tipoTratamento: "Consultoria", status: "interrompido", proximaDataPrevista: null, updatedAt: "2026-09-01T12:00:00Z", interrompidoEm: "2026-09-01T12:00:00Z" },
    ],
  });
  assert.equal(oportunidades.length, 1);
  assert.equal(oportunidades[0].sinais[0].diasDesdeEvento, 18);
});

test("tratamento_sem_retorno: em_andamento com retorno já agendado no futuro NÃO vira sinal", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    agora: "2026-09-19T12:00:00Z",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    tratamentosSemRetorno: [
      { id: "trat-3", pacienteNome: "Lu", telefone: "11977778888", tipoTratamento: "x", status: "em_andamento", proximaDataPrevista: "2026-09-25", updatedAt: "2026-09-15T12:00:00Z", interrompidoEm: null },
    ],
  });
  assert.equal(oportunidades.length, 0);
});

test("Honestidade: sem nenhum dado de venda/receita, nenhuma recomendação é fabricada e a narrativa diz 'continue assim'", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19", agora: "2026-09-19T12:00:00Z",
    clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: [],
    orcamentosParados: [], cobrancasAtrasadas: [], tratamentosSemRetorno: [],
  });
  assert.equal(oportunidades.length, 0);
  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: 50,
  });
  assert.equal(recomendacoes.length, 0);
  assert.match(diretor.gerarNarrativaDiretor({ ocupacaoPct: 50, recomendacoes }), /continue assim/i);
});
