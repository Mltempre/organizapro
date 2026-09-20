// Smart Commerce Canônico V1 — prova de CONVERGÊNCIA: os 5 sinais
// comerciais (orcamento_parado, cobranca_atrasada, tratamento_sem_retorno,
// pedido_nao_concluido, recompra_possivel) coexistindo numa ÚNICA chamada
// real do Radar, cada um vindo do seu motor canônico real, chegando à
// Missão do Dia e ao Diretor Digital sem se atropelarem — prova que os
// dois checkpoints (convergencia/orcamentos 5550d2d + feature/ecommerce-
// ia-v1 86c0709) realmente convergem no mesmo motor, não em motores
// paralelos.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/smart-commerce-canonico.test.mjs
// (build inclui motor-orcamentos, motor-tratamento, motor-cobranca,
// motor-pedidos, oportunidades-clientes, nucleo-inteligente, ia-comercial)

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");

const radar = await import(pathToFileURL(path.join(buildDir, "oportunidades-clientes.js")));
const nucleo = await import(pathToFileURL(path.join(buildDir, "nucleo-inteligente.js")));
const diretor = await import(pathToFileURL(path.join(buildDir, "ia-comercial.js")));

function cenarioCompleto() {
  return radar.gerarOportunidadesClientes({
    hoje: "2026-09-20",
    agora: "2026-09-20T12:00:00Z",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    orcamentosParados: [
      { id: "orc-1", pacienteNome: "Ana Orçamento", telefone: "11911110001", procedimento: "Consultoria", valor: 2000, apresentadoEm: "2026-09-10T12:00:00Z" },
    ],
    cobrancasAtrasadas: [
      { id: "cob-1", pacienteNome: "Bruno Cobranca", telefone: "11911110002", descricao: "Mensalidade", valor: 300, vencimento: "2026-09-05", status: "pendente" },
    ],
    tratamentosSemRetorno: [
      { id: "trat-1", pacienteNome: "Carla Tratamento", telefone: "11911110003", tipoTratamento: "Acompanhamento", status: "em_andamento", proximaDataPrevista: null, updatedAt: "2026-09-05T12:00:00Z", interrompidoEm: null },
    ],
    pedidosNaoConcluidos: [
      { id: "ped-1", pacienteNome: "Duda Pedido", telefone: "11911110004", descricao: "1 item", valor: 150, criadoEm: "2026-09-17T12:00:00Z" },
    ],
    recomprasPossiveis: [
      { pacienteNome: "Elis Recompra", telefone: "11911110005", ultimoPedidoPagoEm: "2026-05-01T12:00:00Z" },
    ],
  });
}

test("Convergência: os 5 domínios geram 5 clientes distintos, um sinal cada, sem interferência mútua", () => {
  const oportunidades = cenarioCompleto();
  assert.equal(oportunidades.length, 5);
  const tipos = oportunidades.map(o => o.sinais[0].tipo).sort();
  assert.deepEqual(tipos, [
    "cobranca_atrasada", "orcamento_parado", "pedido_nao_concluido", "recompra_possivel", "tratamento_sem_retorno",
  ]);
});

test("Convergência: prioridade determina a ordem final do Radar (orçamento/cobrança antes de recompra/tratamento)", () => {
  const oportunidades = cenarioCompleto();
  const ordemTipos = oportunidades.map(o => o.sinais[0].tipo);
  const idxOrcamento = ordemTipos.indexOf("orcamento_parado");
  const idxCobranca = ordemTipos.indexOf("cobranca_atrasada");
  const idxPedido = ordemTipos.indexOf("pedido_nao_concluido");
  const idxTratamento = ordemTipos.indexOf("tratamento_sem_retorno");
  const idxRecompra = ordemTipos.indexOf("recompra_possivel");
  // Todos alta prioridade vêm antes dos de prioridade média — verificado
  // pela prioridade real de cada oportunidade, não pela ordem de inserção.
  assert.equal(oportunidades[idxOrcamento].prioridade, "alta");
  assert.equal(oportunidades[idxCobranca].prioridade, "alta");
  assert.equal(oportunidades[idxPedido].prioridade, "alta");
  assert.equal(oportunidades[idxTratamento].prioridade, "media");
  assert.equal(oportunidades[idxRecompra].prioridade, "media");
  assert.ok(Math.max(idxOrcamento, idxCobranca, idxPedido) < Math.min(idxTratamento, idxRecompra));
});

test("Convergência: todos os 5 chegam à Missão do Dia com tipo e evidência corretos por domínio", () => {
  const oportunidades = cenarioCompleto();
  const sinaisCanonicos = nucleo.adaptarOportunidadesClientes(oportunidades);
  const missaoDoDia = nucleo.gerarMissaoDoDia(sinaisCanonicos, 10); // limite alto para pegar todos
  assert.equal(missaoDoDia.length, 5);
  const porTipo = Object.fromEntries(missaoDoDia.map(s => [s.tipo, s]));
  assert.match(porTipo.orcamento_parado.evidencia, /orçamento real/i);
  assert.match(porTipo.cobranca_atrasada.evidencia, /cobrança real/i);
  assert.match(porTipo.tratamento_sem_retorno.evidencia, /tratamento real/i);
  assert.match(porTipo.pedido_nao_concluido.evidencia, /pedido real/i);
  assert.match(porTipo.recompra_possivel.evidencia, /histórico real de pedidos/i);
});

test("Convergência: todos os 5 chegam ao Diretor Digital como recomendações consultivas distintas", () => {
  const oportunidades = cenarioCompleto();
  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: 60,
  });
  // gerarRecomendacoesConsultivas limita a 3 (Regra de Ouro — "uma boa
  // decisão, não a lista inteira") — as 3 primeiras por prioridade real.
  assert.equal(recomendacoes.length, 3);
  const categorias = recomendacoes.map(r => r.categoria);
  assert.ok(categorias.includes("orcamento_parado"));
  assert.ok(categorias.includes("cobranca_atrasada"));
  assert.ok(categorias.includes("pedido_nao_concluido"));

  const narrativa = diretor.gerarNarrativaDiretor({ ocupacaoPct: 60, recomendacoes });
  assert.match(narrativa, /Também encontrei mais/i);
});

test("Honestidade da convergência: nenhum dos 5 domínios fabrica sinal quando a lista real está vazia", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-20", agora: "2026-09-20T12:00:00Z",
    clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: [],
    orcamentosParados: [], cobrancasAtrasadas: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [], recomprasPossiveis: [],
  });
  assert.equal(oportunidades.length, 0);
});
