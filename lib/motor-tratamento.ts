// ── Motor de Tratamento — continuidade da venda após orçamento aprovado ──
//
// Domínio puro (sem DB/HTTP), portado do motor equivalente já homologado e
// em produção real (public.tratamentos, Motor de Plano de Tratamento —
// Etapa 4). Contrato conferido campo a campo contra o schema real de
// Production antes de portar. Representa a etapa "venda" da cadeia
// orçamento → venda → receita: liga-se a um orçamento aprovado via
// orcamento_origem_id (uuid solto, sem FK física — mesmo padrão já usado
// em todo o schema), mas também aceita entrada avulsa, sem orçamento.
//
// Não é prontuário nem ficha de cliente: acompanha continuidade e responde
// "quem precisa de atenção hoje?".

export type StatusTratamento =
  | "criado" | "em_andamento" | "retorno_agendado" | "concluido" | "interrompido" | "abandonado";

export type MotivoInterrupcao = "desistiu" | "aguardando_decisao" | "financeiro" | "saude" | "outro";

export const MOTIVOS_INTERRUPCAO: MotivoInterrupcao[] = ["desistiu", "aguardando_decisao", "financeiro", "saude", "outro"];

export interface Tratamento {
  id: string;
  clinica_id: string;
  paciente_id: string | null;
  paciente_nome: string;
  paciente_telefone: string | null;
  orcamento_origem_id: string | null;
  tipo_tratamento: string;
  status: StatusTratamento;
  motivo_interrupcao: MotivoInterrupcao | null;
  proxima_data_prevista: string | null;
  valor_estimado: number | null;
  observacao: string | null;
  created_by: string | null;
  iniciado_em: string;
  concluido_em: string | null;
  interrompido_em: string | null;
  abandonado_em: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Máquina de estados ────────────────────────────────────────────────
// criado -> em_andamento -> retorno_agendado -> concluido (terminal), ou
// em_andamento -> interrompido -> abandonado (terminal). Sem regressões,
// nunca — nem entre estados terminais, nem de volta para um anterior.
// Reabrir um tratamento interrompido/abandonado = criar um tratamento
// NOVO, nunca reverter o existente.

const TRANSICOES_VALIDAS: Record<StatusTratamento, StatusTratamento[]> = {
  criado: ["em_andamento"],
  em_andamento: ["retorno_agendado", "interrompido"],
  retorno_agendado: ["concluido"],
  interrompido: ["abandonado"],
  concluido: [],
  abandonado: [],
};

export function transicaoValida(atual: StatusTratamento, novo: StatusTratamento): boolean {
  if (novo === atual) return false;
  return TRANSICOES_VALIDAS[atual].includes(novo);
}

export interface AtualizacaoTransicaoTratamento {
  status: StatusTratamento;
  concluido_em?: string;
  interrompido_em?: string;
  abandonado_em?: string;
  motivo_interrupcao?: MotivoInterrupcao | null;
  proxima_data_prevista?: string | null;
}

export function transicionar(
  tratamentoAtual: Pick<Tratamento, "status">,
  novoStatus: StatusTratamento,
  opcoes: { motivoInterrupcao?: MotivoInterrupcao | null; proximaDataPrevista?: string | null } | undefined,
  agora: string
): AtualizacaoTransicaoTratamento | null {
  if (!transicaoValida(tratamentoAtual.status, novoStatus)) return null;

  const atualizacao: AtualizacaoTransicaoTratamento = { status: novoStatus };
  if (novoStatus === "concluido") atualizacao.concluido_em = agora;
  if (novoStatus === "interrompido") {
    atualizacao.interrompido_em = agora;
    atualizacao.motivo_interrupcao = opcoes?.motivoInterrupcao ?? null;
  }
  if (novoStatus === "abandonado") atualizacao.abandonado_em = agora;
  if (novoStatus === "retorno_agendado") atualizacao.proxima_data_prevista = opcoes?.proximaDataPrevista ?? null;
  return atualizacao;
}

// ─── Sinais de atenção ─────────────────────────────────────────────────

export function diasSemAtividade(atualizadoEm: string, agora: string): number {
  const ms = new Date(agora).getTime() - new Date(atualizadoEm).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function diasInterrompido(interrompidoEm: string, agora: string): number {
  const ms = new Date(agora).getTime() - new Date(interrompidoEm).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// Um tratamento em_andamento "precisa de retorno" quando não tem próxima
// data prevista, ou quando a data prevista já passou.
export function precisaRetorno(t: Pick<Tratamento, "status" | "proxima_data_prevista">, hoje: string): boolean {
  if (t.status !== "em_andamento") return false;
  if (!t.proxima_data_prevista) return true;
  return t.proxima_data_prevista < hoje;
}

const DIAS_SEM_RETORNO_TOTAL = 21;

export function calcularScoreSemRetorno(diasSemRetornoValor: number): number {
  const norm = Math.min(Math.max(diasSemRetornoValor, 0) / DIAS_SEM_RETORNO_TOTAL, 1);
  return Math.round(norm * 100);
}

const DIAS_INTERROMPIDO_TOTAL = 30;

export function calcularScoreInterrompido(diasInterrompidoValor: number): number {
  const norm = Math.min(Math.max(diasInterrompidoValor, 0) / DIAS_INTERROMPIDO_TOTAL, 1);
  return Math.round(50 + norm * 50);
}

// ─── Indicadores reais — nunca estimados ──────────────────────────────
export interface IndicadoresTratamento {
  tratamentosAtivos: number;
  retornosPendentes: number;
  semAcompanhamento: number;
  abandonos: number;
  interrompidosLongos: number;
  idadeMediaAtivosDias: number | null;
  taxaContinuidade: number | null;
  receitaPotencial: number | null;
  receitaConvertida: number | null;
}

export function calcularIndicadoresTratamento(tratamentos: Tratamento[], agora: string): IndicadoresTratamento {
  const hoje = agora.split("T")[0];
  const emAndamento = tratamentos.filter((t) => t.status === "em_andamento");
  const retornoAgendado = tratamentos.filter((t) => t.status === "retorno_agendado");
  const interrompidos = tratamentos.filter((t) => t.status === "interrompido");
  const abandonados = tratamentos.filter((t) => t.status === "abandonado");
  const concluidos = tratamentos.filter((t) => t.status === "concluido");

  const semAcompanhamento = emAndamento.filter((t) => precisaRetorno(t, hoje)).length;
  const interrompidosLongos = interrompidos.filter(
    (t) => t.interrompido_em && diasInterrompido(t.interrompido_em, agora) > DIAS_INTERROMPIDO_TOTAL
  ).length;

  const somarValor = (lista: Tratamento[]): number | null => {
    const comValor = lista.filter((t) => t.valor_estimado !== null);
    if (comValor.length === 0) return null;
    return comValor.reduce((soma, t) => soma + (t.valor_estimado ?? 0), 0);
  };

  const ativos = [...emAndamento, ...retornoAgendado];
  const idadesAtivos = ativos.map((t) => diasSemAtividade(t.updated_at, agora));
  const idadeMediaAtivosDias = idadesAtivos.length > 0
    ? Math.round((idadesAtivos.reduce((s, v) => s + v, 0) / idadesAtivos.length) * 10) / 10
    : null;

  const totalDesfechos = concluidos.length + interrompidos.length + abandonados.length;
  const taxaContinuidade = totalDesfechos > 0 ? concluidos.length / totalDesfechos : null;

  return {
    tratamentosAtivos: ativos.length,
    retornosPendentes: retornoAgendado.length,
    semAcompanhamento,
    abandonos: abandonados.length,
    interrompidosLongos,
    idadeMediaAtivosDias,
    taxaContinuidade,
    receitaPotencial: somarValor(ativos),
    receitaConvertida: somarValor(concluidos),
  };
}
