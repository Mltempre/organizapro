// Prova ponta a ponta (domínio puro): pedido_nao_concluido e
// recompra_possivel chegam ao Radar, à Missão do Dia e ao Diretor Digital
// — mesmo padrão já provado para orcamento_parado/cobranca_atrasada/
// tratamento_sem_retorno.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/pedido-radar-diretor.ecommerce.test.mjs
// (build inclui oportunidades-clientes, nucleo-inteligente, ia-comercial,
// motor-orcamentos, motor-tratamento, motor-cobranca)

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");

const radar = await import(pathToFileURL(path.join(buildDir, "oportunidades-clientes.js")));
const nucleo = await import(pathToFileURL(path.join(buildDir, "nucleo-inteligente.js")));
const diretor = await import(pathToFileURL(path.join(buildDir, "ia-comercial.js")));

test("pedido_nao_concluido: Radar -> Missão do Dia -> Diretor Digital, destino /pedidos", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-20",
    agora: "2026-09-20T12:00:00Z",
    clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: [],
    pedidosNaoConcluidos: [
      { id: "ped-1", pacienteNome: "Ana Costa", telefone: "11911112222", descricao: "2 itens", valor: 350, criadoEm: "2026-09-17T12:00:00Z" },
    ],
  });
  assert.equal(oportunidades.length, 1);
  assert.equal(oportunidades[0].sinais[0].tipo, "pedido_nao_concluido");
  assert.equal(oportunidades[0].prioridade, "alta");

  const sinaisCanonicos = nucleo.adaptarOportunidadesClientes(oportunidades);
  assert.equal(sinaisCanonicos[0].destino, "/pedidos");
  assert.match(sinaisCanonicos[0].evidencia, /pedido real registrado/i);

  const missaoDoDia = nucleo.gerarMissaoDoDia(sinaisCanonicos);
  assert.equal(missaoDoDia.length, 1);

  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: 50,
  });
  assert.equal(recomendacoes[0].categoria, "pedido_nao_concluido");
  assert.equal(recomendacoes[0].destino, "/pedidos");
});

test("pedido_nao_concluido: pedido recém-criado (dentro do limiar de 2 dias) não vira sinal", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-20", agora: "2026-09-20T12:00:00Z",
    clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: [],
    pedidosNaoConcluidos: [
      { id: "ped-2", pacienteNome: "Bruno", telefone: "11922223333", descricao: "1 item", valor: 100, criadoEm: "2026-09-20T08:00:00Z" },
    ],
  });
  assert.equal(oportunidades.length, 0);
});

test("recompra_possivel: Radar -> Diretor Digital, destino /pedidos, prioridade media", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-20", agora: "2026-09-20T12:00:00Z",
    clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: [],
    recomprasPossiveis: [
      { pacienteNome: "Carla Dias", telefone: "11933334444", ultimoPedidoPagoEm: "2026-06-01T12:00:00Z" },
    ],
  });
  assert.equal(oportunidades.length, 1);
  assert.equal(oportunidades[0].sinais[0].tipo, "recompra_possivel");
  assert.equal(oportunidades[0].prioridade, "media");

  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: 50,
  });
  assert.equal(recomendacoes[0].categoria, "recompra_possivel");
  assert.equal(recomendacoes[0].destino, "/pedidos");
});

test("recompra_possivel: cliente recente (dentro dos 60 dias) não vira sinal (nunca fabrica reativação)", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-20", agora: "2026-09-20T12:00:00Z",
    clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: [],
    recomprasPossiveis: [
      { pacienteNome: "Duda", telefone: "11944445555", ultimoPedidoPagoEm: "2026-09-10T12:00:00Z" },
    ],
  });
  assert.equal(oportunidades.length, 0);
});

test("Honestidade: sem dado de pedidos, nenhuma recomendação de e-commerce é fabricada", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-20", agora: "2026-09-20T12:00:00Z",
    clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: [],
    pedidosNaoConcluidos: [], recomprasPossiveis: [],
  });
  assert.equal(oportunidades.length, 0);
  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: 50,
  });
  assert.equal(recomendacoes.length, 0);
});
