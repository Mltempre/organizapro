// Estoque Comercial Básico V1 — regras puras (lib/motor-estoque.ts).
import test from "node:test";
import assert from "node:assert/strict";
import {
  efeitoEstoqueDoEvento, STATUS_NOVO_POR_EFEITO, normalizarSku, normalizarCodigoBarras, validarConfigEstoque,
  validarMovimentoManual, estoqueBaixo, buscarItens, mensagemEstoqueInsuficiente, estoqueIndisponivelNoBanco,
} from "../lib/motor-estoque.ts";

test("regra canônica: só confirmar baixa e só cancelar estorna", () => {
  assert.equal(efeitoEstoqueDoEvento("confirmar_pedido"), "baixa");
  assert.equal(efeitoEstoqueDoEvento("cancelar_pedido"), "estorno");
  for (const e of ["cliente_informou_pagamento", "pagamento_confirmado", "confirmacao_rejeitada", "qualquer"]) assert.equal(efeitoEstoqueDoEvento(e), null, e);
  assert.deepEqual(STATUS_NOVO_POR_EFEITO, { baixa: "confirmado", estorno: "cancelado" });
});

test("SKU e código de barras são opcionais e normalizados", () => {
  assert.deepEqual(normalizarSku(""), { ok: true, sku: null });
  assert.deepEqual(normalizarSku(undefined), { ok: true, sku: null });
  assert.deepEqual(normalizarSku("  CAM  PRETA M "), { ok: true, sku: "CAM PRETA M" });
  assert.equal(normalizarSku("x".repeat(61)).ok, false);
  assert.deepEqual(normalizarCodigoBarras(" 789 1234 567895 "), { ok: true, codigo: "7891234567895" });
  assert.deepEqual(normalizarCodigoBarras(""), { ok: true, codigo: null });
  assert.equal(normalizarCodigoBarras("789;DROP").ok, false);
});

test("configuração: só produto controla estoque; mínimo inteiro ≥ 0; mínimo some sem controle", () => {
  assert.equal(validarConfigEstoque({ tipo_item: "servico", controla_estoque: true }).ok, false);
  assert.equal(validarConfigEstoque({ tipo_item: "outro" }).ok, false);
  assert.equal(validarConfigEstoque({ tipo_item: "produto", controla_estoque: true, estoque_minimo: -1 }).ok, false);
  assert.equal(validarConfigEstoque({ tipo_item: "produto", controla_estoque: true, estoque_minimo: "1.5" }).ok, false);
  const ok = validarConfigEstoque({ tipo_item: "produto", sku: " PF-01 ", codigo_barras: "", controla_estoque: true, estoque_minimo: "2" });
  assert.deepEqual(ok, { ok: true, config: { tipo_item: "produto", sku: "PF-01", codigo_barras: null, controla_estoque: true, estoque_minimo: 2 } });
  const sem = validarConfigEstoque({ tipo_item: "produto", controla_estoque: false, estoque_minimo: 5 });
  assert.equal(sem.ok && sem.config.estoque_minimo, null);
});

test("movimento manual: entrada > 0; ajuste = saldo contado ≥ 0 com motivo", () => {
  assert.equal(validarMovimentoManual({ tipo: "entrada", quantidade: 0, motivo: "" }).ok, false);
  assert.equal(validarMovimentoManual({ tipo: "entrada", quantidade: 2.5, motivo: "" }).ok, false);
  assert.deepEqual(validarMovimentoManual({ tipo: "entrada", quantidade: 10, motivo: " " }), { ok: true, tipo: "entrada", quantidade: 10, motivo: null });
  assert.equal(validarMovimentoManual({ tipo: "ajuste", quantidade: 3, motivo: "" }).ok, false);
  assert.equal(validarMovimentoManual({ tipo: "ajuste", quantidade: -1, motivo: "perda" }).ok, false);
  assert.deepEqual(validarMovimentoManual({ tipo: "ajuste", quantidade: 0, motivo: "perda" }), { ok: true, tipo: "ajuste", quantidade: 0, motivo: "perda" });
  assert.equal(validarMovimentoManual({ tipo: "venda", quantidade: 1, motivo: "x" }).ok, false, "venda nunca é manual");
});

test("estoque baixo só com mínimo definido", () => {
  assert.equal(estoqueBaixo(2, 2), true);
  assert.equal(estoqueBaixo(3, 2), false);
  assert.equal(estoqueBaixo(0, null), false);
});

test("busca por nome sem acento, SKU ou código — correspondência exata primeiro (leitor)", () => {
  const itens = [
    { id: "1", nome: "Pastilha de freio dianteira", sku: "PF-01", codigo_barras: "7890000000011" },
    { id: "2", nome: "Camiseta preta M", sku: "CAM-M", codigo_barras: "7891234567895" },
    { id: "3", nome: "Pastilha traseira 7891234567895", sku: null, codigo_barras: null },
  ];
  assert.deepEqual(buscarItens(itens, "pastilha").map(i => i.id), ["1", "3"]);
  assert.deepEqual(buscarItens(itens, "7891234567895").map(i => i.id), ["2", "3"]);
  assert.deepEqual(buscarItens(itens, "pf-01").map(i => i.id), ["1"]);
  assert.deepEqual(buscarItens(itens, "CAMISETA").map(i => i.id), ["2"]);
  assert.equal(buscarItens(itens, "  ").length, 3);
});

test("mensagem de estoque insuficiente é clara", () => {
  assert.match(mensagemEstoqueInsuficiente([{ nome: "Camiseta preta M", saldo: 0, necessario: 1 }]), /Estoque insuficiente.*Camiseta preta M \(saldo 0, pedido 1\).*Estoque/);
});

test("detecta banco sem a migration (função/tabela/coluna inexistente)", () => {
  for (const code of ["PGRST202", "PGRST205", "42P01", "42883", "42703"]) assert.equal(estoqueIndisponivelNoBanco({ code }), true, code);
  assert.equal(estoqueIndisponivelNoBanco({ message: "Could not find the function public.x" }), true);
  assert.equal(estoqueIndisponivelNoBanco({ code: "23505", message: "duplicate key" }), false);
  assert.equal(estoqueIndisponivelNoBanco(null), false);
});
