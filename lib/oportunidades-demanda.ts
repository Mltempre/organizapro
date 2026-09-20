export const OPORTUNIDADE_STATUS = [
  "sinalizada",
  "em_contato",
  "agendada",
  "atendida",
  "convertida",
  "perdida",
  "expirada",
] as const;

export type OportunidadeStatus = (typeof OPORTUNIDADE_STATUS)[number];

export type NovaOportunidade = {
  canal: "whatsapp" | "manual" | "site";
  identificador_canal?: string | null;
  telefone: string;
  nome_informado?: string | null;
  confianca_classificacao: "alta" | "media" | "baixa";
  evidencia_bruta?: string | null;
  contexto_classificacao?: Record<string, unknown>;
  expira_em: string;
  chave_idempotencia: string;
};

const TRANSICOES: Record<OportunidadeStatus, readonly OportunidadeStatus[]> = {
  sinalizada: ["em_contato", "perdida", "expirada"],
  em_contato: ["agendada", "perdida", "expirada"],
  agendada: ["atendida", "perdida", "expirada"],
  atendida: ["convertida", "perdida"],
  convertida: [],
  perdida: [],
  expirada: [],
};

export function transicaoPermitida(
  atual: OportunidadeStatus,
  proximo: OportunidadeStatus
): boolean {
  return atual === proximo || TRANSICOES[atual].includes(proximo);
}

export function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

export function validarNovaOportunidade(input: NovaOportunidade): string | null {
  if (!input.telefone.trim() || normalizarTelefone(input.telefone).length < 8) {
    return "telefone inválido";
  }
  if (!input.chave_idempotencia.trim()) return "chave_idempotencia obrigatória";
  if (input.evidencia_bruta && input.evidencia_bruta.length > 500) {
    return "evidencia_bruta deve ter no máximo 500 caracteres";
  }
  return null;
}

// ── Passagem Oportunidade → Orçamento (última milha) ────────────────────
// Uma oportunidade só pode gerar um orçamento quando ainda está aberta
// (não terminal) e ainda não tem um orçamento vinculado — impede que duas
// requisições (ou um duplo clique) produzam dois orçamentos para a mesma
// oportunidade. `orcamento_vinculado_id` é o único fato que decide isso;
// nunca inferido a partir do status.
const STATUS_TERMINAIS: readonly OportunidadeStatus[] = ["convertida", "perdida", "expirada"];

export function oportunidadeElegivelParaOrcamento(op: {
  status: OportunidadeStatus;
  orcamento_vinculado_id: string | null;
}): boolean {
  if (op.orcamento_vinculado_id !== null) return false;
  return !STATUS_TERMINAIS.includes(op.status);
}