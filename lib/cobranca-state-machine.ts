// ── Cobrador AI · state machine pura ────────────────────────────────────────
// Ver docs/financeiro-inteligente-cobrador-ai-v1-arquitetura.md para o
// desenho completo. Código puro (sem Supabase, sem fetch, sem LLM) — mesma
// filosofia de lib/orcamentos-state-machine.ts: estados e transições
// financeiras são SEMPRE determinísticos, nunca dependem de um modelo de
// linguagem. IA pode ajudar a classificar/priorizar/redigir — nunca decide
// sozinha uma transição de estado.
//
// Este módulo NÃO duplica lifecycle econômico: reutiliza o conceito de
// `orcamentos` (docs/orcamento-venda-receita-v1-arquitetura.md) como
// origem mais comum de uma cobrança (`orcamentoId` opcional) e converge o
// que aquele documento previa como `orcamento_pagamentos` (seção 3.2/8/9.5)
// nesta tabela `pagamentos`, ligada a `cobranca_id` — uma só fonte de
// evidência de pagamento no domínio inteiro, nunca duas.

export type CobrancaStatus =
  | "a_vencer"              // vencimento no futuro, sem pendência
  | "vencida"                // vencimento passou, sem pagamento confirmado, sem pausa/promessa ativa
  | "aguardando_confirmacao" // cliente informou pagamento — NUNCA confirmado só por isso
  | "promessa_pausada"       // cliente prometeu pagar até uma data — cobrança pausada até lá
  | "em_negociacao"          // contestação/divergência — exige humano, automação para
  | "pausada"                // pausa manual (motivo livre, sem ser promessa/negociação)
  | "paga"                   // terminal — pagamento CONFIRMADO por evidência real
  | "cancelada";              // terminal — cobrança cancelada (erro de lançamento, já quitado por outro meio, etc.)

export type Cobranca = {
  id:             string;
  clinicaId:      string;
  orcamentoId:    string | null;
  valorCentavos:  number;
  vencimento:     string;       // YYYY-MM-DD
  status:         CobrancaStatus;
  promessaData:   string | null; // YYYY-MM-DD — só relevante quando status === "promessa_pausada"
  ultimaAcaoEm:   string | null; // ISO — último disparo de cobrança (cooldown)
  tentativas:     number;        // quantidade de ações de cobrança já executadas
  clienteOptOut:  boolean;       // opt-out explícito — nunca gera ação automática, sob nenhuma condição
};

// ── Grafo de transições legais ──────────────────────────────────────────
// Generoso de propósito (a realidade comercial é confusa: um cliente pode
// contestar depois de prometer, pagar no meio de uma negociação, etc.) —
// a semântica precisa de QUAL evento leva a QUAL transição fica em
// `aplicarEvento` abaixo; este grafo é a rede de segurança final (nunca
// permite, por exemplo, `paga -> vencida`).
const TRANSICOES_VALIDAS: Record<CobrancaStatus, ReadonlySet<CobrancaStatus>> = {
  a_vencer:               new Set(["vencida", "pausada", "cancelada", "paga", "aguardando_confirmacao", "promessa_pausada", "em_negociacao"]),
  vencida:                new Set(["aguardando_confirmacao", "promessa_pausada", "em_negociacao", "pausada", "paga", "cancelada"]),
  aguardando_confirmacao: new Set(["paga", "vencida", "a_vencer", "em_negociacao", "promessa_pausada", "pausada", "cancelada"]),
  promessa_pausada:       new Set(["vencida", "a_vencer", "aguardando_confirmacao", "em_negociacao", "paga", "pausada", "cancelada"]),
  em_negociacao:          new Set(["paga", "cancelada", "vencida", "a_vencer", "pausada"]),
  pausada:                new Set(["vencida", "a_vencer", "aguardando_confirmacao", "em_negociacao", "paga", "cancelada"]),
  paga:                   new Set([]),
  cancelada:              new Set([]),
};

export function podeTransicionar(de: CobrancaStatus, para: CobrancaStatus): boolean {
  return TRANSICOES_VALIDAS[de].has(para);
}

export function ehEstadoTerminal(status: CobrancaStatus): boolean {
  return TRANSICOES_VALIDAS[status].size === 0;
}

function diasEntre(de: string, ate: string): number {
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = ate.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}

/** Sempre recalculado ao vivo a partir de `vencimento` — nunca confia cegamente no `status` gravado (mesmo princípio de `orcamentoExpirado` em lib/orcamentos-state-machine.ts). */
export function estaVencida(vencimento: string, hoje: string): boolean {
  return vencimento < hoje;
}

/** Promessa quebrada: `promessaData` já passou e ninguém confirmou pagamento. */
export function promessaExpirada(promessaData: string, hoje: string): boolean {
  return promessaData < hoje;
}

// ── Eventos e transição determinística ──────────────────────────────────
// Único ponto de decisão de estado. Nunca chamado por um LLM diretamente —
// LLM pode, no máximo, classificar uma mensagem em um `EventoCobranca`
// (ver lib/motor-cobranca.ts), mas quem decide a transição é sempre esta
// função, determinística e testável isoladamente do modelo de linguagem.

export type EventoCobranca =
  | { tipo: "tempo_passou" }
  | { tipo: "cliente_informou_pagamento" }
  | { tipo: "cliente_prometeu_pagamento"; dataPrometida: string | null }
  | { tipo: "cliente_contestou" }
  | { tipo: "pagamento_confirmado" }     // evidência real inserida em `pagamentos`
  | { tipo: "confirmacao_rejeitada" }    // humano revisou: a alegação de pagamento não procede
  | { tipo: "pausa_manual" }
  | { tipo: "retomada_manual" }
  | { tipo: "cancelamento_manual" };

export type ResultadoEvento =
  | { transicionou: true; novoStatus: CobrancaStatus; motivo: string }
  | { transicionou: false; motivo: string };

function resultado(cobranca: Cobranca, novoStatus: CobrancaStatus, motivo: string): ResultadoEvento {
  if (!podeTransicionar(cobranca.status, novoStatus)) {
    return { transicionou: false, motivo: `Transição ${cobranca.status} → ${novoStatus} não é permitida.` };
  }
  return { transicionou: true, novoStatus, motivo };
}

/**
 * Único ponto de mutação de estado do domínio. Determinístico: mesmo
 * evento + mesma cobrança + mesma data sempre produz o mesmo resultado.
 * Estado terminal (`paga`/`cancelada`) nunca é reaberto por nenhum evento
 * — "zero cobrança após pagamento confirmado" é garantido aqui, não como
 * regra solta em outro lugar.
 */
export function aplicarEvento(cobranca: Cobranca, evento: EventoCobranca, hoje: string): ResultadoEvento {
  if (ehEstadoTerminal(cobranca.status)) {
    return { transicionou: false, motivo: `Cobrança já está em estado terminal (${cobranca.status}) — nenhum evento reabre.` };
  }

  switch (evento.tipo) {
    case "tempo_passou": {
      if (cobranca.status === "a_vencer" && estaVencida(cobranca.vencimento, hoje)) {
        return resultado(cobranca, "vencida", "Vencimento atingido sem pagamento confirmado.");
      }
      if (cobranca.status === "promessa_pausada" && cobranca.promessaData && promessaExpirada(cobranca.promessaData, hoje)) {
        return resultado(cobranca, "vencida", `Promessa de pagamento para ${cobranca.promessaData} expirou sem confirmação.`);
      }
      return { transicionou: false, motivo: "Nenhuma mudança de estado necessária nesta data." };
    }

    case "cliente_informou_pagamento":
      return resultado(cobranca, "aguardando_confirmacao", "Cliente informou pagamento — aguardando confirmação por evidência real, nunca assumido automaticamente.");

    case "cliente_prometeu_pagamento": {
      if (evento.dataPrometida !== null && evento.dataPrometida < hoje) {
        return { transicionou: false, motivo: "Data prometida não pode ser no passado — promessa rejeitada, não registrada." };
      }
      return resultado(cobranca, "promessa_pausada", evento.dataPrometida
        ? `Cliente prometeu pagamento até ${evento.dataPrometida}.`
        : "Cliente prometeu pagamento sem data específica.");
    }

    case "cliente_contestou":
      return resultado(cobranca, "em_negociacao", "Cliente contestou/divergência identificada — automação interrompida, decisão exige humano.");

    case "pagamento_confirmado":
      return resultado(cobranca, "paga", "Pagamento confirmado por evidência real (registro em `pagamentos`).");

    case "confirmacao_rejeitada": {
      if (cobranca.status !== "aguardando_confirmacao") {
        return { transicionou: false, motivo: "Só é possível rejeitar uma confirmação quando a cobrança está aguardando confirmação." };
      }
      const destino = estaVencida(cobranca.vencimento, hoje) ? "vencida" : "a_vencer";
      return resultado(cobranca, destino, "Alegação de pagamento revisada por humano e não confirmada — cobrança retomada.");
    }

    case "pausa_manual":
      return resultado(cobranca, "pausada", "Pausa manual registrada por um operador humano.");

    case "retomada_manual": {
      if (cobranca.status !== "pausada") {
        return { transicionou: false, motivo: "Só é possível retomar manualmente uma cobrança pausada." };
      }
      const destino = estaVencida(cobranca.vencimento, hoje) ? "vencida" : "a_vencer";
      return resultado(cobranca, destino, "Cobrança retomada manualmente por um operador humano.");
    }

    case "cancelamento_manual":
      return resultado(cobranca, "cancelada", "Cobrança cancelada manualmente por um operador humano.");
  }
}

// ── Guardas de segurança para ação automática ───────────────────────────

/** Contestação sempre exige humano; excesso de tentativas automáticas também — nunca insiste sozinho para sempre. */
export function precisaIntervencaoHumana(cobranca: Cobranca, limiteTentativas: number): boolean {
  if (cobranca.status === "em_negociacao") return true;
  if (cobranca.status === "aguardando_confirmacao") return true; // confirmar evidência é sempre tarefa humana/de reconciliação
  if (cobranca.tentativas >= limiteTentativas) return true;
  return false;
}

/**
 * Pausa efetiva. INVARIANTE: toda cobrança em `promessa_pausada` é
 * considerada pausada — sem exceção. Com data, pausada enquanto a
 * promessa estiver vigente (some para `false` só quando a promessa
 * expira, e a partir daí `tempo_passou` já a leva para `vencida` — ver
 * `aplicarEvento`). SEM data (promessa sem prazo específico —
 * `classificarRespostaCliente` produz esse caso quando o cliente não deu
 * uma data explícita), permanece pausada indefinidamente: não há como
 * calcular expiração sem uma data, e a única saída correta é intervenção
 * humana (`pausa_manual` → `retomada_manual`, uma nova promessa com data,
 * uma contestação, ou confirmação de pagamento) — nunca liberar ação
 * automática por omissão. Corrigido nesta revisão: a versão anterior
 * retornava `false` (não pausada) para promessa sem data, o que deixava
 * `podeGerarAcaoAutomatica` potencialmente `true` nesse caso — só não
 * chegava a gerar ação de fato porque `tipoProximaAcao` (motor-cobranca.ts)
 * também não define ação para esse estado. Esta função agora é segura
 * isoladamente, sem depender dessa coincidência de ordem de chamada.
 */
export function estaPausada(cobranca: Cobranca, hoje: string): boolean {
  if (cobranca.status === "pausada") return true;
  if (cobranca.status === "promessa_pausada") {
    if (cobranca.promessaData === null) return true;
    return !promessaExpirada(cobranca.promessaData, hoje);
  }
  return false;
}

/** Cooldown entre ações automáticas — nunca dispara duas ações no mesmo intervalo mínimo. */
export function cooldownExpirado(ultimaAcaoEm: string | null, hoje: string, cooldownDias = 3): boolean {
  if (ultimaAcaoEm === null) return true;
  const dataUltimaAcao = ultimaAcaoEm.slice(0, 10);
  return diasEntre(dataUltimaAcao, hoje) >= cooldownDias;
}

/** Horário permitido configurável (0–23h) — nunca dispara fora da janela. */
export function dentroDoHorarioPermitido(horaAtual: number, inicio = 8, fim = 20): boolean {
  return horaAtual >= inicio && horaAtual < fim;
}

/**
 * Gate único e central para qualquer ação AUTOMÁTICA de cobrança — reúne
 * todas as guardas obrigatórias (terminal, pausa, intervenção humana,
 * cooldown, horário, opt-out). Modo "sugerir"/"aprovar" não usa este gate
 * (preparam ação sempre, humano decide) — só o modo "automatico" depende
 * dele. Fail-closed: qualquer guarda não satisfeita bloqueia a ação.
 */
export function podeGerarAcaoAutomatica(
  cobranca: Cobranca,
  hoje: string,
  horaAtual: number,
  config: { cooldownDias: number; limiteTentativas: number; horarioInicio: number; horarioFim: number }
): boolean {
  if (cobranca.clienteOptOut) return false;
  if (ehEstadoTerminal(cobranca.status)) return false;
  if (estaPausada(cobranca, hoje)) return false;
  if (precisaIntervencaoHumana(cobranca, config.limiteTentativas)) return false;
  if (!cooldownExpirado(cobranca.ultimaAcaoEm, hoje, config.cooldownDias)) return false;
  if (!dentroDoHorarioPermitido(horaAtual, config.horarioInicio, config.horarioFim)) return false;
  return true;
}

// ── Deduplicação: no máximo uma cobrança ativa por orçamento ────────────

/** Nunca cria uma segunda cobrança ativa para o mesmo orçamento — evita cobrança duplicada do mesmo dinheiro. */
export function podeCriarCobranca(orcamentoId: string | null, cobrancasExistentes: Pick<Cobranca, "orcamentoId" | "status">[]): boolean {
  if (orcamentoId === null) return true; // sem origem em orçamento — dedup é responsabilidade de quem chama
  return !cobrancasExistentes.some(c => c.orcamentoId === orcamentoId && !ehEstadoTerminal(c.status));
}

/** Chave de idempotência determinística para uma ação de cobrança — mesmo padrão de `idempotency_key` em orçamentos. */
export function chaveIdempotenciaAcao(cobrancaId: string, tipoAcao: string, dataISO: string): string {
  return `${cobrancaId}:${tipoAcao}:${dataISO.slice(0, 10)}`;
}

// ── Receita recuperada — regra conservadora e auditável ─────────────────
// Nunca chama pagamento de "recuperado" por padrão. Só quando há evidência
// de causalidade real: a cobrança esteve vencida E o pagamento foi
// CONFIRMADO (nunca só "informado") E houve pelo menos uma ação de
// cobrança REALMENTE EXECUTADA (nunca pendente/aprovada/rejeitada) ANTES
// do pagamento confirmado. Pagamento espontâneo (sem cobrança), pagamento
// ainda não confirmado, ou ação que não chegou a ser executada (ou só foi
// executada depois do pagamento) é só "pagamento recebido" — nunca
// "recuperado".
//
// Contrato endurecido nesta revisão: a versão anterior recebia um
// contador `acoesExecutadasAntesDoPagamento: number` já pré-filtrado por
// quem chama — o NOME prometia "executadas" e "antes do pagamento", mas
// nada no tipo impedia um chamador futuro de contar ações pendentes,
// rejeitadas, ou executadas depois do pagamento, produzindo um falso
// positivo silencioso. Agora a função recebe a EVIDÊNCIA BRUTA (a lista
// de ações, cada uma com seu `statusExecucao` e `executadoEm` reais, mais
// o timestamp de confirmação do pagamento — `null` quando não confirmado)
// e faz ela mesma o filtro (`statusExecucao === "executada"` e
// `executadoEm < pagamentoConfirmadoEm`) — nunca confia num número já
// resumido. Um chamador só produz `true` fornecendo evidência real que
// satisfaz as quatro condições, não um contador que ele mesmo calculou.

export type EvidenciaAcaoCobranca = {
  statusExecucao: "pendente" | "aprovada" | "executada" | "rejeitada";
  // ISO — só faz sentido preenchido quando statusExecucao === "executada";
  // para qualquer outro status, `executadoEm` é ignorado por esta função
  // mesmo que venha preenchido por engano (nunca conta ação não executada).
  executadoEm: string | null;
};

export type EvidenciaRecuperacao = {
  esteveVencida:          boolean;
  // ISO — `null` = pagamento não confirmado (inclui "só informado pelo
  // cliente", que nunca chega a ter este campo preenchido). Sem essa
  // evidência, a classificação é sempre `false`, sem exceção.
  pagamentoConfirmadoEm:  string | null;
  acoes:                  EvidenciaAcaoCobranca[];
};

export function classificarComoReceitaRecuperada(evidencia: EvidenciaRecuperacao): boolean {
  if (!evidencia.esteveVencida) return false;
  if (evidencia.pagamentoConfirmadoEm === null) return false;

  const pagamentoEm = evidencia.pagamentoConfirmadoEm;
  return evidencia.acoes.some(acao =>
    acao.statusExecucao === "executada" &&
    acao.executadoEm !== null &&
    acao.executadoEm < pagamentoEm
  );
}
