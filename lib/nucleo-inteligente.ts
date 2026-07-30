// ── Núcleo Inteligente V1.1 · Sinal Canônico + Missão do Dia ────────────────
// Ver docs/nucleo-inteligente-v1-arquitetura.md (arquitetura V1.1, homologada
// e congelada em 2026-07-30). Fase 1, primeiro incremento: só o Especialista
// Comercial, só o essencial para a Missão do Dia existir sem duplicar regra
// nenhuma da Próxima Melhor Ação.
//
// Este arquivo NUNCA calcula um sinal novo — ele só traduz (adapta) o que
// lib/oportunidades-clientes.ts e lib/recomendacoes.ts já calculam para o
// formato único do Sinal Canônico, e organiza (ordena + deduplica) esses
// sinais de um jeito compartilhado por qualquer consumidor (hoje: Próxima
// Melhor Ação e Missão do Dia). Nenhuma consulta ao banco aqui — tudo entra
// por parâmetro, já carregado por quem chama.

import type { OportunidadeCliente } from "./oportunidades-clientes";
import type { Recomendacao } from "./recomendacoes";

export type EspecialistaOrigem = "comercial";

// Estrutura mínima definida em docs/nucleo-inteligente-v1-arquitetura.md,
// seção 4.1 — identificado/motivo/ação/evidência (já provado em produção
// pela IA Comercial V1), mais os campos que faltavam para comparar sinais
// de especialistas diferentes no futuro (especialista, chaveDedup).
export type SinalCanonico = {
  id:            string;   // estável entre recarregamentos — mesmo id já usado hoje pela Próxima Melhor Ação
  especialista:  EspecialistaOrigem;
  tipo:          string;   // vocabulário do próprio especialista (nunca inventado aqui)
  prioridade:    "alta" | "media" | "baixa";
  titulo:        string;
  motivo:        string;
  evidencia:     string;
  acaoSugerida:  string;
  contexto?:     { tipo: "cliente"; nome: string; telefone: string | null }; // ausente = sinal agregado
  chaveDedup:    string;
  criadoEm:      string | null; // null quando não há uma data real associada ao sinal
  destino?:      string;
  destinoLabel?: string;
};

// ── Adaptador do Especialista Comercial ──────────────────────────────────
// Traduz literalmente o que os dois motores já existentes calculam — mesmo
// texto (motivo, ação, título) que já aparece hoje no Radar, na Central de
// Oportunidades e no Diretor Digital. Nenhuma regra de priorização nova.

export function adaptarOportunidadesClientes(oportunidades: OportunidadeCliente[]): SinalCanonico[] {
  return oportunidades.map(op => ({
    id:           `cliente-${op.chave}`,
    especialista: "comercial",
    tipo:         op.sinais[0].tipo,
    prioridade:   op.prioridade,
    titulo:       `${op.nome} — ${op.acaoSugerida}`,
    motivo:       op.motivoPrincipal,
    evidencia:    op.tempoDecorrido
      ? `Identificado no histórico real de agendamentos, ${op.tempoDecorrido}.`
      : "Identificado no histórico real de agendamentos.",
    acaoSugerida: op.acaoSugerida,
    contexto:     { tipo: "cliente", nome: op.nome, telefone: op.telefone },
    chaveDedup:   op.chave,
    criadoEm:     null,
    destino:      "/clientes",
    destinoLabel: "Ver cliente",
  }));
}

export function adaptarRecomendacoes(recomendacoes: Recomendacao[]): SinalCanonico[] {
  return recomendacoes.map(r => ({
    id:           `rec-${r.id}`,
    especialista: "comercial",
    tipo:         r.id,
    prioridade:   r.prioridade,
    titulo:       r.titulo,
    // `motivo` aqui é o mesmo campo `r.motivo` que a Próxima Melhor Ação já
    // usa hoje (preserva o texto exatamente como já está em produção); a
    // versão consultiva de "por que importa" (`r.explicacao`) é a que
    // lib/ia-comercial.ts já usa por conta própria, sem relação com este
    // adaptador.
    motivo:       r.motivo,
    evidencia:    `${r.quantidade} ${r.quantidade === 1 ? "registro real" : "registros reais"}.`,
    acaoSugerida: r.acao,
    chaveDedup:   `rec:${r.id}`,
    criadoEm:     null,
    destino:      r.destino,
    destinoLabel: r.destinoLabel,
  }));
}

// ── Desempate determinístico ─────────────────────────────────────────────
// Mesma ordem já em produção na Próxima Melhor Ação V1 (antes vivia como
// TIE_BREAK/tieBreakDoCliente/tieBreakDaRecomendacao, local ao Dashboard) —
// só generalizada para operar sobre `tipo` de um Sinal Canônico qualquer,
// para que Próxima Melhor Ação e Missão do Dia nunca precisem recalcular a
// prioridade cada uma à sua moda.
const TIER: Record<string, number> = {
  cancelamento_sem_reagendamento: 1,
  confirmacao_pendente:           2,
  "compromissos-atrasados":       3,
  "horario-vago-hoje":            4,
  sem_proximo_compromisso:        5,
};
const TIER_PADRAO = 6;

function tierDoSinal(sinal: SinalCanonico): number {
  return TIER[sinal.tipo] ?? TIER_PADRAO;
}

const PESO_PRIORIDADE: Record<"alta" | "media" | "baixa", number> = { alta: 0, media: 1, baixa: 2 };

// Princípio da Transparência (docs/nucleo-inteligente-v1-arquitetura.md,
// seção 2, item 6): todo sinal precisa de motivo, evidência e ação — um
// sinal sem essas partes não pode ser exibido em nenhuma tela.
function sinalValido(sinal: SinalCanonico): boolean {
  return !!sinal.titulo?.trim() && !!sinal.motivo?.trim() && !!sinal.evidencia?.trim() && !!sinal.acaoSugerida?.trim();
}

/**
 * Ordena por prioridade e desempata deterministicamente, remove sinais sem
 * evidência/motivo/ação válidos, e por fim remove duplicidades por
 * `chaveDedup` (mantendo a ocorrência de maior prioridade, já que a
 * deduplicação roda depois da ordenação). Hoje, com um único especialista,
 * colisão de chave entre as duas listas de entrada não ocorre (chaves de
 * cliente são telefone/nome; chaves de recomendação agregada são
 * `rec:<id>`) — a deduplicação já vem pronta para quando um segundo
 * especialista existir e puder, em tese, apontar para o mesmo cliente.
 */
export function organizarSinaisCanonicos(sinais: SinalCanonico[]): SinalCanonico[] {
  const ordenados = [...sinais]
    .filter(sinalValido)
    .sort((a, b) =>
      PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] || tierDoSinal(a) - tierDoSinal(b)
    );
  const vistos = new Set<string>();
  const resultado: SinalCanonico[] = [];
  for (const s of ordenados) {
    if (vistos.has(s.chaveDedup)) continue;
    vistos.add(s.chaveDedup);
    resultado.push(s);
  }
  return resultado;
}

// ── 🎯 Missão do Dia — camada de orquestração ────────────────────────────
// Nunca cria sinal novo, nunca altera evidência, nunca consulta banco —
// só organiza (seção 4.5 da arquitetura). Responde uma pergunta só: "se eu
// pudesse fazer só três coisas hoje, quais teriam mais impacto?" — por isso
// o teto fixo de 3, nunca uma lista maior.
export function gerarMissaoDoDia(sinais: SinalCanonico[], limite = 3): SinalCanonico[] {
  return organizarSinaisCanonicos(sinais).slice(0, limite);
}
