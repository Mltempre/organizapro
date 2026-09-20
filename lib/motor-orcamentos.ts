// ── Motor de Orçamentos — máquina de estados e score de oportunidade ──────
//
// Domínio puro (sem DB/HTTP), portado do motor equivalente já homologado e
// em produção real (public.orcamentos, Motor de Conversão — Etapa 3).
// Contrato de tipos/estados abaixo foi conferido campo a campo contra o
// dump de schema real de Production (schema-producao-organizapro-
// 20260919.sql) — nenhum campo, estado ou constraint foi inventado aqui.
//
// Escopo deliberadamente mínimo, igual ao original: este motor não gera
// orçamento, não calcula preço, não envia nada automaticamente. Só
// registra um orçamento já apresentado pela equipe e identifica quando ele
// fica parado sem decisão.

export type StatusOrcamento = "apresentado" | "aprovado" | "recusado" | "expirado";

export type MotivoDecisao = "preco" | "vai_pensar" | "sem_interesse" | "fechou_em_outro_lugar" | "outro";

export const MOTIVOS_DECISAO: MotivoDecisao[] = ["preco", "vai_pensar", "sem_interesse", "fechou_em_outro_lugar", "outro"];

export interface Orcamento {
  id: string;
  clinica_id: string;
  paciente_nome: string;
  telefone: string | null;
  procedimento: string;
  valor: number;
  status: StatusOrcamento;
  motivo_decisao: MotivoDecisao | null;
  observacao: string | null;
  created_by: string | null;
  apresentado_em: string;
  decidido_em: string | null;
  criado_em: string;
  updated_at: string;
}

// ─── Máquina de estados ────────────────────────────────────────────────
// apresentado -> {aprovado, recusado, expirado}. Todos os três são
// terminais — nunca transicionam de novo, nem entre si, nem de volta.
// Reabrir significa criar um orçamento NOVO, nunca reverter um existente.

const TERMINAIS: StatusOrcamento[] = ["aprovado", "recusado", "expirado"];

export function transicaoValida(atual: StatusOrcamento, novo: StatusOrcamento): boolean {
  if (TERMINAIS.includes(atual)) return false;
  if (novo === atual) return false;
  return atual === "apresentado" && TERMINAIS.includes(novo);
}

export interface AtualizacaoTransicao {
  status: StatusOrcamento;
  decidido_em: string;
  motivo_decisao: MotivoDecisao | null;
}

export function transicionar(
  orcamentoAtual: Pick<Orcamento, "status">,
  novoStatus: StatusOrcamento,
  motivoDecisao: MotivoDecisao | null | undefined,
  agora: string
): AtualizacaoTransicao | null {
  if (!transicaoValida(orcamentoAtual.status, novoStatus)) return null;
  return {
    status: novoStatus,
    decidido_em: agora,
    motivo_decisao: motivoDecisao ?? null,
  };
}

// ─── Score de oportunidade ────────────────────────────────────────────
// Combina três fatores reais, cada um normalizado 0–1, sem nenhum número
// inventado: há quanto tempo está parado, o peso relativo do valor
// (comparado aos outros orçamentos abertos da mesma clínica — nunca uma
// escala fixa arbitrária), e se o mesmo paciente tem outros orçamentos
// abertos. Pesos documentados e ajustáveis, nunca escondidos.
//
// Só se aplica a orçamentos em 'apresentado' — um orçamento decidido não
// tem "oportunidade" a calcular.

const DIAS_PARA_PARADO_TOTAL = 14; // a partir daqui, o fator "dias parado" satura em 1
const PESO_DIAS = 0.4;
const PESO_VALOR = 0.4;
const PESO_RECORRENCIA = 0.2;

export interface EntradaScoreOportunidade {
  diasParado: number;
  valor: number;
  valorMaximoEntreAbertos: number; // maior valor entre TODOS os orçamentos 'apresentado' da clínica no momento do cálculo
  quantidadeAbertosDoMesmoPaciente: number; // incluindo este — 1 = só este mesmo
}

export function calcularScoreOportunidade(e: EntradaScoreOportunidade): number {
  const normDias = Math.min(Math.max(e.diasParado, 0) / DIAS_PARA_PARADO_TOTAL, 1);
  const normValor = e.valorMaximoEntreAbertos > 0 ? Math.min(Math.max(e.valor, 0) / e.valorMaximoEntreAbertos, 1) : 0;
  const normRecorrencia = Math.min(Math.max(e.quantidadeAbertosDoMesmoPaciente - 1, 0) / 2, 1); // 3+ orçamentos abertos do mesmo paciente já satura
  const score = PESO_DIAS * normDias + PESO_VALOR * normValor + PESO_RECORRENCIA * normRecorrencia;
  return Math.round(score * 100);
}

export function diasParado(apresentadoEm: string, agora: string): number {
  const ms = new Date(agora).getTime() - new Date(apresentadoEm).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// Limite documentado e ajustável a partir do qual um orçamento 'apresentado'
// conta como "parado" (mais curto de propósito que o teto de saturação do
// score acima — esse é o limite pra virar sinal/alerta).
export const DIAS_PARA_CONSIDERAR_PARADO = 3;

export function estaParado(apresentadoEm: string, agora: string): boolean {
  return diasParado(apresentadoEm, agora) >= DIAS_PARA_CONSIDERAR_PARADO;
}

// ─── Indicadores reais — nunca estimados ──────────────────────────────
export interface IndicadoresOrcamentos {
  taxaAprovacao: number | null; // aprovados / (aprovados + recusados) — null sem decisões ainda
  tempoMedioDecisaoDias: number | null; // média de (decidido_em - apresentado_em) entre os decididos, null sem decisões
  quantidadeParada: number; // 'apresentado' há >= DIAS_PARA_CONSIDERAR_PARADO dias
  idadeMediaPendentesDias: number | null; // média de dias parado entre os 'apresentado', null sem pendentes
}

export function calcularIndicadoresOrcamentos(orcamentos: Orcamento[], agora: string): IndicadoresOrcamentos {
  const decididos = orcamentos.filter((o) => o.status === "aprovado" || o.status === "recusado");
  const aprovados = orcamentos.filter((o) => o.status === "aprovado");
  const pendentes = orcamentos.filter((o) => o.status === "apresentado");

  const taxaAprovacao = decididos.length > 0 ? aprovados.length / decididos.length : null;

  const temposDecisao = decididos
    .filter((o) => o.decidido_em)
    .map((o) => (new Date(o.decidido_em!).getTime() - new Date(o.apresentado_em).getTime()) / 86_400_000);
  const tempoMedioDecisaoDias = temposDecisao.length > 0
    ? Math.round((temposDecisao.reduce((s, v) => s + v, 0) / temposDecisao.length) * 10) / 10
    : null;

  const quantidadeParada = pendentes.filter((o) => estaParado(o.apresentado_em, agora)).length;

  const idadesPendentes = pendentes.map((o) => diasParado(o.apresentado_em, agora));
  const idadeMediaPendentesDias = idadesPendentes.length > 0
    ? Math.round((idadesPendentes.reduce((s, v) => s + v, 0) / idadesPendentes.length) * 10) / 10
    : null;

  return { taxaAprovacao, tempoMedioDecisaoDias, quantidadeParada, idadeMediaPendentesDias };
}
