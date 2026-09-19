// ── E-commerce IA · state machine pura de Pedido ────────────────────────────
// Ver docs/ecommerce-ia-v1-arquitetura.md para o desenho completo. Código
// puro (sem Supabase, sem fetch, sem LLM) — mesma disciplina de
// lib/orcamentos-state-machine.ts e lib/cobranca-state-machine.ts: estados
// e transições financeiras são SEMPRE determinísticos.
//
// `pedido` NÃO é um `orcamento` disfarçado: um orçamento nasce de uma
// negociação (tem validade, pode expirar, pode ser recusado); um pedido
// nasce de um item de catálogo já precificado (`clinica_servicos`), sem
// negociação nem validade. São entidades irmãs do mesmo domínio econômico,
// nunca a mesma tabela. A convergência acontece no que os dois produzem —
// "receita comprovada" — nunca na estrutura interna de cada um.

export type PedidoStatus =
  | "criado"                          // pedido registrado, aguardando confirmação do lojista
  | "confirmado"                      // lojista aceitou — compromisso real, ainda sem pagamento
  | "aguardando_confirmacao_pagamento" // cliente informou pagamento — NUNCA confirmado só por isso
  | "pago"                            // terminal — pagamento CONFIRMADO por evidência real
  | "cancelado";                       // terminal

export type Pedido = {
  id:                     string;
  clinicaId:              string;
  pacienteId:             string | null; // FK opcional para `pacientes` — mesmo padrão de `orcamentos.paciente_id`
  servicoId:              string | null; // FK para `clinica_servicos` — item de catálogo de origem
  nomeCliente:            string;
  telefone:               string | null;
  valorCentavos:          number;        // capturado do catálogo NO MOMENTO da criação — nunca recalculado depois (mesmo princípio de `orcamentos.valor_centavos`)
  status:                 PedidoStatus;
  pagamentoInformadoEm:   string | null; // ISO
  pagamentoConfirmadoEm:  string | null; // ISO — única evidência aceita como receita comprovada
  idempotencyKey:         string | null;
};

const TRANSICOES_VALIDAS: Record<PedidoStatus, ReadonlySet<PedidoStatus>> = {
  criado:                           new Set(["confirmado", "cancelado"]),
  confirmado:                       new Set(["aguardando_confirmacao_pagamento", "pago", "cancelado"]),
  aguardando_confirmacao_pagamento: new Set(["pago", "confirmado", "cancelado"]),
  pago:                             new Set([]),
  cancelado:                        new Set([]),
};

export function podeTransicionar(de: PedidoStatus, para: PedidoStatus): boolean {
  return TRANSICOES_VALIDAS[de].has(para);
}

export function ehEstadoTerminal(status: PedidoStatus): boolean {
  return TRANSICOES_VALIDAS[status].size === 0;
}

// ── Eventos e transição determinística ──────────────────────────────────

export type EventoPedido =
  | { tipo: "confirmar_pedido" }                 // lojista aceita o pedido
  | { tipo: "cliente_informou_pagamento" }
  | { tipo: "confirmacao_rejeitada" }             // humano revisou: a alegação não procede
  | { tipo: "pagamento_confirmado" }              // evidência real
  | { tipo: "cancelar_pedido" };

export type ResultadoEvento =
  | { transicionou: true; novoStatus: PedidoStatus; motivo: string }
  | { transicionou: false; motivo: string };

function resultado(pedido: Pedido, novoStatus: PedidoStatus, motivo: string): ResultadoEvento {
  if (!podeTransicionar(pedido.status, novoStatus)) {
    return { transicionou: false, motivo: `Transição ${pedido.status} → ${novoStatus} não é permitida.` };
  }
  return { transicionou: true, novoStatus, motivo };
}

/**
 * Único ponto de mutação de estado do domínio. Determinístico: mesmo
 * evento + mesmo pedido sempre produz o mesmo resultado. Estado terminal
 * (`pago`/`cancelado`) nunca é reaberto por nenhum evento.
 */
export function aplicarEvento(pedido: Pedido, evento: EventoPedido): ResultadoEvento {
  if (ehEstadoTerminal(pedido.status)) {
    return { transicionou: false, motivo: `Pedido já está em estado terminal (${pedido.status}) — nenhum evento reabre.` };
  }

  switch (evento.tipo) {
    case "confirmar_pedido":
      return resultado(pedido, "confirmado", "Lojista confirmou o pedido.");

    case "cliente_informou_pagamento":
      return resultado(pedido, "aguardando_confirmacao_pagamento", "Cliente informou pagamento — aguardando confirmação por evidência real, nunca assumido automaticamente.");

    case "confirmacao_rejeitada": {
      if (pedido.status !== "aguardando_confirmacao_pagamento") {
        return { transicionou: false, motivo: "Só é possível rejeitar uma confirmação quando o pedido está aguardando confirmação." };
      }
      return resultado(pedido, "confirmado", "Alegação de pagamento revisada por humano e não confirmada — pedido retomado.");
    }

    case "pagamento_confirmado":
      return resultado(pedido, "pago", "Pagamento confirmado por evidência real.");

    case "cancelar_pedido":
      return resultado(pedido, "cancelado", "Pedido cancelado.");
  }
}

// ── Preço: sempre calculado pelo servidor, nunca aceito do cliente ──────

export type ItemCatalogo = {
  id:             string;
  clinicaId:      string;
  precoCentavos:  number | null; // null = item ainda sem preço público — não pode originar pedido com valor
};

/**
 * Único lugar que decide o valor de um pedido. Sempre a partir do preço
 * REAL do item de catálogo — nunca de um número informado pelo cliente.
 * `null` quando o item não tem preço definido ou a quantidade é inválida
 * — nunca inventa um valor.
 */
export function capturarValorPedido(item: ItemCatalogo, quantidade: number): number | null {
  if (item.precoCentavos === null) return null;
  if (!Number.isInteger(quantidade) || quantidade <= 0) return null;
  return item.precoCentavos * quantidade;
}

/**
 * Proteção contra manipulação de valor: nunca confia num `valorCentavos`
 * vindo do cliente/frontend — sempre recalcula a partir do catálogo real e
 * compara. Uma futura rota de criação de pedido deve rejeitar a
 * requisição inteira quando isto for `false`, nunca "corrigir" o valor
 * silenciosamente.
 */
export function valorFoiManipulado(valorRecebidoCentavos: number, item: ItemCatalogo, quantidade: number): boolean {
  const valorReal = capturarValorPedido(item, quantidade);
  return valorReal === null || valorReal !== valorRecebidoCentavos;
}

// ── Isolamento de tenant (defesa em profundidade, além da RLS) ──────────

/**
 * Um pedido nunca pode referenciar um item de catálogo de OUTRO tenant —
 * mesmo que a policy de RLS devesse impedir isso sozinha, esta checagem
 * explícita é a segunda camada (mesmo princípio de
 * docs/orcamento-venda-receita-v1-arquitetura.md seção 7.1: RLS nunca é a
 * única defesa).
 */
export function pertenceAoMesmoTenant(clinicaIdDoPedido: string, clinicaIdDoItem: string): boolean {
  return clinicaIdDoPedido === clinicaIdDoItem;
}

// ── Deduplicação / idempotência de criação ───────────────────────────────

/**
 * Nunca cria um segundo pedido com a mesma chave de idempotência (mesmo
 * padrão de `idempotency_key` em `orcamentos`/`cobrancas`) — protege
 * contra duplo clique/retry de rede gerando dois pedidos do mesmo evento
 * de compra. `idempotencyKey === null` (chamador não forneceu uma) sempre
 * libera — dedup fica a cargo de quem chama, mesmo padrão já estabelecido.
 */
export function podeCriarPedido(idempotencyKey: string | null, pedidosExistentes: { idempotencyKey: string | null }[]): boolean {
  if (idempotencyKey === null) return true;
  return !pedidosExistentes.some(p => p.idempotencyKey === idempotencyKey);
}
