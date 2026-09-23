import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const dir = process.env.CONVERGENCIA_BUILD_DIR;
const original = Module._load;
let autorizado = false;
let falha = null;
const chamadas = [];
// Dependências externas substituídas ANTES de carregar as rotas reais.
// Nenhum createClient real, segredo ou requisição sai deste processo.
Module._load = function(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => ({}) };
  if (request === 'next/server') return { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200, headers: init?.headers }) } };
  if (request.endsWith('/auth-clinica')) return { autorizarUsuarioNaClinica: async (_req, id) => {
    chamadas.push(['auth', id]); return autorizado ? { ok: true, userId: 'usuario-verificado' } : { ok: false, status: 403, error: 'Sem vínculo' };
  } };
  if (request.endsWith('/atribuicao-dados')) return { carregarRelatorioAtribuicao: async (_admin, id) => {
    chamadas.push(['read', id]); if (falha) throw new Error(falha); return { relatorio: { linhas: [] } };
  } };
  if (request.endsWith('/atribuicao-vinculos')) return { registrarVinculoAtribuicao: async (_admin, tenant, v, user) => {
    chamadas.push(['write', tenant, v, user]); return { ok: true, status: 201 };
  } };
  return original.call(this, request, parent, isMain);
};
let get, post;
try {
  get = require(path.join(dir, '../app/api/atribuicao/route.js')).GET;
  post = require(path.join(dir, '../app/api/atribuicao/vinculos/route.js')).POST;
} finally { Module._load = original; }
const req = body => ({ nextUrl: new URL('https://local.invalid/api/atribuicao?clinica_id=tenant-b'), json: async () => body });

test('GET/POST reais recusam tenant não autorizado antes de ler ou gravar', async () => {
  autorizado = false; chamadas.length = 0;
  assert.equal((await get(req())).status, 403);
  assert.equal((await post(req({ clinica_id: 'tenant-b' }))).status, 403);
  assert.deepEqual(chamadas, [['auth','tenant-b'], ['auth','tenant-b']]);
});
test('GET autorizado sempre usa tenant validado e no-store', async () => {
  autorizado = true; falha = null; chamadas.length = 0;
  const r = await get(req());
  assert.equal(r.status, 200); assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.deepEqual(chamadas, [['auth','tenant-b'], ['read','tenant-b']]);
  assert.ok(r.body.conexoes.every(c => c.estado === 'nao_configurada'));
});
test('falhas distintas produzem indisponibilidade sem expor mensagem interna', async () => {
  autorizado = true;
  for (const message of ['ATRIBUICAO_SCHEMA_PENDENTE', 'segredo-na-mensagem']) {
    falha = message;
    const r = await get(req());
    assert.equal(r.status, 503); assert.equal(r.body.indisponivel, true);
    assert.equal(r.body.schemaPendente, message === 'ATRIBUICAO_SCHEMA_PENDENTE');
    assert.ok(!JSON.stringify(r).includes('segredo-na-mensagem'));
  }
  falha = null;
});
test('POST ignora autoria/método falsificados e valores enviados pelo browser', async () => {
  autorizado = true; chamadas.length = 0;
  const r = await post(req({ clinica_id: 'tenant-b', origemId: 'o', entidadeTipo: 'pedido', entidadeId: 'p', evidencia: 'Referência verificável', metodo: 'codigo_site', userId: 'forjado', receita: 99999 }));
  assert.equal(r.status, 201);
  assert.equal(chamadas[1][2].metodo, 'declaracao_operador');
  assert.equal(chamadas[1][3], 'usuario-verificado');
  assert.ok(!('receita' in chamadas[1][2]));
});
test('JSON malformado é 400 sem escrita', async () => {
  chamadas.length = 0;
  assert.equal((await post({ json: async () => { throw new Error(); } })).status, 400);
  assert.equal(chamadas.length, 0);
});
test('wiring mínimo público preserva código e idempotência de tentativa', () => {
  for (const nome of ['PedidoPublico', 'InteressePublico']) {
    const s = fs.readFileSync(new URL(`../app/empresa/[slug]/_components/${nome}.tsx`, import.meta.url), 'utf8');
    assert.match(s, /codigo_rastreio: codigoRastreio/);
    assert.match(s, /idempotency_key: tentativa.current!.chave/);
  }
  for (const nome of ['pedidos','interesse']) {
    const s = fs.readFileSync(new URL(`../app/api/site-publico/${nome}/route.ts`, import.meta.url), 'utf8');
    assert.match(s, /vincularOrigemPublica\(admin, clinicaId, body.codigo_rastreio/);
  }
});
test('migration só estende origem; RLS exige vínculo ativo e produto correto', () => {
  const s = fs.readFileSync(new URL('../supabase/migrations/20260923000003_ads_atribuicao_v1.sql', import.meta.url), 'utf8');
  assert.match(s, /PREPARADA, NÃO EXECUTADA/);
  assert.match(s, /u.ativo = true and c.produto = 'organizapro'/);
  assert.match(s, /p.clinica_id::text = new.clinica_id::text/);
  assert.doesNotMatch(s, /create table/i);
});
