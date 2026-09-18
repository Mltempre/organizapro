// ── Testes reais (node:test) · lib/orcamentos-state-machine.ts ─────────────
// Roda contra o JS REAL compilado (não uma reimplementação) — ver
// README-TESTES no mesmo diretório. Cobre a state machine do domínio
// Orçamento → Venda → Receita ANTES de qualquer migration existir — puro,
// sem banco, sem schema.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BUILD = process.env.SMART_COMMERCE_BUILD_DIR;
if (!BUILD) {
  throw new Error(
    "Defina SMART_COMMERCE_BUILD_DIR apontando para o diretorio com o build " +
    "commonjs de lib/orcamentos-state-machine.ts (ver README-TESTES.md)."
  );
}

const {
  podeTransicionar, ehEstadoTerminal,
  orcamentoExpirado, orcamentoExpirando,
  calcularStatusPagamento,
} = require(`${BUILD}/orcamentos-state-machine.js`);

const HOJE = "2026-09-18";

// ── State machine: transições legais ────────────────────────────────────

test("transicao: criado -> enviado e legal", () => {
  assert.equal(podeTransicionar("criado", "enviado"), true);
});

test("transicao: enviado -> aceito/recusado/expirado sao legais", () => {
  assert.equal(podeTransicionar("enviado", "aceito"), true);
  assert.equal(podeTransicionar("enviado", "recusado"), true);
  assert.equal(podeTransicionar("enviado", "expirado"), true);
});

test("transicao: criado NAO pode pular direto para aceito/recusado/expirado", () => {
  assert.equal(podeTransicionar("criado", "aceito"), false);
  assert.equal(podeTransicionar("criado", "recusado"), false);
  assert.equal(podeTransicionar("criado", "expirado"), false);
});

test("transicao: nenhum estado terminal (aceito/recusado/expirado) permite nova transicao", () => {
  assert.equal(podeTransicionar("aceito", "enviado"), false);
  assert.equal(podeTransicionar("aceito", "recusado"), false);
  assert.equal(podeTransicionar("recusado", "aceito"), false);
  assert.equal(podeTransicionar("expirado", "enviado"), false);
});

test("ehEstadoTerminal: aceito/recusado/expirado sao terminais; criado/enviado nao sao", () => {
  assert.equal(ehEstadoTerminal("aceito"), true);
  assert.equal(ehEstadoTerminal("recusado"), true);
  assert.equal(ehEstadoTerminal("expirado"), true);
  assert.equal(ehEstadoTerminal("criado"), false);
  assert.equal(ehEstadoTerminal("enviado"), false);
});

// ── Vencimento: sempre computado ao vivo ────────────────────────────────

test("orcamentoExpirado: false quando nao ha validade definida (nunca inventa prazo)", () => {
  assert.equal(orcamentoExpirado("enviado", null, HOJE), false);
});

test("orcamentoExpirado: false quando a validade ainda nao passou", () => {
  assert.equal(orcamentoExpirado("enviado", "2026-09-20", HOJE), false);
});

test("orcamentoExpirado: true quando enviado e a validade ja passou", () => {
  assert.equal(orcamentoExpirado("enviado", "2026-09-01", HOJE), true);
});

test("orcamentoExpirado: false para status terminal, mesmo com validade vencida (ja foi decidido)", () => {
  assert.equal(orcamentoExpirado("aceito", "2026-09-01", HOJE), false);
  assert.equal(orcamentoExpirado("recusado", "2026-09-01", HOJE), false);
});

test("orcamentoExpirando: false sem validade definida", () => {
  assert.equal(orcamentoExpirando("enviado", null, HOJE), false);
});

test("orcamentoExpirando: true dentro da janela padrao de 3 dias", () => {
  assert.equal(orcamentoExpirando("enviado", "2026-09-20", HOJE), true); // 2 dias
  assert.equal(orcamentoExpirando("enviado", "2026-09-21", HOJE), true); // 3 dias
});

test("orcamentoExpirando: false fora da janela (mais de 3 dias)", () => {
  assert.equal(orcamentoExpirando("enviado", "2026-09-25", HOJE), false); // 7 dias
});

test("orcamentoExpirando: false quando ja expirou (isso e orcamentoExpirado, nao expirando)", () => {
  assert.equal(orcamentoExpirando("enviado", "2026-09-01", HOJE), false);
});

test("orcamentoExpirando e orcamentoExpirado sao mutuamente exclusivos em qualquer data", () => {
  const datas = ["2026-08-01", "2026-09-15", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-21", "2026-10-01"];
  for (const validade of datas) {
    const expirando = orcamentoExpirando("enviado", validade, HOJE);
    const expirado = orcamentoExpirado("enviado", validade, HOJE);
    assert.equal(expirando && expirado, false, `validade=${validade} nao pode ser expirando E expirado ao mesmo tempo`);
  }
});

// ── Pagamento: tri-estado puro ──────────────────────────────────────────

test("calcularStatusPagamento: null quando valor nao foi informado (nunca inventa 'nao_pago')", () => {
  assert.equal(calcularStatusPagamento(null, 0), null);
  assert.equal(calcularStatusPagamento(null, 500), null);
});

test("calcularStatusPagamento: nao_pago quando soma de pagamentos e zero", () => {
  assert.equal(calcularStatusPagamento(10000, 0), "nao_pago");
});

test("calcularStatusPagamento: parcial quando pagou menos que o valor total", () => {
  assert.equal(calcularStatusPagamento(10000, 4000), "parcial");
});

test("calcularStatusPagamento: pago quando a soma bate ou excede o valor total", () => {
  assert.equal(calcularStatusPagamento(10000, 10000), "pago");
  assert.equal(calcularStatusPagamento(10000, 10500), "pago"); // pagamento a mais (ex.: troco/erro) ainda conta como pago
});
