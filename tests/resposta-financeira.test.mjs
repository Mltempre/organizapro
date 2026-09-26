import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const { lerRespostaFinanceira } = await import(pathToFileURL(path.join(process.env.CONVERGENCIA_BUILD_DIR, 'resposta-financeira.js')));

test('lista vazia bem-sucedida é preservada; registros não são transformados', async () => {
  for (const lista of [[], [{ id: 'registro', valor: 125 }]]) {
    assert.deepEqual(await lerRespostaFinanceira(Response.json({ cobrancas: lista }), 'cobrancas'), { cobrancas: lista });
  }
});

test('401, 403, 404 e 500 nunca viram zero financeiro', async () => {
  for (const status of [401, 403, 404, 500]) {
    await assert.rejects(lerRespostaFinanceira(Response.json({ cobrancas: [] }, { status }), 'cobrancas'));
  }
});

test('JSON inválido, campo ausente e lista inválida impedem consolidação', async () => {
  for (const body of ['invalid', '{}', '{"cobrancas":null}', '{"cobrancas":{}}']) {
    await assert.rejects(lerRespostaFinanceira(new Response(body), 'cobrancas'));
  }
});

test('uma fonte indisponível rejeita o conjunto, mesmo com outras fontes válidas', async () => {
  await assert.rejects(Promise.all([
    lerRespostaFinanceira(Response.json({ cobrancas: [{ valor: 100 }] }), 'cobrancas'),
    lerRespostaFinanceira(new Response('', { status: 503 }), 'pedidos'),
  ]));
});

test('quatro superfícies protegem as cinco fontes e descartam resumo anterior ao recarregar', () => {
  for (const tela of ['financeiro', 'receita-perdida', 'previsor-faturamento', 'linha-economica']) {
    const source = fs.readFileSync(new URL(`../app/${tela}/page.tsx`, import.meta.url), 'utf8');
    assert.equal((source.match(/lerRespostaFinanceira\(r,/g) ?? []).length, 5);
    assert.match(source, /setCarregando\(true\); setErro\(''\); setResumo\(null\)/);
    assert.doesNotMatch(source, /catch\(\(\) => \(\{/);
    assert.match(source, /if \(!cuRes.ok\) throw/);
  }
});
