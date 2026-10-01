// ── Venda/Execução — Pedidos como estrutura única de venda ──────────────
//
// No OrganizaPro, public.pedidos é a única estrutura de "venda fechada".
// Um pedido tem DUAS dimensões independentes:
//   - comercial/pagamento: pedidos.status (lib/motor-pedidos.ts) — intocada;
//   - execução: pedidos.execucao_status (este arquivo) — o acompanhamento
//     que antes vivia em public.tratamentos ("Serviços contratados").
// "Serviço concluído" nunca significa "pagamento recebido", e vice-versa.
//
// Domínio puro (sem DB/HTTP). A máquina de execução é a mesma de
// lib/motor-tratamento.ts (mesmos estados, mesmos motivos, mesmos sinais
// precisaRetorno/diasSemAtividade/diasInterrompido), adaptada a venda:
//   - início: uma venda passa a ser acompanhada em "em_andamento";
//   - em_andamento -> concluido direto (serviço pontual), além dos
//     caminhos originais (retorno_agendado -> concluido; interrompido ->
//     abandonado). Sem regressões, nunca.
//
// Leitores (Receita Perdida, Follow-up, Previsor, Dinheiro, Radar...) não
// ganham regra nova: recebem as vendas em acompanhamento no MESMO formato
// de linha que já consumiam de public.tratamentos (acompanhamentoDaVenda),
// com o id do PEDIDO. particionarVendas garante que cada venda entre uma
// única vez no dinheiro.

import { MOTIVOS_INTERRUPCAO, type MotivoInterrupcao, type Tratamento } from "./motor-tratamento";
import type { PedidoStatus } from "./motor-pedidos";

export type ExecucaoStatus = "em_andamento" | "retorno_agendado" | "concluido" | "interrompido" | "abandonado";
export const EXECUCAO_STATUS: ExecucaoStatus[] = ["em_andamento", "retorno_agendado", "concluido", "interrompido", "abandonado"];
/** Execução que ainda pede acompanhamento (gera sinais de retorno/interrupção). */
export const EXECUCAO_ATIVA: ExecucaoStatus[] = ["em_andamento", "retorno_agendado", "interrompido"];
export { MOTIVOS_INTERRUPCAO, type MotivoInterrupcao };

export const ROTULO_EXECUCAO: Record<ExecucaoStatus, string> = {
  em_andamento: "Em andamento",
  retorno_agendado: "Retorno agendado",
  concluido: "Concluído",
  interrompido: "Interrompido",
  abandonado: "Abandonado",
};

// null = venda ainda sem acompanhamento de execução.
const TRANSICOES_EXECUCAO: Record<ExecucaoStatus | "sem_execucao", ExecucaoStatus[]> = {
  sem_execucao: ["em_andamento"],
  em_andamento: ["retorno_agendado", "concluido", "interrompido"],
  retorno_agendado: ["concluido"],
  interrompido: ["abandonado"],
  concluido: [],
  abandonado: [],
};

export function transicaoExecucaoValida(atual: ExecucaoStatus | null, novo: ExecucaoStatus): boolean {
  if (novo === atual) return false;
  return TRANSICOES_EXECUCAO[atual ?? "sem_execucao"].includes(novo);
}

export function proximosStatusExecucao(atual: ExecucaoStatus | null): ExecucaoStatus[] {
  return TRANSICOES_EXECUCAO[atual ?? "sem_execucao"];
}

export interface AtualizacaoExecucao {
  execucao_status: ExecucaoStatus;
  execucao_concluida_em?: string;
  execucao_interrompida_em?: string;
  execucao_abandonada_em?: string;
  motivo_interrupcao?: MotivoInterrupcao | null;
  proxima_data_prevista?: string | null;
}

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mesma regra de lib/motor-tratamento.ts#transicionar, aplicada à execução
 * de uma venda. Retorno agendado exige a data real do retorno (sem data
 * não há retorno agendado — seria "sem retorno"). Venda cancelada não tem
 * execução a acompanhar.
 */
export function transicionarExecucao(
  pedido: { status: PedidoStatus; execucao_status: ExecucaoStatus | null },
  novo: ExecucaoStatus,
  opcoes: { motivoInterrupcao?: MotivoInterrupcao | null; proximaDataPrevista?: string | null } | undefined,
  agora: string
): AtualizacaoExecucao | null {
  if (pedido.status === "cancelado") return null;
  if (!transicaoExecucaoValida(pedido.execucao_status, novo)) return null;
  const atualizacao: AtualizacaoExecucao = { execucao_status: novo };
  if (novo === "concluido") atualizacao.execucao_concluida_em = agora;
  if (novo === "interrompido") {
    atualizacao.execucao_interrompida_em = agora;
    atualizacao.motivo_interrupcao = opcoes?.motivoInterrupcao ?? null;
  }
  if (novo === "abandonado") atualizacao.execucao_abandonada_em = agora;
  if (novo === "retorno_agendado") {
    const data = opcoes?.proximaDataPrevista ?? null;
    if (!data || !REGEX_DATA.test(data)) return null;
    atualizacao.proxima_data_prevista = data;
  }
  return atualizacao;
}

// ── Formato de leitura ──────────────────────────────────────────────────

export type ItemDaVenda = { descricao: string; quantidade: number };

/** Linha de public.pedidos como as APIs devolvem (colunas novas opcionais: antes da migration elas não existem). */
export type PedidoVenda = {
  id: string;
  clinica_id: string;
  paciente_id: string | null;
  nome_cliente: string;
  telefone: string | null;
  valor_centavos: number;
  status: PedidoStatus;
  origem?: string;
  observacao?: string | null;
  criado_por?: string | null;
  criado_em: string;
  updated_at?: string | null;
  pagamento_confirmado_em?: string | null;
  orcamento_origem_id?: string | null;
  tratamento_legado_id?: string | null;
  execucao_status?: ExecucaoStatus | null;
  proxima_data_prevista?: string | null;
  motivo_interrupcao?: MotivoInterrupcao | null;
  execucao_concluida_em?: string | null;
  execucao_interrompida_em?: string | null;
  execucao_abandonada_em?: string | null;
  pedido_itens?: ItemDaVenda[] | null;
};

/** Cobrança vista só pelo vínculo com a venda. */
export type CobrancaDaVenda = { pedido_origem_id?: string | null; status: string };

/** "2× Pneu + 1× Mão de obra" — o que foi vendido, a partir dos itens reais. */
export function descricaoDaVenda(p: Pick<PedidoVenda, "pedido_itens">): string {
  const itens = (p.pedido_itens ?? []).filter((i) => i.descricao?.trim());
  if (itens.length === 0) return "Venda";
  return itens.map((i) => (i.quantidade > 1 ? `${i.quantidade}× ${i.descricao.trim()}` : i.descricao.trim())).join(" + ");
}

/**
 * A venda em acompanhamento no MESMO formato de linha de public.tratamentos
 * — o id é o do PEDIDO. Só existe para venda com execução e não cancelada.
 */
export function acompanhamentoDaVenda(p: PedidoVenda): Tratamento | null {
  if (!p.execucao_status || p.status === "cancelado") return null;
  return {
    id: p.id,
    clinica_id: p.clinica_id,
    paciente_id: p.paciente_id,
    paciente_nome: p.nome_cliente,
    paciente_telefone: p.telefone,
    orcamento_origem_id: p.orcamento_origem_id ?? null,
    tipo_tratamento: descricaoDaVenda(p),
    status: p.execucao_status,
    motivo_interrupcao: p.motivo_interrupcao ?? null,
    proxima_data_prevista: p.proxima_data_prevista ?? null,
    valor_estimado: p.valor_centavos / 100,
    observacao: p.observacao ?? null,
    created_by: p.criado_por ?? null,
    iniciado_em: p.criado_em,
    concluido_em: p.execucao_concluida_em ?? null,
    interrompido_em: p.execucao_interrompida_em ?? null,
    abandonado_em: p.execucao_abandonada_em ?? null,
    created_at: p.criado_em,
    updated_at: p.updated_at ?? p.criado_em,
  };
}

/** Vendas que já têm cobrança vinculada (cobrança cancelada não conta). */
export function vendasComCobranca(cobrancas: CobrancaDaVenda[]): Set<string> {
  return new Set(
    cobrancas
      .filter((c) => c.status !== "cancelada")
      .map((c) => c.pedido_origem_id)
      .filter((id): id is string => !!id)
  );
}

const STATUS_A_RECEBER: PedidoStatus[] = ["criado", "confirmado", "aguardando_confirmacao_pagamento"];

export type PartesDasVendas<P extends PedidoVenda> = {
  /** Sinais de RELACIONAMENTO (sem retorno, interrompido): toda venda com execução ativa, paga ou não. */
  acompanhamentos: Tratamento[];
  /** DINHEIRO pelo caminho da execução: execução ativa, ainda não paga e sem cobrança vinculada. */
  acompanhamentosAReceber: Tratamento[];
  /** DINHEIRO pelo caminho do pedido: em aberto, sem cobrança vinculada e sem execução ativa. */
  pedidosAReceber: P[];
};

/**
 * Regra única anti-dupla contagem da venda. No dinheiro, cada venda entra
 * UMA vez, por um único caminho:
 *   - cancelada ou paga ............ fora (paga já é receita);
 *   - com cobrança vinculada ....... fora (a cobrança é quem conta);
 *   - execução ativa ............... caminho de execução (sem retorno, retorno agendado);
 *   - demais em aberto ............. caminho de pedido (não concluído / em andamento).
 * acompanhamentosAReceber e pedidosAReceber nunca têm um id em comum.
 */
export function particionarVendas<P extends PedidoVenda>(pedidos: P[], cobrancas: CobrancaDaVenda[]): PartesDasVendas<P> {
  const comCobranca = vendasComCobranca(cobrancas);
  const acompanhamentos: Tratamento[] = [];
  const acompanhamentosAReceber: Tratamento[] = [];
  const pedidosAReceber: P[] = [];
  for (const p of pedidos) {
    if (p.status === "cancelado") continue;
    const ativa = !!p.execucao_status && EXECUCAO_ATIVA.includes(p.execucao_status);
    const acompanhamento = ativa ? acompanhamentoDaVenda(p) : null;
    if (acompanhamento) acompanhamentos.push(acompanhamento);
    if (p.status === "pago" || comCobranca.has(p.id)) continue;
    if (acompanhamento) acompanhamentosAReceber.push(acompanhamento);
    else if (STATUS_A_RECEBER.includes(p.status)) pedidosAReceber.push(p);
  }
  return { acompanhamentos, acompanhamentosAReceber, pedidosAReceber };
}

/** Pedido pago conta como receita só quando NÃO tem cobrança vinculada (senão quem conta é a cobrança). */
export function pedidoPagoContaComoReceita(p: Pick<PedidoVenda, "id" | "status">, comCobranca: Set<string>): boolean {
  return p.status === "pago" && !comCobranca.has(p.id);
}
