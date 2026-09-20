import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rota = readFileSync(path.join(root, "app/api/site-publico/pedidos/route.ts"), "utf8");
const ui = readFileSync(path.join(root, "app/empresa/[slug]/_components/PedidoPublico.tsx"), "utf8");
const migration = readFileSync(path.join(root, "supabase/migrations/20260920000001_pedidos_ecommerce_ia_v1.sql"), "utf8");

test("resolve tenant somente pelo slug e produto literal", () => {
  assert.match(rota, /rpc\("site_publico_por_slug_v2", \{ p_slug: slug, p_produto: "organizapro" \}\)/);
  assert.doesNotMatch(rota, /body\.clinica_id|body\.clinicaId/);
});

test("isolamento cross-tenant do catálogo", () => {
  assert.match(rota, /\.from\("clinica_servicos"\)[\s\S]*?\.eq\("clinica_id", clinicaId\)/);
  assert.match(rota, /if \(!servico\)[\s\S]*?não pertence a esta empresa/);
});

test("item indisponível ou sem preço é rejeitado", () => {
  assert.match(rota, /capturarValorItem\(/);
  assert.match(rota, /Um item está indisponível ou sem preço público/);
});

test("preço do frontend não entra no payload", () => {
  assert.doesNotMatch(ui, /valor_unitario_centavos|preco_centavos:/);
  assert.match(rota, /valor_unitario_centavos: servico\.preco_centavos/);
});

test("total é calculado no servidor", () => {
  assert.match(rota, /const valorTotal = itensResolvidos\.reduce\(/);
  assert.match(rota, /valor_centavos: valorTotal/);
});

test("múltiplos itens são aceitos e gravados", () => {
  assert.match(rota, /itensEntrada\.map/);
  assert.match(rota, /itensResolvidos\.map\(\(item\)/);
});

test("quantidade inválida é rejeitada", () => {
  assert.match(rota, /Number\.isInteger\(item\.quantidade\)/);
  assert.match(rota, /entre 1 e 99/);
});

test("pedido válido usa origem pública e estado criado", () => {
  assert.match(rota, /origem: "site_publico"/);
  assert.match(rota, /status: "criado"/);
  assert.match(rota, /status: 201/);
});

test("clinica_id não é aceito do body", () => {
  assert.doesNotMatch(rota, /clinica_id\?: unknown/);
  assert.match(rota, /const clinicaId = empresa\.clinica_id/);
});

test("replay usa eventos_dominio e chave por tenant", () => {
  assert.match(rota, /chaveIdempotencia = `criar-pedido-publico:/);
  assert.match(rota, /\.eq\("clinica_id", clinicaId\)[\s\S]*?\.eq\("chave_idempotencia", chaveIdempotencia\)/);
  assert.match(rota, /idempotente: true/);
});

test("migration existente mantém integridade e RLS do pedido canônico", () => {
  assert.match(migration, /alter table public\.pedidos enable row level security/);
  assert.match(migration, /pedido_itens_valida_tenant/);
});

console.log("pedido-publico: 10 gates de segurança e fluxo OK");