import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (arquivo) => fs.readFileSync(path.join(root, arquivo), "utf8").replace(/\r\n/g, "\n");
const migration = ler("supabase/migrations/20260922000001_pesquisa_precos_v1.sql");
const servidor = ler("lib/pesquisa-precos-servidor.ts");
const itens = ler("app/api/pesquisa-precos/itens/route.ts");
const fontes = ler("app/api/pesquisa-precos/fontes/route.ts");
const observacoes = ler("app/api/pesquisa-precos/observacoes/route.ts");
const pagina = ler("app/pesquisa-precos/page.tsx");

test("migration cria as três tabelas privadas previstas", () => {
  for (const tabela of ["pesquisa_preco_itens", "pesquisa_preco_fontes", "pesquisa_preco_observacoes"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${tabela}`));
    assert.match(migration, new RegExp(`alter table public\\.${tabela} enable row level security`));
  }
});

test("anon não recebe grant nem policy e authenticated recebe somente SELECT", () => {
  assert.doesNotMatch(migration, /grant\s+(select|insert|update|delete)[\s\S]*\s+to\s+anon/i);
  assert.doesNotMatch(migration, /create policy[\s\S]*to anon/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)[\s\S]*to authenticated/i);
  assert.equal((migration.match(/grant select on public\.pesquisa_preco_/g) ?? []).length, 3);
});

test("policies exigem auth.uid, vínculo ativo e produto OrganizaPro", () => {
  assert.equal((migration.match(/cu\.usuario_id = auth\.uid\(\)/g) ?? []).length, 3);
  assert.equal((migration.match(/cu\.ativo = true/g) ?? []).length, 3);
  assert.equal((migration.match(/c\.produto = 'organizapro'/g) ?? []).length, 3);
});

test("trigger impede vínculos cross-tenant de serviço, item, fonte e correção", () => {
  assert.match(migration, /s\.id = new\.servico_id and s\.clinica_id = new\.clinica_id/);
  assert.match(migration, /i\.id = new\.item_id and i\.clinica_id = new\.clinica_id/);
  assert.match(migration, /f\.id = new\.fonte_id and f\.clinica_id = new\.clinica_id/);
  assert.match(migration, /o\.clinica_id = new\.clinica_id\s+and o\.item_id = new\.item_id/);
});

test("observações são imutáveis e correção é vínculo para nova linha", () => {
  assert.match(migration, /before update or delete on public\.pesquisa_preco_observacoes/);
  assert.match(migration, /observações de preço são imutáveis; registre uma correção/);
  assert.match(migration, /corrige_observacao_id\s+uuid references public\.pesquisa_preco_observacoes/);
  assert.doesNotMatch(observacoes, /\.update\(/);
  assert.doesNotMatch(observacoes, /\.delete\(/);
});

test("idempotência é garantida por tenant no banco e replay na API", () => {
  assert.match(migration, /unique \(clinica_id, chave_idempotencia\)/);
  assert.match(observacoes, /\.eq\("clinica_id", tenant\.clinicaId\)\.eq\("chave_idempotencia", chave\)/);
  assert.match(observacoes, /error\?\.code === "23505"/);
  assert.match(observacoes, /idempotente: true/);
  assert.match(observacoes, /Chave de idempotência já usada com conteúdo diferente/);
});

test("tenant vem da sessão e ambiguidade de dois vínculos falha fechado", () => {
  assert.match(servidor, /auth\.getUser\(bearer\)/);
  assert.match(servidor, /\.eq\("usuario_id", user\.id\)/);
  assert.match(servidor, /\.eq\("ativo", true\)/);
  assert.match(servidor, /vinculos\.length !== 1/);
  assert.match(servidor, /autorizarUsuarioNaClinica\(req, clinicaId\)/);
  for (const rota of [itens, fontes, observacoes]) assert.doesNotMatch(rota, /body\.clinica_id|searchParams\.get\("clinica_id"\)/);
});

test("todas as leituras e escritas das APIs são escopadas pelo tenant resolvido", () => {
  for (const rota of [itens, fontes, observacoes]) {
    assert.match(rota, /resolverTenantPesquisaPrecos\(req\)/);
    assert.match(rota, /tenant\.clinicaId/);
  }
  assert.match(itens, /\.eq\("id", servicoId\)\s*\.eq\("clinica_id", tenant\.clinicaId\)/);
  assert.match(observacoes, /\.eq\("id", corrigeId\)\s*\.eq\("item_id", itemId\)\s*\.eq\("clinica_id", tenant\.clinicaId\)/);
});

test("tipos de fonte são fechados e fontes rastreáveis exigem referência", () => {
  assert.match(fontes, /TIPOS_QUE_EXIGEM_REFERENCIA/);
  assert.match(fontes, /tipoFontePrecoValido\(body\.tipo\)/);
  assert.match(fontes, /url\.protocol !== "http:" && url\.protocol !== "https:"/);
});

test("página cobre estados operacionais e não integra automaticamente outros domínios", () => {
  for (const estado of ["sem_observacoes", "sem_observacoes_comparaveis", "dados_antigos", "fonte_insuficiente", "comparacao_disponivel"]) assert.match(pagina, new RegExp(estado));
  assert.match(pagina, /PageLoader/);
  assert.match(pagina, /Feedback/);
  assert.match(pagina, /EmptyState/);
  assert.match(pagina, /Histórico imutável/);
  assert.doesNotMatch(pagina, /api\/pedidos|api\/orcamentos|oportunidades_demanda|preco_centavos.*update/);
});

test("migration está explicitamente preparada e não executada", () => {
  assert.match(migration, /PREPARADA, NÃO EXECUTADA/);
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
});
