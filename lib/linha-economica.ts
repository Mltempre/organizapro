// ── Linha Econômica / Prova de Resultado V1 ─────────────────────────────
// Responde: "qual resultado financeiro REAL conseguimos provar a partir
// dos eventos e entidades do OrganizaPro?" Domínio puro (sem DB/HTTP),
// mesma filosofia de lib/receita-perdida.ts e lib/previsor-faturamento.ts:
// NUNCA um motor financeiro novo, NUNCA um segundo sistema de eventos —
// reusa literalmente foiRecuperada (lib/motor-cobranca.ts) para a prova
// de recuperação, e os mesmos vínculos reais já usados em todo o produto
// (tratamento_origem_id, orcamento_origem_id, orcamento_vinculado_id).
//
// ── Patrimônio investigado e NÃO reutilizado, por quê ────────────────────
// oportunidades_demanda.receita_atribuida / receita_fonte / receita_
// atribuida_em / a mesma tríade em public.indicacoes: colunas REAIS no
// schema de produção (schema-producao-organizapro-20260919.sql linhas
// 718-720 e 748-750), mas NENHUM código do produto (grep confirmado em
// app/ e lib/) jamais escreve nelas — são lidas (SELECT) mas nunca
// preenchidas. Contam-se como "sem evidência" nesta V1: usar um campo
// sempre nulo como base de atribuição seria fail-closed por acidente,
// não por desenho. public.indicacoes (programa de indicação) também não
// tem nenhum código que a leia ou escreva — patrimônio de schema
// totalmente dormente, não é usado aqui.
// oportunidades_demanda.paciente_vinculado_id: mesmo caso — só lido,
// nunca escrito. lib/origem-persistencia.ts (origem_captacoes) já
// documenta explicitamente que aquela tabela é PROPOSTA e NÃO existe
// ainda em produção (migration não executada) — por isso esta V1 não
// tenta ler origem_captacoes: tentar seria sempre falhar silenciosamente
// sem nenhum valor demonstrável hoje. Quando essa migration rodar (fora
// desta missão), a Linha Econômica pode ganhar uma segunda dimensão
// (canal de marketing/UTM) sem precisar mudar a regra de atribuição
// abaixo — só passaria a enriquecer a trilha, nunca substituir o vínculo
// técnico já usado.
//
// ── O que É reutilizado, porque está ativo e populado hoje ──────────────
// oportunidades_demanda.orcamento_vinculado_id: setado de verdade por
// POST /api/oportunidades/[id]/gerar-orcamento, 1:1, idempotente
// (guarda de banco .is("orcamento_vinculado_id", null)) — único vínculo
// oportunidade->orçamento realmente ativo no produto hoje.
// oportunidades_demanda.canal ("whatsapp"|"manual"|"site"): campo
// obrigatório (NOT NULL), sempre presente — usado aqui como a dimensão
// real de origem (nunca um UTM/Ads inferido).
// tratamentos.orcamento_origem_id e cobrancas.tratamento_origem_id:
// vínculos reais já usados em toda a cadeia orçamento->venda->receita.
// foiRecuperada (lib/motor-cobranca.ts): já prova "era uma cobrança
// atrasada e foi paga depois" — reusado sem reimplementar.
//
// ── Anti-duplicação (regra de precedência) ───────────────────────────────
// Só o ESTÁGIO TERMINAL contribui para qualquer total em dinheiro:
// cobrancas.valor_pago (status='pago') ou pedidos.valor (status='pago').
// orcamentos.valor e tratamentos.valor_estimado NUNCA são somados aqui —
// servem só para RASTREAR a cadeia (metadado), nunca para contar dinheiro.
// Isso torna dupla contagem estruturalmente impossível: um mesmo real
// nunca é somado em dois estágios, porque só o estágio terminal soma.
//
// ── Três categorias, nunca confundidas ───────────────────────────────────
// A) COMPROVADO: toda cobrança 'pago' + todo pedido 'pago' SEM cobrança
//    vinculada (venda com cobrança conta só pela cobrança — nunca duas
//    receitas para a mesma venda; lib/venda-execucao.ts).
// B) ATRIBUÍVEL (subconjunto de A): cobranças/pedidos 'pago' cuja cadeia
//    oportunidade->orçamento->venda(pedido)->cobrança é 100% rastreável
//    pelos vínculos reais (pedidos.orcamento_origem_id,
//    cobrancas.pedido_origem_id; tratamento_origem_id só no legado).
// C) NÃO ATRIBUÍVEL = COMPROVADO − ATRIBUÍVEL (nunca uma fonte de dado
//    separada — é sempre o resto do mesmo total real).
// Nenhuma correlação vira causalidade: uma cadeia completa prova só que
// o vínculo técnico existe (registro real aponta pra registro real),
// nunca que "a IA gerou essa venda" — os textos da UI devem dizer
// "rastreável até a oportunidade", nunca "gerado pela IA".

import { foiRecuperada, type StatusCobranca } from "./motor-cobranca";
import type { StatusOrcamento } from "./motor-orcamentos";
import type { StatusTratamento } from "./motor-tratamento";
import type { OportunidadeStatus } from "./oportunidades-demanda";

export type CanalOportunidade = "whatsapp" | "manual" | "site";

export type OportunidadeParaLinhaEconomica = {
  id: string;
  canal: CanalOportunidade;
  status: OportunidadeStatus;
  orcamentoVinculadoId: string | null;
};

export type OrcamentoParaLinhaEconomica = {
  id: string;
  status: StatusOrcamento;
  valor: number;
  apresentadoEm: string; // timestamptz ISO
  decididoEm: string | null;
};

export type TratamentoParaLinhaEconomica = {
  id: string;
  orcamentoOrigemId: string | null;
  status: StatusTratamento;
};

export type CobrancaParaLinhaEconomica = {
  id: string;
  pacienteNome: string;
  tratamentoOrigemId: string | null; // vínculo legado (Serviços contratados)
  pedidoOrigemId?: string | null; // venda de origem — com ele, a receita da venda conta SÓ pela cobrança
  status: StatusCobranca;
  valor: number;
  valorPago: number | null;
  vencimento: string; // YYYY-MM-DD
  pagoEm: string | null; // timestamptz ISO
  emCobrancaEm: string | null; // timestamptz ISO
};

export type PedidoParaLinhaEconomica = {
  id: string;
  pacienteNome: string;
  status: "criado" | "confirmado" | "aguardando_confirmacao_pagamento" | "pago" | "cancelado";
  valor: number; // já em reais (valor_centavos / 100), resolvido por quem chama
  pagamentoConfirmadoEm: string | null; // timestamptz ISO
  orcamentoOrigemId?: string | null; // venda nascida de orçamento aprovado — torna a cadeia rastreável
};

export type EntradaLinhaEconomica = {
  oportunidades: OportunidadeParaLinhaEconomica[];
  orcamentos: OrcamentoParaLinhaEconomica[];
  tratamentos: TratamentoParaLinhaEconomica[];
  cobrancas: CobrancaParaLinhaEconomica[];
  pedidos: PedidoParaLinhaEconomica[];
};

export type OrigemResultado = "cobranca" | "pedido";

export type EtapaTrilha =
  | { etapa: "oportunidade"; id: string; canal: CanalOportunidade }
  | { etapa: "orcamento"; id: string; diasAteDecisao: number | null }
  | { etapa: "tratamento"; id: string }
  | { etapa: "cobranca"; id: string; recuperada: boolean }
  | { etapa: "pedido"; id: string };

export type ItemResultado = {
  origem: OrigemResultado;
  id: string;
  pacienteNome: string;
  valor: number; // sempre o valor real pago (estágio terminal) — nunca outro estágio
  atribuivel: boolean;
  canalOrigem: CanalOportunidade | null; // só quando atribuivel === true
  oportunidadeId: string | null; // só quando atribuivel === true
  recuperada: boolean; // foiRecuperada real, só relevante para origem==="cobranca"
  trilha: EtapaTrilha[]; // resumo auditável, sempre em ordem cronológica da cadeia
};

export type ResumoPorCanal = {
  canal: CanalOportunidade;
  total: number;
  quantidade: number;
};

export type ResumoLinhaEconomica = {
  totalComprovado: number;
  totalAtribuivel: number;
  totalNaoAtribuivel: number; // sempre totalComprovado - totalAtribuivel
  totalRecuperado: number; // subconjunto de totalComprovado com foiRecuperada real
  quantidadeComprovada: number;
  quantidadeAtribuivel: number;
  cadeiasCompletas: number; // oportunidades cuja trilha chegou a um pagamento comprovado
  cadeiasParciais: number; // oportunidades com orçamento vinculado, mas sem pagamento comprovado ainda
  porCanal: ResumoPorCanal[]; // composição só dos itens ATRIBUÍVEIS — nunca do total comprovado
  itens: ItemResultado[];
};

function diasEntre(de: string, ate: string): number {
  return Math.floor((new Date(ate).getTime() - new Date(de).getTime()) / 86_400_000);
}

/**
 * Gera a linha econômica a partir de dados já buscados pela tela (nenhuma
 * consulta ao banco aqui — mesma filosofia de agregarReceitaPerdida e
 * gerarPrevisorFaturamento). Determinístico: mesma entrada sempre produz
 * o mesmo resultado, nenhuma aleatoriedade, nenhuma chamada a IA.
 */
export function gerarLinhaEconomica(input: EntradaLinhaEconomica): ResumoLinhaEconomica {
  const orcamentosPorId = new Map(input.orcamentos.map((o) => [o.id, o]));
  const tratamentosPorId = new Map(input.tratamentos.map((t) => [t.id, t]));
  const pedidosPorId = new Map(input.pedidos.map((p) => [p.id, p]));
  // Venda com cobrança vinculada (não cancelada): a receita é a da cobrança,
  // nunca a do pedido também — mesma regra de lib/venda-execucao.ts.
  const pedidosComCobranca = new Set(
    input.cobrancas.filter((c) => c.status !== "cancelada").map((c) => c.pedidoOrigemId).filter((id): id is string => !!id)
  );
  const oportunidadePorOrcamentoId = new Map(
    input.oportunidades.filter((op) => op.orcamentoVinculadoId).map((op) => [op.orcamentoVinculadoId as string, op])
  );

  const itens: ItemResultado[] = [];

  // ── Cobranças pagas: comprovado sempre; atribuível quando a cadeia
  // completa (oportunidade -> orçamento -> tratamento -> esta cobrança)
  // é 100% rastreável pelos vínculos reais.
  for (const c of input.cobrancas) {
    if (c.status !== "pago" || c.valorPago === null || !c.pagoEm) continue;

    // Cadeia pela venda (Pedidos = Venda/Execução); vínculo legado com serviço só quando não há venda.
    const venda = c.pedidoOrigemId ? pedidosPorId.get(c.pedidoOrigemId) : undefined;
    const tratamento = !venda && c.tratamentoOrigemId ? tratamentosPorId.get(c.tratamentoOrigemId) : undefined;
    const orcamentoOrigemId = venda ? venda.orcamentoOrigemId : tratamento?.orcamentoOrigemId;
    const orcamento = orcamentoOrigemId ? orcamentosPorId.get(orcamentoOrigemId) : undefined;
    const oportunidade = orcamento ? oportunidadePorOrcamentoId.get(orcamento.id) : undefined;
    const recuperada = foiRecuperada({ status: c.status, vencimento: c.vencimento, pago_em: c.pagoEm, em_cobranca_em: c.emCobrancaEm });

    const trilha: EtapaTrilha[] = [];
    if (oportunidade) trilha.push({ etapa: "oportunidade", id: oportunidade.id, canal: oportunidade.canal });
    if (orcamento) trilha.push({
      etapa: "orcamento", id: orcamento.id,
      diasAteDecisao: orcamento.decididoEm ? diasEntre(orcamento.apresentadoEm, orcamento.decididoEm) : null,
    });
    if (venda) trilha.push({ etapa: "pedido", id: venda.id });
    if (tratamento) trilha.push({ etapa: "tratamento", id: tratamento.id });
    trilha.push({ etapa: "cobranca", id: c.id, recuperada });

    itens.push({
      origem: "cobranca",
      id: c.id,
      pacienteNome: c.pacienteNome,
      valor: c.valorPago,
      atribuivel: !!oportunidade,
      canalOrigem: oportunidade?.canal ?? null,
      oportunidadeId: oportunidade?.id ?? null,
      recuperada,
      trilha,
    });
  }

  // ── Pedidos pagos sem cobrança vinculada: comprovado; atribuível quando
  // a venda nasceu de um orçamento ligado a uma oportunidade (vínculo real).
  for (const p of input.pedidos) {
    if (p.status !== "pago" || !p.pagamentoConfirmadoEm) continue;
    if (pedidosComCobranca.has(p.id)) continue; // a cobrança já conta esta venda
    const orcamento = p.orcamentoOrigemId ? orcamentosPorId.get(p.orcamentoOrigemId) : undefined;
    const oportunidade = orcamento ? oportunidadePorOrcamentoId.get(orcamento.id) : undefined;
    const trilha: EtapaTrilha[] = [];
    if (oportunidade) trilha.push({ etapa: "oportunidade", id: oportunidade.id, canal: oportunidade.canal });
    if (orcamento) trilha.push({
      etapa: "orcamento", id: orcamento.id,
      diasAteDecisao: orcamento.decididoEm ? diasEntre(orcamento.apresentadoEm, orcamento.decididoEm) : null,
    });
    trilha.push({ etapa: "pedido", id: p.id });
    itens.push({
      origem: "pedido",
      id: p.id,
      pacienteNome: p.pacienteNome,
      valor: p.valor,
      atribuivel: !!oportunidade,
      canalOrigem: oportunidade?.canal ?? null,
      oportunidadeId: oportunidade?.id ?? null,
      recuperada: false,
      trilha,
    });
  }

  const totalComprovado = itens.reduce((soma, i) => soma + i.valor, 0);
  const atribuiveis = itens.filter((i) => i.atribuivel);
  const totalAtribuivel = atribuiveis.reduce((soma, i) => soma + i.valor, 0);
  const totalRecuperado = itens.filter((i) => i.recuperada).reduce((soma, i) => soma + i.valor, 0);

  // ── Cadeias: contagem, nunca dinheiro duplicado — cada oportunidade
  // com orçamento vinculado é UMA cadeia, completa (chegou a pagamento
  // comprovado) ou parcial (ainda não).
  const oportunidadesComOrcamento = input.oportunidades.filter((op) => op.orcamentoVinculadoId);
  const oportunidadesComPagamentoComprovado = new Set(
    atribuiveis.map((i) => i.oportunidadeId).filter((id): id is string => !!id)
  );
  const cadeiasCompletas = oportunidadesComPagamentoComprovado.size;
  const cadeiasParciais = oportunidadesComOrcamento.filter((op) => !oportunidadesComPagamentoComprovado.has(op.id)).length;

  const CANAIS: CanalOportunidade[] = ["whatsapp", "manual", "site"];
  const porCanal: ResumoPorCanal[] = CANAIS
    .map((canal) => {
      const doCanal = atribuiveis.filter((i) => i.canalOrigem === canal);
      return { canal, total: doCanal.reduce((s, i) => s + i.valor, 0), quantidade: doCanal.length };
    })
    .filter((g) => g.quantidade > 0);

  return {
    totalComprovado,
    totalAtribuivel,
    totalNaoAtribuivel: totalComprovado - totalAtribuivel,
    totalRecuperado,
    quantidadeComprovada: itens.length,
    quantidadeAtribuivel: atribuiveis.length,
    cadeiasCompletas,
    cadeiasParciais,
    porCanal,
    itens,
  };
}
