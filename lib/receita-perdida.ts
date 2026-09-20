// ── Receita Perdida AI V1 · agregador honesto de dinheiro em risco ─────────
// Consolida em UMA visão explicável o dinheiro real em risco/recuperável já
// espalhado pelos quatro motores canônicos da cadeia comercial. NUNCA um
// segundo Radar, NUNCA um segundo Diretor: reusa literalmente os mesmos
// predicados puros que o Radar já usa para decidir SE um item está em risco
// (estaParado/diasParado, estaAtrasada/diasAtraso, precisaRetorno/
// diasInterrompido/diasSemAtividade) — a única coisa que este arquivo
// adiciona é o valor monetário real, que lib/oportunidades-clientes.ts
// deliberadamente NUNCA carrega (SinalOportunidade não tem campo de valor,
// de propósito, porque aquele motor resolve "quem contatar", não "quanto").
//
// Regra de ouro, sem exceção: todo valor exibido vem de uma coluna real
// (orcamentos.valor, cobrancas.valor, pedidos.valor_centavos/100).
// Ausência de valor real (tratamentos.valor_estimado nulo, oportunidade sem
// orcamento_vinculado_id) NUNCA vira 0 nem uma estimativa de ticket médio —
// vira uma contagem separada, nunca somada ao total em dinheiro.

import { estaParado, diasParado } from "./motor-orcamentos";
import { estaAtrasada, diasAtraso } from "./motor-cobranca";
import { precisaRetorno, diasSemAtividade, diasInterrompido } from "./motor-tratamento";
import { oportunidadeElegivelParaOrcamento, type OportunidadeStatus } from "./oportunidades-demanda";
import type {
  OrcamentoParadoInput,
  CobrancaAtrasadaInput,
  TratamentoSemRetornoInput,
  PedidoNaoConcluidoInput,
} from "./oportunidades-clientes";

export type OrigemReceitaPerdida =
  | "orcamento_parado"
  | "cobranca_atrasada"
  | "tratamento_sem_retorno"
  | "pedido_nao_concluido";

// Estende o input já usado pelo Radar só com o único campo que aquele tipo
// deliberadamente omite (valor). Nenhum campo redefinido, nenhuma segunda
// forma de descrever um tratamento.
export type TratamentoSemRetornoComValorInput = TratamentoSemRetornoInput & {
  valorEstimado: number | null; // tratamentos.valor_estimado — null é um fato, nunca 0
};

export type OportunidadeAbertaInput = {
  id: string;
  pacienteNome: string;
  status: OportunidadeStatus;
  orcamentoVinculadoId: string | null;
};

export type EntradaReceitaPerdida = {
  hoje: string; // YYYY-MM-DD
  agora: string; // ISO — timestamptz "agora"
  orcamentosParados: OrcamentoParadoInput[];
  cobrancasAtrasadas: CobrancaAtrasadaInput[];
  tratamentosSemRetorno: TratamentoSemRetornoComValorInput[];
  pedidosNaoConcluidos: PedidoNaoConcluidoInput[];
  oportunidadesAbertas: OportunidadeAbertaInput[];
};

export type ItemReceitaPerdida = {
  origem: OrigemReceitaPerdida;
  id: string;
  pacienteNome: string;
  valor: number | null; // null = a coluna real não tem valor (nunca inferido)
  diasEmRisco: number;
  destino: string; // superfície operacional já existente — nunca uma tela nova
};

export type OportunidadeSemComprovacao = {
  id: string;
  pacienteNome: string;
  status: OportunidadeStatus;
  destino: string;
};

export type ResumoOrigem = {
  origem: OrigemReceitaPerdida;
  totalConhecido: number;
  itensComValor: number;
  itensSemValor: number;
};

export type ResumoReceitaPerdida = {
  totalConhecido: number; // soma SÓ dos itens com valor real — nunca inclui itensSemValor
  totalItensComValor: number;
  totalItensSemValor: number;
  oportunidadesSemComprovacao: number; // nunca contado em dinheiro
  porOrigem: ResumoOrigem[];
  itens: ItemReceitaPerdida[];
  oportunidades: OportunidadeSemComprovacao[];
};

const DESTINOS: Record<OrigemReceitaPerdida, string> = {
  orcamento_parado: "/orcamentos",
  cobranca_atrasada: "/cobrancas",
  tratamento_sem_retorno: "/tratamentos",
  pedido_nao_concluido: "/pedidos",
};

// Mesmo limiar de "pedido parado" já usado por gerarOportunidadesClientes
// (lib/oportunidades-clientes.ts) — não exportado por aquele arquivo, por
// isso duplicado aqui como literal (documentado) em vez de importado.
// Alterar um sem o outro quebra a promessa de "mesmo sinal, duas visões".
const DIAS_PARA_PEDIDO_PARADO = 2;

/**
 * Agrega dinheiro real em risco/recuperável a partir de dados já buscados
 * pela tela (nenhuma consulta ao banco aqui — mesma filosofia de
 * gerarOportunidadesClientes). Cada item aponta para a superfície
 * operacional onde a ação real acontece — nunca uma ação nova.
 */
export function agregarReceitaPerdida(input: EntradaReceitaPerdida): ResumoReceitaPerdida {
  const itens: ItemReceitaPerdida[] = [];

  for (const o of input.orcamentosParados) {
    if (!estaParado(o.apresentadoEm, input.agora)) continue;
    itens.push({
      origem: "orcamento_parado",
      id: o.id,
      pacienteNome: o.pacienteNome,
      valor: o.valor,
      diasEmRisco: diasParado(o.apresentadoEm, input.agora),
      destino: DESTINOS.orcamento_parado,
    });
  }

  for (const c of input.cobrancasAtrasadas) {
    if (!estaAtrasada(c.vencimento, input.hoje)) continue;
    itens.push({
      origem: "cobranca_atrasada",
      id: c.id,
      pacienteNome: c.pacienteNome,
      valor: c.valor,
      diasEmRisco: diasAtraso(c.vencimento, input.hoje),
      destino: DESTINOS.cobranca_atrasada,
    });
  }

  for (const t of input.tratamentosSemRetorno) {
    if (t.status === "em_andamento" && precisaRetorno({ status: t.status, proxima_data_prevista: t.proximaDataPrevista }, input.hoje)) {
      itens.push({
        origem: "tratamento_sem_retorno",
        id: t.id,
        pacienteNome: t.pacienteNome,
        valor: t.valorEstimado,
        diasEmRisco: diasSemAtividade(t.updatedAt, input.agora),
        destino: DESTINOS.tratamento_sem_retorno,
      });
    } else if (t.status === "interrompido" && t.interrompidoEm) {
      itens.push({
        origem: "tratamento_sem_retorno",
        id: t.id,
        pacienteNome: t.pacienteNome,
        valor: t.valorEstimado,
        diasEmRisco: diasInterrompido(t.interrompidoEm, input.agora),
        destino: DESTINOS.tratamento_sem_retorno,
      });
    }
  }

  for (const p of input.pedidosNaoConcluidos) {
    const dias = diasSemAtividade(p.criadoEm, input.agora);
    if (dias < DIAS_PARA_PEDIDO_PARADO) continue;
    itens.push({
      origem: "pedido_nao_concluido",
      id: p.id,
      pacienteNome: p.pacienteNome,
      valor: p.valor,
      diasEmRisco: dias,
      destino: DESTINOS.pedido_nao_concluido,
    });
  }

  // Mesma função já usada para decidir se uma oportunidade pode gerar um
  // orçamento (lib/oportunidades-demanda.ts) — aqui, a mesma condição
  // (aberta E sem orçamento vinculado) identifica quem ainda não tem
  // nenhum valor financeiro comprovável.
  const oportunidades: OportunidadeSemComprovacao[] = input.oportunidadesAbertas
    .filter((op) => oportunidadeElegivelParaOrcamento({ status: op.status, orcamento_vinculado_id: op.orcamentoVinculadoId }))
    .map((op) => ({ id: op.id, pacienteNome: op.pacienteNome, status: op.status, destino: "/oportunidades" }));

  const comValor = itens.filter((i) => i.valor !== null);
  const semValor = itens.filter((i) => i.valor === null);
  const totalConhecido = comValor.reduce((soma, i) => soma + (i.valor as number), 0);

  const ORIGENS: OrigemReceitaPerdida[] = ["orcamento_parado", "cobranca_atrasada", "tratamento_sem_retorno", "pedido_nao_concluido"];
  const porOrigem: ResumoOrigem[] = ORIGENS.map((origem) => {
    const doGrupo = itens.filter((i) => i.origem === origem);
    const doGrupoComValor = doGrupo.filter((i) => i.valor !== null);
    return {
      origem,
      totalConhecido: doGrupoComValor.reduce((soma, i) => soma + (i.valor as number), 0),
      itensComValor: doGrupoComValor.length,
      itensSemValor: doGrupo.length - doGrupoComValor.length,
    };
  });

  return {
    totalConhecido,
    totalItensComValor: comValor.length,
    totalItensSemValor: semValor.length,
    oportunidadesSemComprovacao: oportunidades.length,
    porOrigem,
    itens,
    oportunidades,
  };
}
