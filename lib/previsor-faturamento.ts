// ── Previsor de Faturamento 30 Dias V1 ──────────────────────────────────
// Responde uma pergunta só: "quanto dinheiro existe perspectiva REAL de
// entrar nos próximos 30 dias, e de onde ele vem?" Domínio puro (sem DB/
// HTTP), mesma filosofia de lib/receita-perdida.ts: NUNCA um segundo
// Radar, NUNCA um motor financeiro novo — reusa literalmente os mesmos
// predicados reais já usados pelo Radar/Receita Perdida (estaParado,
// estaAtrasada, precisaRetorno, diasSemAtividade) e a própria
// agregarReceitaPerdida para a fatia "em risco", em vez de reimplementar
// a lógica de risco aqui.
//
// Determinístico e auditável — nenhuma IA generativa, nenhuma
// probabilidade fabricada, nenhum percentual arbitrário de fechamento.
// Todo valor vem de uma coluna real (orcamentos.valor, cobrancas.valor,
// tratamentos.valor_estimado, pedidos.valor_centavos/100). Ausência de
// dado nunca vira estimativa — vira item "sem data prevista" (nunca
// excluído do total, mas nunca com uma data inventada) ou item
// count-only sem valor (oportunidade sem orçamento vinculado).
//
// Três categorias, nunca misturadas:
// 1. CONFIRMADO/PROGRAMADO — cobrança aberta, vencimento real dentro dos
//    próximos 30 dias, ainda não atrasada. Maior evidência possível.
// 2. EM PERSPECTIVA — orçamento apresentado (ainda não parado), pedido
//    em andamento (ainda não parado), tratamento ativo com um próximo
//    passo real. Depende de conversão/pagamento — nunca é receita
//    garantida.
// 3. EM RISCO — literalmente agregarReceitaPerdida (mesmos 4 sinais +
//    oportunidades sem comprovação) — dinheiro que já deveria ter
//    entrado ou está travado. Mostrado SEPARADO, nunca somado ao total
//    esperado, para nunca misturar "vai entrar" com "está parado".
//
// Anti-duplicação (regra de precedência, documentada): a cadeia real é
// oportunidade -> orçamento -> tratamento -> cobrança, e a mesma venda
// pode ter registro em mais de um estágio ao mesmo tempo.
//   - Orçamento só conta enquanto 'apresentado' — decidido (aprovado)
//     sai da contagem sozinho, por status, sem checagem cruzada extra:
//     o valor futuro passa a viver no tratamento, nunca nos dois.
//   - Tratamento só conta se NÃO houver cobrança aberta (pendente/
//     em_cobranca) com tratamento_origem_id apontando pra ele — já
//     virou uma cobrança real, mais concreta, e é ela quem conta.
//   - Cobrança sempre conta (é o estágio mais concreto/downstream).
//   - Pedido é domínio irmão independente (nunca nasce de orçamento/
//     tratamento) — nunca cruzado com os outros três.
//   - Oportunidade só conta como item count-only (nunca valor) quando
//     aberta E sem orcamento_vinculado_id — mesma regra já usada por
//     lib/receita-perdida.ts (oportunidadeElegivelParaOrcamento).

import { estaParado } from "./motor-orcamentos";
import { estaAtrasada } from "./motor-cobranca";
import { precisaRetorno, diasSemAtividade, type StatusTratamento } from "./motor-tratamento";
import {
  agregarReceitaPerdida,
  type ResumoReceitaPerdida,
  type OportunidadeAbertaInput,
} from "./receita-perdida";

// Mesmo limiar de "pedido parado" já usado por gerarOportunidadesClientes
// e por lib/receita-perdida.ts — documentado como literal duplicado ali,
// mesma decisão aqui: alterar um sem os outros dois quebra a promessa de
// "mesmo sinal, mesma leitura em qualquer tela".
const DIAS_PARA_PEDIDO_PARADO = 2;

export const HORIZONTE_DIAS = 30;

export type OrigemPrevisor =
  | "cobranca_a_vencer" | "orcamento_apresentado" | "tratamento_agendado" | "pedido_em_andamento";

export type CobrancaAbertaInput = {
  id: string;
  pacienteNome: string;
  telefone?: string | null;
  descricao: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  status: "pendente" | "em_cobranca";
  tratamentoOrigemId: string | null;
};

export type OrcamentoApresentadoInput = {
  id: string;
  pacienteNome: string;
  telefone?: string | null;
  procedimento: string;
  valor: number;
  apresentadoEm: string; // timestamptz ISO
};

export type TratamentoParaPrevisorInput = {
  id: string;
  pacienteNome: string;
  telefone?: string | null;
  tipoTratamento: string;
  status: StatusTratamento;
  valorEstimado: number | null;
  proximaDataPrevista: string | null; // YYYY-MM-DD ou null
  updatedAt: string; // timestamptz
  interrompidoEm: string | null;
};

export type PedidoEmAbertoInput = {
  id: string;
  pacienteNome: string;
  telefone?: string | null;
  descricao: string;
  valor: number;
  criadoEm: string; // timestamptz ISO
  status: "criado" | "confirmado" | "aguardando_confirmacao_pagamento";
};

export type EntradaPrevisor = {
  hoje: string; // YYYY-MM-DD
  agora: string; // timestamptz ISO
  cobrancasAbertas: CobrancaAbertaInput[]; // TODAS pendente/em_cobranca — a função separa vencendo vs. atrasada
  orcamentosApresentados: OrcamentoApresentadoInput[]; // TODOS 'apresentado' — a função separa fresco vs. parado
  tratamentos: TratamentoParaPrevisorInput[]; // em_andamento + retorno_agendado + interrompido — a função separa
  pedidosAbertos: PedidoEmAbertoInput[]; // TODOS criado/confirmado/aguardando_confirmacao_pagamento
  oportunidadesAbertas: OportunidadeAbertaInput[];
};

export type ItemPrevisor = {
  origem: OrigemPrevisor;
  id: string;
  pacienteNome: string;
  valor: number;
  dataPrevista: string | null; // YYYY-MM-DD quando há evidência real; null = sem data confiável, documentado, nunca inventado
  destino: string;
};

export type ResumoConfirmadoProgramado = {
  total: number;
  itens: ItemPrevisor[];
};

export type ResumoEmPerspectiva = {
  totalComData: number;
  totalSemData: number;
  itensComData: ItemPrevisor[];
  itensSemData: ItemPrevisor[];
  oportunidadesSemValor: number; // count-only — nunca somado a nenhum total em dinheiro
};

export type ResumoPrevisorFaturamento = {
  hoje: string;
  horizonteFim: string; // hoje + 30 dias, YYYY-MM-DD
  confirmadoProgramado: ResumoConfirmadoProgramado;
  emPerspectiva: ResumoEmPerspectiva;
  totalEsperado30Dias: number; // confirmadoProgramado.total + emPerspectiva.(totalComData + totalSemData) — NUNCA inclui emRisco
  emRisco: ResumoReceitaPerdida; // reaproveitado literalmente, nunca somado ao total esperado
};

const DESTINOS: Record<OrigemPrevisor, string> = {
  cobranca_a_vencer: "/cobrancas",
  orcamento_apresentado: "/orcamentos",
  tratamento_agendado: "/tratamentos",
  pedido_em_andamento: "/pedidos",
};

export function calcularHorizonteFim(hoje: string): string {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + HORIZONTE_DIAS)).toISOString().split("T")[0];
}

function dentroDoHorizonte(data: string, hoje: string, horizonteFim: string): boolean {
  return data >= hoje && data <= horizonteFim;
}

/**
 * Gera o previsor a partir de dados já buscados pela tela (nenhuma
 * consulta ao banco aqui — mesma filosofia de gerarOportunidadesClientes
 * e agregarReceitaPerdida). Cada item aponta para a superfície
 * operacional já existente onde a ação real acontece — nunca uma ação
 * nova, nunca um motor novo.
 */
export function gerarPrevisorFaturamento(input: EntradaPrevisor): ResumoPrevisorFaturamento {
  const horizonteFim = calcularHorizonteFim(input.hoje);

  // ── 1. Confirmado/Programado — cobrança aberta, vencimento real dentro
  // da janela, ainda não atrasada. Vencida entra em "em risco" via
  // agregarReceitaPerdida (nunca contada duas vezes: as duas listas são
  // complementos exatos da mesma condição estaAtrasada).
  const itensConfirmados: ItemPrevisor[] = [];
  for (const c of input.cobrancasAbertas) {
    if (estaAtrasada(c.vencimento, input.hoje)) continue;
    if (!dentroDoHorizonte(c.vencimento, input.hoje, horizonteFim)) continue; // fora da janela de 30 dias — não inventa, só não entra
    itensConfirmados.push({
      origem: "cobranca_a_vencer", id: c.id, pacienteNome: c.pacienteNome, valor: c.valor,
      dataPrevista: c.vencimento, destino: DESTINOS.cobranca_a_vencer,
    });
  }
  const totalConfirmado = itensConfirmados.reduce((soma, i) => soma + i.valor, 0);

  // ── 2. Em Perspectiva ────────────────────────────────────────────────
  const itensComData: ItemPrevisor[] = [];
  const itensSemData: ItemPrevisor[] = [];

  // Orçamentos apresentados e ainda frescos (não parados) — sem campo de
  // data de fechamento esperado no schema real, então NUNCA uma data é
  // inventada: sempre item "sem data prevista", documentado.
  for (const o of input.orcamentosApresentados) {
    if (estaParado(o.apresentadoEm, input.agora)) continue; // parado -> em risco (via agregarReceitaPerdida)
    itensSemData.push({
      origem: "orcamento_apresentado", id: o.id, pacienteNome: o.pacienteNome, valor: o.valor,
      dataPrevista: null, destino: DESTINOS.orcamento_apresentado,
    });
  }

  // Tratamentos ativos com próximo passo real, excluindo os que já têm
  // uma cobrança aberta vinculada (evita contar a mesma venda duas vezes
  // em estágios diferentes da cadeia).
  const tratamentosComCobrancaAberta = new Set(
    input.cobrancasAbertas.map((c) => c.tratamentoOrigemId).filter((id): id is string => !!id)
  );
  for (const t of input.tratamentos) {
    if (t.valorEstimado === null) continue; // sem valor real nunca vira estimativa — nem entra
    if (tratamentosComCobrancaAberta.has(t.id)) continue; // já é uma cobrança real, conta só lá
    if (t.status === "em_andamento") {
      if (precisaRetorno({ status: t.status, proxima_data_prevista: t.proximaDataPrevista }, input.hoje)) continue; // sem próximo passo real -> em risco
      // precisaRetorno=false aqui só é possível quando há proxima_data_prevista futura real.
      const item: ItemPrevisor = {
        origem: "tratamento_agendado", id: t.id, pacienteNome: t.pacienteNome, valor: t.valorEstimado,
        dataPrevista: t.proximaDataPrevista, destino: DESTINOS.tratamento_agendado,
      };
      if (t.proximaDataPrevista && dentroDoHorizonte(t.proximaDataPrevista, input.hoje, horizonteFim)) itensComData.push(item);
      else if (!t.proximaDataPrevista) itensSemData.push({ ...item, dataPrevista: null });
      // data real porém além dos 30 dias: fora do horizonte, não entra (documentado, não inventado)
    } else if (t.status === "retorno_agendado") {
      const item: ItemPrevisor = {
        origem: "tratamento_agendado", id: t.id, pacienteNome: t.pacienteNome, valor: t.valorEstimado,
        dataPrevista: t.proximaDataPrevista, destino: DESTINOS.tratamento_agendado,
      };
      if (t.proximaDataPrevista && dentroDoHorizonte(t.proximaDataPrevista, input.hoje, horizonteFim)) itensComData.push(item);
      else if (!t.proximaDataPrevista) itensSemData.push({ ...item, dataPrevista: null });
    }
    // 'interrompido' nunca entra aqui — é tratado inteiramente como "em risco".
  }

  // Pedidos em andamento e ainda frescos (não parados) — sem campo de
  // data de pagamento esperado no schema real, mesma honestidade dos
  // orçamentos: sempre "sem data prevista".
  for (const p of input.pedidosAbertos) {
    const dias = diasSemAtividade(p.criadoEm, input.agora);
    if (dias >= DIAS_PARA_PEDIDO_PARADO) continue; // parado -> em risco (via agregarReceitaPerdida)
    itensSemData.push({
      origem: "pedido_em_andamento", id: p.id, pacienteNome: p.pacienteNome, valor: p.valor,
      dataPrevista: null, destino: DESTINOS.pedido_em_andamento,
    });
  }

  const oportunidadesSemValor = input.oportunidadesAbertas.length; // a contagem real (count-only) vem de agregarReceitaPerdida.oportunidades

  const totalComData = itensComData.reduce((soma, i) => soma + i.valor, 0);
  const totalSemData = itensSemData.reduce((soma, i) => soma + i.valor, 0);

  // ── 3. Em Risco — literalmente o motor já existente, nenhuma lógica
  // de risco reimplementada aqui.
  const emRisco = agregarReceitaPerdida({
    hoje: input.hoje,
    agora: input.agora,
    orcamentosParados: input.orcamentosApresentados.map((o) => ({
      id: o.id, pacienteNome: o.pacienteNome, telefone: o.telefone, procedimento: o.procedimento,
      valor: o.valor, apresentadoEm: o.apresentadoEm,
    })),
    cobrancasAtrasadas: input.cobrancasAbertas.map((c) => ({
      id: c.id, pacienteNome: c.pacienteNome, telefone: c.telefone, descricao: c.descricao,
      valor: c.valor, vencimento: c.vencimento, status: c.status,
    })),
    tratamentosSemRetorno: input.tratamentos.map((t) => ({
      id: t.id, pacienteNome: t.pacienteNome, telefone: t.telefone, tipoTratamento: t.tipoTratamento,
      status: t.status, proximaDataPrevista: t.proximaDataPrevista, updatedAt: t.updatedAt,
      interrompidoEm: t.interrompidoEm, valorEstimado: t.valorEstimado,
    })),
    pedidosNaoConcluidos: input.pedidosAbertos.map((p) => ({
      id: p.id, pacienteNome: p.pacienteNome, telefone: p.telefone, descricao: p.descricao,
      valor: p.valor, criadoEm: p.criadoEm,
    })),
    oportunidadesAbertas: input.oportunidadesAbertas,
  });

  return {
    hoje: input.hoje,
    horizonteFim,
    confirmadoProgramado: { total: totalConfirmado, itens: itensConfirmados },
    emPerspectiva: { totalComData, totalSemData, itensComData, itensSemData, oportunidadesSemValor },
    totalEsperado30Dias: totalConfirmado + totalComData + totalSemData,
    emRisco,
  };
}
