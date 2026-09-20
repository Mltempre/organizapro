// ── Motor de Cobrança — etapa "receita" da cadeia orçamento → venda → receita ──
//
// Domínio puro (sem DB/HTTP), portado do motor equivalente já homologado e
// em produção real (public.cobrancas, Radar de Inadimplência + Cobrança
// Inteligente — Etapa 5). Contrato conferido campo a campo contra o schema
// real de Production. NÃO confundir com lib/cobranca-state-machine.ts (8
// estados, tabela `pagamentos` inexistente) do branch audit/smart-commerce-
// precheck — aquele é o modelo paralelo incompatível já identificado em
// missões anteriores como "NÃO reativar"; este arquivo é a fonte canônica.
//
// Não é módulo financeiro/ERP: representa valor pendente, vencimento,
// atraso, cobrança e pagamento — nada além disso.

export type StatusCobranca = "pendente" | "em_cobranca" | "pago" | "cancelada";

export type MotivoCancelamento = "negociado" | "erro_lancamento" | "paciente_nao_localizado" | "inadimplencia_assumida" | "outro";

export const MOTIVOS_CANCELAMENTO: MotivoCancelamento[] = ["negociado", "erro_lancamento", "paciente_nao_localizado", "inadimplencia_assumida", "outro"];

export interface Cobranca {
  id: string;
  clinica_id: string;
  paciente_id: string | null;
  paciente_nome: string;
  paciente_telefone: string | null;
  tratamento_origem_id: string | null;
  descricao: string;
  valor: number;
  vencimento: string; // date, "AAAA-MM-DD"
  status: StatusCobranca;
  valor_pago: number | null;
  motivo_cancelamento: MotivoCancelamento | null;
  observacao: string | null;
  created_by: string | null;
  em_cobranca_em: string | null;
  pago_em: string | null;
  cancelado_em: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Máquina de estados ────────────────────────────────────────────────
// pendente -> em_cobranca -> pago (terminal); pendente -> pago direto
// (pagamento sem cobrança ativa); pendente/em_cobranca -> cancelada
// (terminal). Sem regressões, nunca. Reabrir uma cobrança paga/cancelada
// significa criar uma cobrança NOVA, nunca reverter a existente.

const TRANSICOES_VALIDAS: Record<StatusCobranca, StatusCobranca[]> = {
  pendente: ["em_cobranca", "pago", "cancelada"],
  em_cobranca: ["pago", "cancelada"],
  pago: [],
  cancelada: [],
};

export function transicaoValida(atual: StatusCobranca, novo: StatusCobranca): boolean {
  if (novo === atual) return false;
  return TRANSICOES_VALIDAS[atual].includes(novo);
}

export interface AtualizacaoTransicaoCobranca {
  status: StatusCobranca;
  em_cobranca_em?: string;
  pago_em?: string;
  valor_pago?: number;
  cancelado_em?: string;
  motivo_cancelamento?: MotivoCancelamento | null;
}

export function transicionar(
  cobrancaAtual: Pick<Cobranca, "status" | "valor">,
  novoStatus: StatusCobranca,
  opcoes: { valorPago?: number; motivoCancelamento?: MotivoCancelamento | null } | undefined,
  agora: string
): AtualizacaoTransicaoCobranca | null {
  if (!transicaoValida(cobrancaAtual.status, novoStatus)) return null;

  const atualizacao: AtualizacaoTransicaoCobranca = { status: novoStatus };
  if (novoStatus === "em_cobranca") {
    atualizacao.em_cobranca_em = agora;
  }
  if (novoStatus === "pago") {
    const valorPago = opcoes?.valorPago ?? cobrancaAtual.valor;
    if (!Number.isFinite(valorPago) || valorPago < 0) return null;
    atualizacao.pago_em = agora;
    atualizacao.valor_pago = valorPago;
  }
  if (novoStatus === "cancelada") {
    atualizacao.cancelado_em = agora;
    atualizacao.motivo_cancelamento = opcoes?.motivoCancelamento ?? null;
  }
  return atualizacao;
}

// ─── Atraso — sempre derivado de vencimento, nunca do status ───────────

export function estaAtrasada(vencimento: string, hoje: string): boolean {
  return vencimento < hoje;
}

export function diasAtraso(vencimento: string, hoje: string): number {
  if (vencimento >= hoje) return 0;
  const ms = new Date(`${hoje}T00:00:00Z`).getTime() - new Date(`${vencimento}T00:00:00Z`).getTime();
  return Math.floor(ms / 86_400_000);
}

export const DIAS_ATRASO_LONGO = 30;

// ─── Receita Recuperada — evidência objetiva, nunca todo pagamento ─────
// "Recuperada" exige: pagou depois do vencimento (dinheiro esteve em
// risco), ou passou por entrada explícita em cobrança antes de pagar.
export function foiRecuperada(c: Pick<Cobranca, "status" | "vencimento" | "pago_em" | "em_cobranca_em">): boolean {
  if (c.status !== "pago" || !c.pago_em) return false;
  const pagoEmData = c.pago_em.split("T")[0];
  return pagoEmData > c.vencimento || c.em_cobranca_em !== null;
}

// ─── Score de atenção — três fatores reais, nunca inventado ───────────

const DIAS_ATRASO_PARA_SATURAR = 30;
const PESO_DIAS = 0.4;
const PESO_VALOR = 0.4;
const PESO_RECORRENCIA = 0.2;

export interface EntradaScoreCobranca {
  diasAtraso: number;
  valor: number;
  valorMaximoEntreAbertas: number;
  quantidadeAbertasDoMesmoPaciente: number;
}

export function calcularScoreCobranca(e: EntradaScoreCobranca): number {
  const normDias = Math.min(Math.max(e.diasAtraso, 0) / DIAS_ATRASO_PARA_SATURAR, 1);
  const normValor = e.valorMaximoEntreAbertas > 0 ? Math.min(Math.max(e.valor, 0) / e.valorMaximoEntreAbertas, 1) : 0;
  const normRecorrencia = Math.min(Math.max(e.quantidadeAbertasDoMesmoPaciente - 1, 0) / 2, 1);
  const score = PESO_DIAS * normDias + PESO_VALOR * normValor + PESO_RECORRENCIA * normRecorrencia;
  return Math.round(score * 100);
}

// ─── Indicadores reais — nunca estimados ──────────────────────────────
export interface IndicadoresCobranca {
  valorEmAberto: number | null;
  valorEmAtraso: number | null;
  quantidadeEmCobranca: number;
  valorRecebidoMes: number | null;
  valorRecuperadoMes: number | null;
  quantidadeRecuperadasMes: number;
  valorRecebidoTotal: number | null;
  valorRecuperadoTotal: number | null;
  taxaRecebimento: number | null;
  proporcaoValorAtrasado: number | null;
  quantidadeAtrasadaLonga: number;
}

function mesmoMes(isoA: string, isoB: string): boolean {
  return isoA.slice(0, 7) === isoB.slice(0, 7);
}

export function calcularIndicadoresCobranca(cobrancas: Cobranca[], agora: string): IndicadoresCobranca {
  const hoje = agora.split("T")[0];

  const abertas = cobrancas.filter((c) => c.status === "pendente" || c.status === "em_cobranca");
  const atrasadasAbertas = abertas.filter((c) => estaAtrasada(c.vencimento, hoje));
  const emCobranca = cobrancas.filter((c) => c.status === "em_cobranca");
  const pagas = cobrancas.filter((c) => c.status === "pago");
  const canceladas = cobrancas.filter((c) => c.status === "cancelada");

  const somar = (lista: Cobranca[], campo: "valor" | "valor_pago"): number | null => {
    if (lista.length === 0) return null;
    return lista.reduce((soma, c) => soma + (Number(c[campo]) || 0), 0);
  };

  const valorEmAberto = somar(abertas, "valor");
  const valorEmAtraso = somar(atrasadasAbertas, "valor");

  const pagasNoMes = pagas.filter((c) => c.pago_em && mesmoMes(c.pago_em, agora));
  const recuperadas = pagas.filter((c) => foiRecuperada(c));
  const recuperadasNoMes = pagasNoMes.filter((c) => foiRecuperada(c));

  const valorRecebidoMes = somar(pagasNoMes, "valor_pago");
  const valorRecuperadoMes = somar(recuperadasNoMes, "valor_pago");
  const valorRecebidoTotal = somar(pagas, "valor_pago");
  const valorRecuperadoTotal = somar(recuperadas, "valor_pago");

  const totalDesfechos = pagas.length + canceladas.length;
  const taxaRecebimento = totalDesfechos > 0 ? pagas.length / totalDesfechos : null;

  const proporcaoValorAtrasado = valorEmAberto !== null && valorEmAberto > 0
    ? (valorEmAtraso ?? 0) / valorEmAberto
    : null;

  const quantidadeAtrasadaLonga = atrasadasAbertas.filter((c) => diasAtraso(c.vencimento, hoje) > DIAS_ATRASO_LONGO).length;

  return {
    valorEmAberto,
    valorEmAtraso,
    quantidadeEmCobranca: emCobranca.length,
    valorRecebidoMes,
    valorRecuperadoMes,
    quantidadeRecuperadasMes: recuperadasNoMes.length,
    valorRecebidoTotal,
    valorRecuperadoTotal,
    taxaRecebimento,
    proporcaoValorAtrasado,
    quantidadeAtrasadaLonga,
  };
}
