// Testes do Motor de Pedidos (lib/motor-pedidos.ts) — E-commerce IA V1.
// Mesma convenção já usada em convergencia/orcamentos: node:test contra o
// JS real compilado do TypeScript.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/motor-pedidos.ecommerce.test.mjs
// (build inclui lib/motor-pedidos.ts)

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");

const motor = await import(pathToFileURL(path.join(buildDir, "motor-pedidos.js")));

// ── Máquina de estados (eventos) ─────────────────────────────────────────

test("aplicarEvento: confirmar_pedido leva criado -> confirmado", () => {
  const r = motor.aplicarEvento({ status: "criado" }, { tipo: "confirmar_pedido" });
  assert.deepEqual(r, { transicionou: true, novoStatus: "confirmado", motivo: "Lojista confirmou o pedido." });
});

test("aplicarEvento: cliente_informou_pagamento NUNCA vira pago diretamente", () => {
  const r = motor.aplicarEvento({ status: "confirmado" }, { tipo: "cliente_informou_pagamento" });
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "aguardando_confirmacao_pagamento");
  assert.notEqual(r.novoStatus, "pago");
});

test("aplicarEvento: confirmacao_rejeitada só é válida a partir de aguardando_confirmacao_pagamento", () => {
  const rInvalido = motor.aplicarEvento({ status: "confirmado" }, { tipo: "confirmacao_rejeitada" });
  assert.equal(rInvalido.transicionou, false);
  const rValido = motor.aplicarEvento({ status: "aguardando_confirmacao_pagamento" }, { tipo: "confirmacao_rejeitada" });
  assert.deepEqual(rValido, { transicionou: true, novoStatus: "confirmado", motivo: "Alegação de pagamento revisada por humano e não confirmada — pedido retomado." });
});

test("aplicarEvento: estado terminal (pago/cancelado) nunca é reaberto por nenhum evento", () => {
  for (const status of ["pago", "cancelado"]) {
    for (const tipo of ["confirmar_pedido", "cliente_informou_pagamento", "pagamento_confirmado", "cancelar_pedido"]) {
      const r = motor.aplicarEvento({ status }, { tipo });
      assert.equal(r.transicionou, false, `${status} + ${tipo} deveria ser rejeitado`);
    }
  }
});

test("aplicarEvento: pagamento_confirmado direto de confirmado (sem passar por aguardando) é permitido", () => {
  const r = motor.aplicarEvento({ status: "confirmado" }, { tipo: "pagamento_confirmado" });
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "pago");
});

test("ehEstadoTerminal: só pago/cancelado", () => {
  assert.equal(motor.ehEstadoTerminal("pago"), true);
  assert.equal(motor.ehEstadoTerminal("cancelado"), true);
  assert.equal(motor.ehEstadoTerminal("criado"), false);
  assert.equal(motor.ehEstadoTerminal("confirmado"), false);
  assert.equal(motor.ehEstadoTerminal("aguardando_confirmacao_pagamento"), false);
});

// ── Preço: sempre do catálogo, nunca do cliente ─────────────────────────

test("capturarValorItem: item sem preço nunca origina valor (null, nunca 0)", () => {
  const item = { id: "i1", clinicaId: "c1", precoCentavos: null, disponivel: true };
  assert.equal(motor.capturarValorItem(item, 2), null);
});

test("capturarValorItem: item indisponível nunca origina valor mesmo com preço", () => {
  const item = { id: "i1", clinicaId: "c1", precoCentavos: 1000, disponivel: false };
  assert.equal(motor.capturarValorItem(item, 2), null);
});

test("capturarValorItem: quantidade inválida (0, negativa, fracionária) nunca origina valor", () => {
  const item = { id: "i1", clinicaId: "c1", precoCentavos: 1000, disponivel: true };
  assert.equal(motor.capturarValorItem(item, 0), null);
  assert.equal(motor.capturarValorItem(item, -1), null);
  assert.equal(motor.capturarValorItem(item, 1.5), null);
});

test("capturarValorItem: multiplica preço real × quantidade, nunca aceita valor externo", () => {
  const item = { id: "i1", clinicaId: "c1", precoCentavos: 1500, disponivel: true };
  assert.equal(motor.capturarValorItem(item, 3), 4500);
});

test("capturarValorItens: soma vários itens válidos", () => {
  const itens = [
    { item: { id: "i1", clinicaId: "c1", precoCentavos: 1000, disponivel: true }, quantidade: 2 },
    { item: { id: "i2", clinicaId: "c1", precoCentavos: 500, disponivel: true }, quantidade: 3 },
  ];
  assert.equal(motor.capturarValorItens(itens), 3500);
});

test("capturarValorItens: um único item inválido invalida o pedido inteiro (nunca soma parcial)", () => {
  const itens = [
    { item: { id: "i1", clinicaId: "c1", precoCentavos: 1000, disponivel: true }, quantidade: 2 },
    { item: { id: "i2", clinicaId: "c1", precoCentavos: null, disponivel: true }, quantidade: 1 },
  ];
  assert.equal(motor.capturarValorItens(itens), null);
});

test("capturarValorItens: lista vazia é null, nunca 0 fantasioso", () => {
  assert.equal(motor.capturarValorItens([]), null);
});

test("valorFoiManipulado: detecta valor divergente do catálogo real", () => {
  const item = { id: "i1", clinicaId: "c1", precoCentavos: 1000, disponivel: true };
  assert.equal(motor.valorFoiManipulado(9999, item, 1), true);
  assert.equal(motor.valorFoiManipulado(1000, item, 1), false);
});

test("pertenceAoMesmoTenant: só true quando as duas clinica_id batem exatamente", () => {
  assert.equal(motor.pertenceAoMesmoTenant("c1", "c1"), true);
  assert.equal(motor.pertenceAoMesmoTenant("c1", "c2"), false);
});

// ── agregarClientesElegiveisRecompra ────────────────────────────────────

test("agregarClientesElegiveisRecompra: cliente cujo pedido mais recente está pago vira candidato, com a data real de pagamento", () => {
  const resultado = motor.agregarClientesElegiveisRecompra([
    { pacienteId: "p1", telefone: "11911112222", nomeCliente: "Carla Dias", status: "pago", criadoEm: "2026-06-01T10:00:00Z", pagamentoConfirmadoEm: "2026-06-01T12:00:00Z" },
  ]);
  assert.equal(resultado.length, 1);
  assert.deepEqual(resultado[0], { pacienteNome: "Carla Dias", telefone: "11911112222", ultimoPedidoPagoEm: "2026-06-01T12:00:00Z" });
});

test("agregarClientesElegiveisRecompra: cliente com pedido novo posterior (mesmo não pago) ao último pago NÃO vira candidato — o pedido mais recente manda", () => {
  const resultado = motor.agregarClientesElegiveisRecompra([
    { pacienteId: "p1", telefone: "11911112222", nomeCliente: "Carla Dias", status: "pago", criadoEm: "2026-06-01T10:00:00Z", pagamentoConfirmadoEm: "2026-06-01T12:00:00Z" },
    { pacienteId: "p1", telefone: "11911112222", nomeCliente: "Carla Dias", status: "criado", criadoEm: "2026-08-01T10:00:00Z", pagamentoConfirmadoEm: null },
  ]);
  assert.equal(resultado.length, 0);
});

test("agregarClientesElegiveisRecompra: pedido pago sem pagamentoConfirmadoEm (dado incompleto) nunca fabrica uma data", () => {
  const resultado = motor.agregarClientesElegiveisRecompra([
    { pacienteId: "p1", telefone: "11911112222", nomeCliente: "Carla Dias", status: "pago", criadoEm: "2026-06-01T10:00:00Z", pagamentoConfirmadoEm: null },
  ]);
  assert.equal(resultado.length, 0);
});

test("agregarClientesElegiveisRecompra: pedido sem paciente_id nem telefone é descartado, nunca vira meio-cliente", () => {
  const resultado = motor.agregarClientesElegiveisRecompra([
    { pacienteId: null, telefone: null, nomeCliente: "Anônimo", status: "pago", criadoEm: "2026-06-01T10:00:00Z", pagamentoConfirmadoEm: "2026-06-01T12:00:00Z" },
  ]);
  assert.equal(resultado.length, 0);
});

test("agregarClientesElegiveisRecompra: agrupa por paciente_id mesmo quando o telefone informado muda entre os pedidos", () => {
  const resultado = motor.agregarClientesElegiveisRecompra([
    { pacienteId: "p1", telefone: "11911112222", nomeCliente: "Carla Dias", status: "cancelado", criadoEm: "2026-05-01T10:00:00Z", pagamentoConfirmadoEm: null },
    { pacienteId: "p1", telefone: "11999998888", nomeCliente: "Carla Dias", status: "pago", criadoEm: "2026-06-01T10:00:00Z", pagamentoConfirmadoEm: "2026-06-01T12:00:00Z" },
  ]);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].telefone, "11999998888");
});

test("agregarClientesElegiveisRecompra: sem paciente_id, agrupa por telefone normalizado", () => {
  const resultado = motor.agregarClientesElegiveisRecompra([
    { pacienteId: null, telefone: "(11) 91111-2222", nomeCliente: "Site Público", status: "pago", criadoEm: "2026-06-01T10:00:00Z", pagamentoConfirmadoEm: "2026-06-01T12:00:00Z" },
    { pacienteId: null, telefone: "11911112222", nomeCliente: "Site Público", status: "criado", criadoEm: "2026-08-01T10:00:00Z", pagamentoConfirmadoEm: null },
  ]);
  assert.equal(resultado.length, 0, "mesmo telefone em formatos diferentes deve ser o mesmo cliente, e o pedido de agosto é o mais recente");
});

test("agregarClientesElegiveisRecompra: dois clientes distintos nunca se misturam (isolamento por chave)", () => {
  const resultado = motor.agregarClientesElegiveisRecompra([
    { pacienteId: "p1", telefone: "11911112222", nomeCliente: "Cliente A", status: "pago", criadoEm: "2026-06-01T10:00:00Z", pagamentoConfirmadoEm: "2026-06-01T12:00:00Z" },
    { pacienteId: "p2", telefone: "11933334444", nomeCliente: "Cliente B", status: "criado", criadoEm: "2026-08-01T10:00:00Z", pagamentoConfirmadoEm: null },
  ]);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].pacienteNome, "Cliente A");
});

test("agregarClientesElegiveisRecompra: idempotente — mesma entrada duas vezes produz exatamente o mesmo resultado, nunca duplicado", () => {
  const entrada = [
    { pacienteId: "p1", telefone: "11911112222", nomeCliente: "Carla Dias", status: "pago", criadoEm: "2026-06-01T10:00:00Z", pagamentoConfirmadoEm: "2026-06-01T12:00:00Z" },
  ];
  assert.deepEqual(motor.agregarClientesElegiveisRecompra(entrada), motor.agregarClientesElegiveisRecompra(entrada));
});

test("agregarClientesElegiveisRecompra: entrada vazia real nunca fabrica candidato", () => {
  assert.deepEqual(motor.agregarClientesElegiveisRecompra([]), []);
});
