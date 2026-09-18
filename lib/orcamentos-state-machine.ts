// ── Orçamento → Venda → Receita · State machine pura ────────────────────────
// Ver docs/orcamento-venda-receita-v1-arquitetura.md para o desenho completo.
// Este módulo é intencionalmente independente de schema e de banco: só
// tipos e funções puras sobre valores já resolvidos por quem chama (mesma
// filosofia de lib/oportunidades-clientes.ts — "nunca consulta nada").
// Existe para que a máquina de estados do domínio possa ser validada e
// testada ANTES de qualquer migration ser aprovada/executada.

export type OrcamentoStatus = "criado" | "enviado" | "aceito" | "recusado" | "expirado";

// Grafo de transições legais. `criado` é o único estado de entrada;
// `aceito`/`recusado`/`expirado` são terminais nesta fase — reabrir um
// orçamento fechado é decisão de produto fora de escopo, não implementada.
// Nenhuma transição pula `enviado`: um orçamento só é aceito/recusado depois
// de ter sido efetivamente enviado, nunca direto de `criado`.
const TRANSICOES_VALIDAS: Record<OrcamentoStatus, ReadonlySet<OrcamentoStatus>> = {
  criado:   new Set(["enviado"]),
  enviado:  new Set(["aceito", "recusado", "expirado"]),
  aceito:   new Set([]),
  recusado: new Set([]),
  expirado: new Set([]),
};

/**
 * `expirado` como TRANSIÇÃO GRAVADA é uma ação humana explícita de
 * encerramento/arquivamento (housekeeping) — nunca automática. A pergunta
 * "este orçamento está funcionalmente vencido?" (para fins de sinal do
 * Smart Commerce) NUNCA depende de `status` ter sido escrito como
 * `'expirado'` — é sempre recalculada ao vivo por `orcamentoExpirado(...)`
 * abaixo, a partir de `validade_ate`, mesmo padrão já usado hoje para
 * `agendamentos` (status "vencido" computado na leitura, nunca gravado —
 * ver `normalizarStatus` em app/agendamentos/page.tsx:48-51).
 */
export function podeTransicionar(de: OrcamentoStatus, para: OrcamentoStatus): boolean {
  return TRANSICOES_VALIDAS[de].has(para);
}

export function ehEstadoTerminal(status: OrcamentoStatus): boolean {
  return TRANSICOES_VALIDAS[status].size === 0;
}

// ── Vencimento — sempre computado ao vivo, nunca lido de uma coluna ────────

/**
 * Verdadeiro quando o orçamento ainda está `enviado` (nenhuma resposta
 * registrada) e a validade já passou. `validadeAte === null` (sem prazo
 * definido) nunca expira — não inventa um prazo que não foi informado.
 */
export function orcamentoExpirado(status: OrcamentoStatus, validadeAte: string | null, hoje: string): boolean {
  return status === "enviado" && validadeAte !== null && validadeAte < hoje;
}

/**
 * Verdadeiro quando o orçamento está `enviado`, ainda dentro do prazo, mas
 * a validade vence dentro de `janelaDias` dias (padrão 3 — mesma ordem de
 * grandeza de outras janelas já usadas no motor, ex.: `interesse_sem_compra`
 * olha 30 dias de chatbot_logs). Não dispara para quem não tem prazo.
 */
export function orcamentoExpirando(
  status: OrcamentoStatus, validadeAte: string | null, hoje: string, janelaDias = 3
): boolean {
  if (status !== "enviado" || validadeAte === null || validadeAte < hoje) return false;
  const diasAteExpirar = diasEntre(hoje, validadeAte);
  return diasAteExpirar <= janelaDias;
}

function diasEntre(de: string, ate: string): number {
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = ate.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}

// ── Pagamento — tri-estado puro, aritmético, sem tabela nenhuma ────────────
// Fase 2 do domínio (orcamento_pagamentos ainda não existe — ver seção 3.2
// do documento de arquitetura). Estas funções não dependem da tabela
// existir: operam sobre números já somados por quem chama. Preparadas para
// o dia em que houver fonte real de pagamento; não usadas por nenhum
// caminho de dado hoje.

export type StatusPagamento = "nao_pago" | "parcial" | "pago";

/**
 * `valorCentavos === null` (orçamento sem valor informado) não tem como ter
 * status de pagamento — retorna null em vez de inventar "não pago".
 * `totalPagoCentavos` é a SOMA real de pagamentos, nunca um booleano
 * gravado redundante (ver seção 8 do documento de arquitetura).
 */
export function calcularStatusPagamento(
  valorCentavos: number | null, totalPagoCentavos: number
): StatusPagamento | null {
  if (valorCentavos === null) return null;
  if (totalPagoCentavos <= 0) return "nao_pago";
  if (totalPagoCentavos >= valorCentavos) return "pago";
  return "parcial";
}
