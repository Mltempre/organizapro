// ── Testes reais (node:test) · lib/pedido-state-machine.ts ──────────────────
// Roda contra o JS REAL compilado — ver README-TESTES no mesmo diretório.
// Cobre a state machine do domínio de Pedido (E-commerce IA) ANTES de
// qualquer migration existir — puro, sem banco, sem LLM.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BUILD = process.env.SMART_COMMERCE_BUILD_DIR;
if (!BUILD) {
  throw new Error(
    "Defina SMART_COMMERCE_BUILD_DIR apontando para o diretorio com o build " +
    "commonjs de lib/pedido-state-machine.ts (ver README-TESTES.md)."
  );
}

const {
  podeTransicionar, ehEstadoTerminal, aplicarEvento,
  capturarValorPedido, valorFoiManipulado, pertenceAoMesmoTenant, podeCriarPedido,
} = require(`${BUILD}/pedido-state-machine.js`);

function pedido(overrides = {}) {
  return {
    id: "p1", clinicaId: "clinica-1", pacienteId: null, servicoId: "servico-1",
    nomeCliente: "Fernanda", telefone: "11988887777",
    valorCentavos: 5000, status: "criado",
    pagamentoInformadoEm: null, pagamentoConfirmadoEm: null, idempotencyKey: null,
    ...overrides,
  };
}

// ── Transições válidas ────────────────────────────────────────────────────

test("transicao: criado -> confirmado e legal", () => {
  assert.equal(podeTransicionar("criado", "confirmado"), true);
});

test("transicao: confirmado -> aguardando_confirmacao_pagamento/pago/cancelado sao legais", () => {
  assert.equal(podeTransicionar("confirmado", "aguardando_confirmacao_pagamento"), true);
  assert.equal(podeTransicionar("confirmado", "pago"), true);
  assert.equal(podeTransicionar("confirmado", "cancelado"), true);
});

// ── Transições inválidas rejeitadas ───────────────────────────────────────

test("transicao: criado NAO pode pular direto para pago", () => {
  assert.equal(podeTransicionar("criado", "pago"), false);
});

test("transicao: pago -> qualquer coisa e sempre falso (estado terminal)", () => {
  for (const destino of ["criado", "confirmado", "aguardando_confirmacao_pagamento", "cancelado"]) {
    assert.equal(podeTransicionar("pago", destino), false, destino);
  }
});

test("ehEstadoTerminal: pago e cancelado sao terminais; os demais nao sao", () => {
  assert.equal(ehEstadoTerminal("pago"), true);
  assert.equal(ehEstadoTerminal("cancelado"), true);
  for (const s of ["criado", "confirmado", "aguardando_confirmacao_pagamento"]) {
    assert.equal(ehEstadoTerminal(s), false, s);
  }
});

// ── aplicarEvento: fluxo feliz e guardas ──────────────────────────────────

test("aplicarEvento confirmar_pedido: criado -> confirmado", () => {
  const r = aplicarEvento(pedido({ status: "criado" }), { tipo: "confirmar_pedido" });
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "confirmado");
});

test("aplicarEvento: nenhum evento reabre um pedido pago", () => {
  const p = pedido({ status: "pago" });
  for (const evento of [{ tipo: "confirmar_pedido" }, { tipo: "cliente_informou_pagamento" }, { tipo: "cancelar_pedido" }]) {
    const r = aplicarEvento(p, evento);
    assert.equal(r.transicionou, false, JSON.stringify(evento));
  }
});

test("aplicarEvento: nenhum evento reabre um pedido cancelado", () => {
  const r = aplicarEvento(pedido({ status: "cancelado" }), { tipo: "pagamento_confirmado" });
  assert.equal(r.transicionou, false);
});

// ── Pagamento informado != confirmado ─────────────────────────────────────

test("aplicarEvento cliente_informou_pagamento: confirmado -> aguardando_confirmacao_pagamento, NUNCA pago direto", () => {
  const r = aplicarEvento(pedido({ status: "confirmado" }), { tipo: "cliente_informou_pagamento" });
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "aguardando_confirmacao_pagamento");
  assert.notEqual(r.novoStatus, "pago");
});

test("aplicarEvento confirmacao_rejeitada: aguardando_confirmacao_pagamento -> confirmado (alegacao nao procede)", () => {
  const r = aplicarEvento(pedido({ status: "aguardando_confirmacao_pagamento" }), { tipo: "confirmacao_rejeitada" });
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "confirmado");
});

test("aplicarEvento confirmacao_rejeitada: so e valido a partir de aguardando_confirmacao_pagamento", () => {
  const r = aplicarEvento(pedido({ status: "confirmado" }), { tipo: "confirmacao_rejeitada" });
  assert.equal(r.transicionou, false);
});

test("aplicarEvento pagamento_confirmado: confirmado -> pago (evidencia real, sem depender de alegacao previa)", () => {
  const r = aplicarEvento(pedido({ status: "confirmado" }), { tipo: "pagamento_confirmado" });
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "pago");
});

test("aplicarEvento pagamento_confirmado: tambem funciona a partir de aguardando_confirmacao_pagamento", () => {
  const r = aplicarEvento(pedido({ status: "aguardando_confirmacao_pagamento" }), { tipo: "pagamento_confirmado" });
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "pago");
});

// ── Cancelamento ──────────────────────────────────────────────────────────

test("aplicarEvento cancelar_pedido: funciona a partir de criado/confirmado/aguardando_confirmacao_pagamento", () => {
  for (const status of ["criado", "confirmado", "aguardando_confirmacao_pagamento"]) {
    const r = aplicarEvento(pedido({ status }), { tipo: "cancelar_pedido" });
    assert.equal(r.transicionou, true, status);
    assert.equal(r.novoStatus, "cancelado", status);
  }
});

// ── Preço em centavos, calculado pelo servidor ────────────────────────────

test("capturarValorPedido: multiplica preco do item pela quantidade, em centavos", () => {
  const item = { id: "s1", clinicaId: "clinica-1", precoCentavos: 4990 };
  assert.equal(capturarValorPedido(item, 2), 9980);
});

test("capturarValorPedido: null quando o item nao tem preco definido (nunca inventa)", () => {
  const item = { id: "s1", clinicaId: "clinica-1", precoCentavos: null };
  assert.equal(capturarValorPedido(item, 1), null);
});

test("capturarValorPedido: null para quantidade zero, negativa ou nao-inteira", () => {
  const item = { id: "s1", clinicaId: "clinica-1", precoCentavos: 1000 };
  assert.equal(capturarValorPedido(item, 0), null);
  assert.equal(capturarValorPedido(item, -1), null);
  assert.equal(capturarValorPedido(item, 1.5), null);
});

// ── Proteção contra manipulação de valor ─────────────────────────────────

test("valorFoiManipulado: false quando o valor recebido bate com o preco real do catalogo", () => {
  const item = { id: "s1", clinicaId: "clinica-1", precoCentavos: 4990 };
  assert.equal(valorFoiManipulado(9980, item, 2), false);
});

test("valorFoiManipulado: true quando o cliente tenta enviar um valor menor que o real (manipulacao)", () => {
  const item = { id: "s1", clinicaId: "clinica-1", precoCentavos: 4990 };
  assert.equal(valorFoiManipulado(100, item, 2), true);
});

test("valorFoiManipulado: true quando o item nao tem preco real (nao ha valor legitimo possivel)", () => {
  const item = { id: "s1", clinicaId: "clinica-1", precoCentavos: null };
  assert.equal(valorFoiManipulado(5000, item, 1), true);
});

// ── Isolamento de tenant (defesa em profundidade) ────────────────────────

test("pertenceAoMesmoTenant: true quando pedido e item sao da mesma clinica", () => {
  assert.equal(pertenceAoMesmoTenant("clinica-1", "clinica-1"), true);
});

test("pertenceAoMesmoTenant: false quando o item pertence a outra clinica (cross-tenant)", () => {
  assert.equal(pertenceAoMesmoTenant("clinica-1", "clinica-2"), false);
});

// ── Idempotência de criação ───────────────────────────────────────────────

test("podeCriarPedido: false quando ja existe um pedido com a mesma chave de idempotencia", () => {
  const existentes = [{ idempotencyKey: "abc123" }];
  assert.equal(podeCriarPedido("abc123", existentes), false);
});

test("podeCriarPedido: true quando a chave e diferente de todas as existentes", () => {
  const existentes = [{ idempotencyKey: "abc123" }];
  assert.equal(podeCriarPedido("xyz789", existentes), true);
});

test("podeCriarPedido: true quando nenhuma chave e fornecida (dedup fica a cargo de quem chama)", () => {
  assert.equal(podeCriarPedido(null, [{ idempotencyKey: "abc123" }]), true);
});
