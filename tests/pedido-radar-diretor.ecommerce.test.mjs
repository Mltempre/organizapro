// Prova ponta a ponta (domínio puro): pedido_nao_concluido e
// recompra_possivel chegam ao Radar, à Missão do Dia e ao Diretor Digital
// — mesmo padrão já provado para orcamento_parado/cobranca_atrasada/
// tratamento_sem_retorno.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/pedido-radar-diretor.ecommerce.test.mjs
// (build inclui oportunidades-clientes, nucleo-inteligente, ia-comercial,
// motor-orcamentos, motor-tratamento, motor-cobranca, motor-pedidos)

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");

const radar = await import(pathToFileURL(path.join(buildDir, "oportunidades-clientes.js")));
const nucleo = await import(pathToFileURL(path.join(buildDir, "nucleo-inteligente.js")));
const diretor = await import(pathToFileURL(path.join(buildDir, "ia-comercial.js")));
const motorPedidos = await import(pathToFileURL(path.join(buildDir, "motor-pedidos.js")));

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

// ── Integração ponta a ponta com a agregação real (lib/motor-pedidos.ts) ──
// Prova o pipeline completo: linhas de pedidos como a API devolve
// (múltiplos pedidos, múltiplos clientes) -> agregarClientesElegiveisRecompra
// -> gerarOportunidadesClientes -> Missão do Dia -> Diretor Digital. Exatamente
// o que app/dashboard/page.tsx faz, sem nenhuma consulta nova.

test("Integração: pedidos reais de vários clientes -> agregação -> Radar -> Missão do Dia -> Diretor Digital, destino /pedidos", () => {
  const pedidosDaApi = [
    // Cliente elegível: último pedido pago há mais de 60 dias, nenhum posterior.
    { pacienteId: "p1", telefone: "11911112222", nomeCliente: "Carla Dias", status: "pago", criadoEm: "2026-06-01T10:00:00Z", pagamentoConfirmadoEm: "2026-06-01T12:00:00Z" },
    // Cliente NÃO elegível: pagou, mas fez um pedido novo depois (ainda em aberto).
    { pacienteId: "p2", telefone: "11922223333", nomeCliente: "Bruno Reis", status: "pago", criadoEm: "2026-05-01T10:00:00Z", pagamentoConfirmadoEm: "2026-05-01T12:00:00Z" },
    { pacienteId: "p2", telefone: "11922223333", nomeCliente: "Bruno Reis", status: "criado", criadoEm: "2026-08-01T10:00:00Z", pagamentoConfirmadoEm: null },
    // Cliente NÃO elegível: pagou há menos de 60 dias.
    { pacienteId: "p3", telefone: "11933334444", nomeCliente: "Duda Alves", status: "pago", criadoEm: "2026-09-10T10:00:00Z", pagamentoConfirmadoEm: "2026-09-10T12:00:00Z" },
  ];

  // A agregação só resolve "qual o último pedido de cada cliente e ele
  // está pago" — o limiar de 60 dias é responsabilidade exclusiva de
  // gerarOportunidadesClientes (chamado a seguir). Por isso Carla Dias
  // (pagou há >60 dias) E Duda Alves (pagou há <60 dias) passam daqui;
  // Bruno Reis não passa porque seu pedido mais recente não é o pago.
  const recomprasPossiveis = motorPedidos.agregarClientesElegiveisRecompra(pedidosDaApi);
  assert.equal(recomprasPossiveis.length, 2, "Carla Dias e Duda Alves deveriam passar da agregação (Bruno não, por ter pedido mais novo não pago)");
  assert.ok(recomprasPossiveis.some(r => r.pacienteNome === "Carla Dias"));
  assert.ok(recomprasPossiveis.some(r => r.pacienteNome === "Duda Alves"));
  assert.ok(!recomprasPossiveis.some(r => r.pacienteNome === "Bruno Reis"));

  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-20", agora: "2026-09-20T12:00:00Z",
    clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: [],
    recomprasPossiveis,
  });
  assert.equal(oportunidades.length, 1);
  assert.equal(oportunidades[0].nome, "Carla Dias");
  assert.equal(oportunidades[0].sinais[0].tipo, "recompra_possivel");

  const sinaisCanonicos = nucleo.adaptarOportunidadesClientes(oportunidades);
  assert.equal(sinaisCanonicos[0].destino, "/pedidos");

  const missaoDoDia = nucleo.gerarMissaoDoDia(sinaisCanonicos);
  assert.equal(missaoDoDia.length, 1);

  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: 50,
  });
  assert.equal(recomendacoes.length, 1);
  assert.equal(recomendacoes[0].categoria, "recompra_possivel");
  assert.equal(recomendacoes[0].destino, "/pedidos");
});
