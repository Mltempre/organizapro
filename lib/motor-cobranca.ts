// ── Cobrador AI · motor de orquestração ──────────────────────────────────
// Ver docs/financeiro-inteligente-cobrador-ai-v1-arquitetura.md. Código
// puro (sem Supabase, sem fetch, sem chamada a LLM real) — a classificação
// de mensagem aqui é determinística (regex), mesma filosofia do
// `lib/motor-demanda.ts` de referência (ClinicaFlow, consultado só como
// arquitetura, nunca copiado): um LLM pode ajudar a redigir texto melhor
// no futuro, mas NUNCA decide uma transição de estado financeiro — só esta
// classificação determinística alimenta `aplicarEvento` em
// lib/cobranca-state-machine.ts.

import {
  type Cobranca,
  promessaExpirada, podeGerarAcaoAutomatica,
} from "./cobranca-state-machine";

// ── Classificação determinística de resposta do cliente ─────────────────

export type TipoRespostaCliente = "informou_pagamento" | "prometeu_pagamento" | "contestou" | "sem_classificacao";

export type RespostaClassificada = {
  tipo:           TipoRespostaCliente;
  dataPrometida:  string | null; // YYYY-MM-DD — só quando tipo === "prometeu_pagamento" e uma data explícita foi encontrada
};

const PADRAO_PAGAMENTO = /\b(j[aá]\s*paguei|paguei\s*(ontem|hoje)?|pagamento\s*(feito|realizado|efetuado)|enviei\s*o\s*(pix|comprovante))\b/i;
const PADRAO_PROMESSA  = /\b(vou\s*pagar|pago\s*(at[eé]|dia|na|no)|assim\s*que\s*(eu\s*)?receber|prometo\s*pagar)\b/i;
const PADRAO_CONTESTACAO = /\b(n[aã]o\s*(reconhe[cç]o|é\s*isso|devo|fiz\s*esse|é\s*meu)|cobran[çc]a\s*errada|valor\s*errado|j[aá]\s*foi\s*pago\s*antes|isso\s*(é\s*)?engano)\b/i;
const PADRAO_DATA = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

function normalizarData(dia: string, mes: string, ano: string | undefined, hoje: string): string | null {
  const anoRef = ano ? (ano.length === 2 ? `20${ano}` : ano) : hoje.slice(0, 4);
  const d = dia.padStart(2, "0");
  const m = mes.padStart(2, "0");
  const candidata = `${anoRef}-${m}-${d}`;
  // Validação simples: mês 1-12, dia 1-31 — nunca aceita uma "data" absurda vinda de regex solto.
  const mesNum = Number(m), diaNum = Number(d);
  if (mesNum < 1 || mesNum > 12 || diaNum < 1 || diaNum > 31) return null;
  return candidata;
}

/**
 * Classifica uma mensagem recebida em um dos três eventos financeiros
 * reconhecidos, ou "sem_classificacao" quando nenhum padrão bate — nunca
 * força uma classificação sem evidência textual clara. Contestação tem
 * prioridade sobre promessa/pagamento (ex.: "não devo isso, já paguei
 * antes" é contestação, não uma nova alegação de pagamento).
 */
export function classificarRespostaCliente(texto: string, hoje: string): RespostaClassificada {
  if (PADRAO_CONTESTACAO.test(texto)) {
    return { tipo: "contestou", dataPrometida: null };
  }
  if (PADRAO_PAGAMENTO.test(texto)) {
    return { tipo: "informou_pagamento", dataPrometida: null };
  }
  if (PADRAO_PROMESSA.test(texto)) {
    const match = texto.match(PADRAO_DATA);
    const dataPrometida = match ? normalizarData(match[1], match[2], match[3], hoje) : null;
    return { tipo: "prometeu_pagamento", dataPrometida };
  }
  return { tipo: "sem_classificacao", dataPrometida: null };
}

// ── Próxima ação sugerida (o que fazer, nunca "se deve fazer") ──────────

export type TipoAcaoCobranca = "lembrete_antecipado" | "aviso_vencida" | "cobranca_promessa_expirada";

/**
 * Determina QUAL ação cabe, dado o estado atual — não decide SE deve
 * executar (isso é `podeGerarAcaoAutomatica`, em cobranca-state-machine.ts,
 * usado só para o modo "automatico"). `null` quando nenhuma ação se aplica
 * (ex.: `a_vencer` mas ainda longe do vencimento).
 */
export function tipoProximaAcao(cobranca: Cobranca, hoje: string, janelaLembreteDias = 3): TipoAcaoCobranca | null {
  if (cobranca.status === "a_vencer") {
    const diasAteVencer = diasEntre(hoje, cobranca.vencimento);
    return diasAteVencer >= 0 && diasAteVencer <= janelaLembreteDias ? "lembrete_antecipado" : null;
  }
  if (cobranca.status === "vencida") {
    return "aviso_vencida";
  }
  if (cobranca.status === "promessa_pausada" && cobranca.promessaData && promessaExpirada(cobranca.promessaData, hoje)) {
    return "cobranca_promessa_expirada";
  }
  return null;
}

function diasEntre(de: string, ate: string): number {
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = ate.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}

// ── Mensagens determinísticas (nunca geradas por LLM sem revisão) ───────
// Cada intenção da missão vira um template fixo, com placeholders só de
// dado real (nome, valor, data) — nunca inventa desconto, prazo ou
// promessa que ninguém fez.

function formatarMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function gerarMensagemCobranca(cobranca: Cobranca, tipo: TipoAcaoCobranca, nomeCliente: string): string {
  const valor = formatarMoeda(cobranca.valorCentavos);
  const vencimento = formatarDataBr(cobranca.vencimento);

  switch (tipo) {
    case "lembrete_antecipado":
      return `Olá, ${nomeCliente}! Passando para lembrar que o pagamento de ${valor} vence em ${vencimento}. Qualquer dúvida, estamos à disposição. 😊`;
    case "aviso_vencida":
      return `Olá, ${nomeCliente}. Identificamos que o pagamento de ${valor}, com vencimento em ${vencimento}, ainda não foi confirmado. Poderia nos avisar como está a situação?`;
    case "cobranca_promessa_expirada":
      return `Olá, ${nomeCliente}. O prazo combinado para o pagamento de ${valor} já passou e ainda não identificamos a confirmação. Pode nos dar um retorno, por favor?`;
  }
}

// ── Motor de autonomia (sugerir / aprovar / automático) ──────────────────

export type ModoAutonomia = "sugerir" | "aprovar" | "automatico";

export type AcaoPreparada = {
  tipo:     TipoAcaoCobranca;
  mensagem: string;
  canal:    "whatsapp";
};

export type DecisaoAcao =
  | { executar: false; motivo: string }
  | { executar: true; requerAprovacao: boolean; acao: AcaoPreparada };

export type ConfigCobranca = {
  cooldownDias:      number;
  limiteTentativas:  number;
  horarioInicio:     number;
  horarioFim:        number;
  janelaLembreteDias: number;
};

/**
 * Único ponto de decisão de execução. Fail-closed por construção: o único
 * jeito de `requerAprovacao: false` sair daqui é `modo === "automatico"`
 * E todas as guardas de `podeGerarAcaoAutomatica` passarem. Qualquer outro
 * caminho (modo inválido, guarda não satisfeita, sem ação aplicável)
 * bloqueia execução automática — nunca assume "pode" por omissão.
 */
export function decidirExecucao(
  cobranca: Cobranca,
  hoje: string,
  horaAtual: number,
  modo: ModoAutonomia,
  config: ConfigCobranca,
  nomeCliente: string
): DecisaoAcao {
  const tipo = tipoProximaAcao(cobranca, hoje, config.janelaLembreteDias);
  if (!tipo) {
    return { executar: false, motivo: "Nenhuma ação de cobrança se aplica ao estado atual nesta data." };
  }

  const acao: AcaoPreparada = { tipo, mensagem: gerarMensagemCobranca(cobranca, tipo, nomeCliente), canal: "whatsapp" };

  if (modo === "sugerir" || modo === "aprovar") {
    return { executar: true, requerAprovacao: true, acao };
  }

  // modo === "automatico": só executa sozinho se TODAS as guardas passarem.
  const podeAutomatico = podeGerarAcaoAutomatica(cobranca, hoje, horaAtual, {
    cooldownDias: config.cooldownDias,
    limiteTentativas: config.limiteTentativas,
    horarioInicio: config.horarioInicio,
    horarioFim: config.horarioFim,
  });

  if (!podeAutomatico) {
    // Fail-closed: nunca descarta a ação — rebaixa para aprovação humana em vez de executar às cegas.
    return { executar: true, requerAprovacao: true, acao };
  }

  return { executar: true, requerAprovacao: false, acao };
}
