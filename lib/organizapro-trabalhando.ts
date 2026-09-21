// ── "OrganizaPro trabalhando" — Bloco G da Casa (Dashboard/Casa Premium V1) ──
// Domínio puro (sem DB/HTTP). Traduz eventos_dominio reais (já gravados por
// Cobrador Digital, Follow-up Comercial, WhatsApp Governado e Google
// Business Profile — nenhum evento novo criado por esta missão) em uma
// contagem curta de atividade real dos últimos dias.
//
// Regra: só conta o que já aconteceu de fato (tipo do evento + resultado,
// quando aplicável) — nunca estima, nunca projeta, nunca atribui receita.
// Um item só aparece quando a contagem real é maior que zero (nunca lista
// "0 cobranças enviadas" para parecer ativo).

export type EventoAtividade = {
  tipo: string;
  resultado: string | null; // payload.resultado quando o tipo tiver essa distinção; null quando não se aplica
};

export type ItemAtividade = { label: string; quantidade: number };

type Contador = {
  tipo: string;
  resultadoFiltro?: string;
  label: (n: number) => string;
};

const CONTADORES: Contador[] = [
  { tipo: "cobranca.tentativa", label: (n) => `cobrança${n === 1 ? "" : "s"} preparada${n === 1 ? "" : "s"} para contato` },
  { tipo: "followup.tentativa", label: (n) => `follow-up${n === 1 ? "" : "s"} ${n === 1 ? "comercial" : "comerciais"} preparado${n === 1 ? "" : "s"}` },
  { tipo: "cobranca.envio", resultadoFiltro: "sucesso", label: (n) => `cobrança${n === 1 ? "" : "s"} enviada${n === 1 ? "" : "s"} pelo WhatsApp` },
  { tipo: "followup.envio", resultadoFiltro: "sucesso", label: (n) => `mensagem${n === 1 ? "" : "s"} de follow-up enviada${n === 1 ? "" : "s"}` },
  { tipo: "gbp.resposta_publicada", resultadoFiltro: "sucesso", label: (n) => `avaliaç${n === 1 ? "ão" : "ões"} do Google respondida${n === 1 ? "" : "s"}` },
];

export function calcularAtividadeRecente(eventos: EventoAtividade[]): ItemAtividade[] {
  const itens: ItemAtividade[] = [];
  for (const c of CONTADORES) {
    const quantidade = eventos.filter((e) => e.tipo === c.tipo && (!c.resultadoFiltro || e.resultado === c.resultadoFiltro)).length;
    if (quantidade > 0) itens.push({ label: c.label(quantidade), quantidade });
  }
  return itens;
}

export const TIPOS_ATIVIDADE_RECENTE: readonly string[] = CONTADORES.map((c) => c.tipo);

export const DIAS_JANELA_ATIVIDADE_RECENTE = 7;
