// ── Motor de Pedidos — E-commerce IA V1 ──────────────────────────────────
//
// Domínio puro (sem DB/HTTP), portado e estendido de lib/pedido-state-
// machine.ts (branch audit/smart-commerce-precheck, commit c6b81ae,
// auditado em segurança no commit 173800e — classificação B, sem achado
// que invalide a lógica pura). Máquina de estados e proteção de preço
// idênticas ao original; a extensão desta versão é suporte a MÚLTIPLOS
// itens por pedido (capturarValorItens), que a versão original não tinha.
//
// `pedido` não é um `orcamento` disfarçado: um orçamento nasce de uma
// negociação (tem validade, pode expirar, pode ser recusado); um pedido
// nasce de item(ns) de catálogo já precificado(s) (`clinica_servicos`),
// sem negociação nem validade. Entidades irmãs do mesmo domínio econômico,
// nunca a mesma tabela — convergem no que produzem ("receita comprovada"),
// nunca na estrutura interna.

export type PedidoStatus =
  | "criado"                          // pedido registrado, aguardando confirmação do lojista
  | "confirmado"                      // lojista aceitou — compromisso real, ainda sem pagamento
  | "aguardando_confirmacao_pagamento" // cliente informou pagamento — NUNCA confirmado só por isso
  | "pago"                            // terminal — pagamento CONFIRMADO por evidência real
  | "cancelado";                       // terminal

export type Pedido = {
  id:                     string;
  clinicaId:              string;
  pacienteId:             string | null;
  nomeCliente:            string;
  telefone:               string | null;
  valorCentavos:          number; // soma dos itens, capturada na criação — nunca recalculada depois
  status:                 PedidoStatus;
  pagamentoInformadoEm:   string | null;
  pagamentoConfirmadoEm:  string | null;
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

function resultado(pedido: Pick<Pedido, "status">, novoStatus: PedidoStatus, motivo: string): ResultadoEvento {
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
export function aplicarEvento(pedido: Pick<Pedido, "status">, evento: EventoPedido): ResultadoEvento {
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
  precoCentavos:  number | null; // null = item ainda sem preço público — não pode originar item de pedido vinculado a ele
  disponivel:     boolean;       // false = não pode originar pedido novo (continua existindo/visível)
};

/**
 * Único lugar que decide o valor de UM item de pedido. Sempre a partir do
 * preço REAL do item de catálogo — nunca de um número informado pelo
 * cliente. `null` quando o item não tem preço definido, está indisponível,
 * ou a quantidade é inválida — nunca inventa um valor.
 */
export function capturarValorItem(item: ItemCatalogo, quantidade: number): number | null {
  if (item.precoCentavos === null) return null;
  if (!item.disponivel) return null;
  if (!Number.isInteger(quantidade) || quantidade <= 0) return null;
  return item.precoCentavos * quantidade;
}

/**
 * Extensão desta versão (o original só tratava 1 item por pedido): soma o
 * valor de vários itens de catálogo. `null` inteiro se QUALQUER item for
 * inválido (preço ausente, indisponível, ou quantidade inválida) — nunca
 * soma parcialmente ignorando o item ruim.
 */
export function capturarValorItens(itens: { item: ItemCatalogo; quantidade: number }[]): number | null {
  if (itens.length === 0) return null;
  let total = 0;
  for (const { item, quantidade } of itens) {
    const valor = capturarValorItem(item, quantidade);
    if (valor === null) return null;
    total += valor;
  }
  return total;
}

/**
 * Proteção contra manipulação de valor: nunca confia num `valorCentavos`
 * vindo do cliente/frontend — sempre recalcula a partir do catálogo real e
 * compara. Uma rota de criação de pedido deve rejeitar a requisição
 * inteira quando isto for `true`, nunca "corrigir" o valor silenciosamente.
 */
export function valorFoiManipulado(valorRecebidoCentavos: number, item: ItemCatalogo, quantidade: number): boolean {
  const valorReal = capturarValorItem(item, quantidade);
  return valorReal === null || valorReal !== valorRecebidoCentavos;
}

// ── Isolamento de tenant (defesa em profundidade, além da RLS) ──────────

/**
 * Um pedido (ou um item de pedido) nunca pode referenciar um item de
 * catálogo de OUTRO tenant — mesmo que a policy/trigger de banco devesse
 * impedir isso sozinha, esta checagem explícita é a segunda camada (mesmo
 * princípio de docs/orcamento-venda-receita-v1-arquitetura.md seção 7.1:
 * RLS/trigger nunca é a única defesa).
 */
export function pertenceAoMesmoTenant(clinicaIdDoPedido: string, clinicaIdDoItem: string): boolean {
  return clinicaIdDoPedido === clinicaIdDoItem;
}
