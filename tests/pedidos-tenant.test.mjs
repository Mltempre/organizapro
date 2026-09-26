// Guarda estática de isolamento de tenant + idempotência para as rotas de
// pedidos — mesmo papel de tests/orcamentos-tenant.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Normaliza CRLF->LF: git pode reescrever line endings no checkout
// (core.autocrlf) dependendo do worktree — os padrões abaixo usam \n
// literal e não podem depender de como o Windows fez o checkout.
const normalizar = (s) => s.replace(/\r\n/g, "\n");
const rotaListaCria = normalizar(readFileSync(path.join(root, "app/api/pedidos/route.ts"), "utf8"));
const rotaTransicao = normalizar(readFileSync(path.join(root, "app/api/pedidos/[id]/transicao/route.ts"), "utf8"));
const migration = normalizar(readFileSync(path.join(root, "supabase/migrations/20260920000001_pedidos_ecommerce_ia_v1.sql"), "utf8"));
const dashboard = normalizar(readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8"));

test("GET /api/pedidos: autoriza antes de qualquer leitura, e a leitura é filtrada por clinica_id", () => {
  const idxGet = rotaListaCria.indexOf("export async function GET");
  const trecho = rotaListaCria.slice(idxGet);
  assert.match(trecho, /autorizarUsuarioNaClinica\(req, clinica_id\)/);
  assert.match(trecho, /\.from\("pedidos"\)\.select\("\*, pedido_itens\(\*\)"\)\.eq\("clinica_id", clinica_id\)/);
});

test("POST /api/pedidos: autoriza antes de qualquer escrita", () => {
  const idxPost = rotaListaCria.indexOf("export async function POST");
  const idxAuth = rotaListaCria.indexOf("autorizarUsuarioNaClinica(req, clinica_id)", idxPost);
  const idxInsertPedido = rotaListaCria.indexOf('.from("pedidos")\n    .insert(', idxPost);
  assert.ok(idxAuth > idxPost, "autorização não encontrada dentro de POST");
  assert.ok(idxInsertPedido > idxAuth, "insert em pedidos acontece antes da autorização");
});

test("POST /api/pedidos: item com servico_id sempre busca o preço real filtrado por clinica_id (nunca aceita preço do body)", () => {
  assert.match(rotaListaCria, /\.from\("clinica_servicos"\)\s*\.select\("id, clinica_id, nome, preco_centavos, disponivel"\)\s*\.eq\("clinica_id", clinica_id\)/);
  assert.match(rotaListaCria, /capturarValorItem\(itemCatalogo, it\.quantidade\)/);
  // Nenhum branch do código usa um valor_unitario_centavos vindo do body
  // quando servico_id está presente — só no ramo do item avulso (else).
  const idxComServico = rotaListaCria.indexOf("if (it.servico_id) {");
  const idxElseAvulso = rotaListaCria.indexOf("} else {", idxComServico);
  const trechoComServico = rotaListaCria.slice(idxComServico, idxElseAvulso);
  assert.doesNotMatch(trechoComServico, /it\.valor_unitario_centavos/);
});

test("POST /api/pedidos: item avulso (sem servico_id) nunca é aceito em pedido de origem site_publico", () => {
  assert.match(rotaListaCria, /origem === "site_publico"[\s\S]{0,80}pedido de origem site_publico só aceita itens de catálogo/);
});

test("POST /api/pedidos: idempotência via eventos_dominio, filtrada por clinica_id, mesmo padrão dos outros 3 motores", () => {
  assert.match(rotaListaCria, /\.from\("eventos_dominio"\)\s*\.select\("entidade_id"\)\s*\.eq\("clinica_id", clinica_id\)\s*\.eq\("chave_idempotencia", chaveIdempotencia\)/);
  assert.match(rotaListaCria, /tipo: "pedido\.criado"/);
});

test("transição /api/pedidos: SELECT do pedido é escopado por id E clinica_id (nunca só por id)", () => {
  assert.match(
    rotaTransicao,
    /\.from\("pedidos"\)\s*\.select\("\*"\)\s*\.eq\("id", id\)\s*\.eq\("clinica_id", clinica_id\)/
  );
});

test("transição /api/pedidos: UPDATE também escopado por clinica_id (defesa em profundidade)", () => {
  const idxUpdate = rotaTransicao.indexOf(".update(atualizacao)");
  const trecho = rotaTransicao.slice(idxUpdate, idxUpdate + 200);
  assert.match(trecho, /\.eq\("clinica_id", clinica_id\)/);
});

test("transição /api/pedidos: só aceita os 5 eventos reais da máquina de estados, nunca um novo_status arbitrário no body", () => {
  assert.match(rotaTransicao, /confirmar_pedido.*cliente_informou_pagamento.*confirmacao_rejeitada.*pagamento_confirmado.*cancelar_pedido/s);
  // O comentário do arquivo cita "novo_status" só para explicar a diferença
  // de design em relação às outras 3 rotas — a checagem real é que o body
  // desestruturado nunca lê esse campo (só `evento`).
  assert.match(rotaTransicao, /const \{ clinica_id, evento \} = body;/);
  assert.doesNotMatch(rotaTransicao, /body\.novo_status/);
});

test("migration: pedido_itens tem trigger de integridade cross-tenant para servico_id E pedido_id", () => {
  assert.match(migration, /servico_id % nao pertence a clinica_id %/);
  assert.match(migration, /pedido_id % nao pertence a clinica_id %/);
});

test("migration: pedidos/pedido_itens ficam RLS-enabled sem nenhuma policy (service role only), mesmo padrão canônico", () => {
  const semPolicyPedidos = !/CREATE POLICY[\s\S]*ON public\.pedidos\b/.test(migration.replace(/pedido_itens/g, ""));
  assert.equal(semPolicyPedidos, true, "pedidos não deveria ter nenhuma CREATE POLICY");
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*ON public\.pedido_itens/);
});

test("dashboard: recompra_possivel é agregada a partir da MESMA lista de /api/pedidos?clinica_id, nunca uma consulta nova", () => {
  // Uma única fetch tenant-escopada alimenta os dois recortes.
  assert.match(dashboard, /todosPedidosPromise = fetch\(`\/api\/pedidos\?clinica_id=\$\{cid\}`/);
  assert.match(dashboard, /const todosPedidosRows = await todosPedidosPromise;/);
  assert.match(dashboard, /const pedidosNaoConcluidosRows = todosPedidosRows\.filter/);
  // agregarClientesElegiveisRecompra só é chamada com dados de dash.todosPedidosRows
  // (o mesmo estado tenant-escopado), nunca com uma fonte paralela.
  const idxChamada = dashboard.indexOf("agregarClientesElegiveisRecompra(");
  assert.ok(idxChamada > -1, "chamada de agregarClientesElegiveisRecompra não encontrada");
  const trecho = dashboard.slice(idxChamada, idxChamada + 120);
  assert.match(trecho, /dash\.todosPedidosRows\.map/);
});
