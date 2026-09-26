/* eslint-disable @typescript-eslint/no-require-imports -- Harness local sem rede. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
require.extensions['.css'] = () => {};
const { harness } = require('./helpers/site-harness.cjs');
const page = 'app/copiloto/page.tsx';
const uuid = '11111111-2222-4333-8444-555555555555';
const resposta = (pedidos = []) => async url => ({ ok: true, json: async () => url === '/api/minha-clinica' ? { clinica_id: 'tenant-a' } : { data: [], orcamentos: [], tratamentos: [], pedidos, cobrancas: [] } });

test('Copiloto: loading, vazio real e acesso canônico sem fabricar prioridade', async t => {
  const fetch = resposta(); t.mock.method(global, 'fetch', fetch);
  const h = harness(page, { fetch });
  assert.match(h.html(), /Consolidando/);
  await h.load();
  assert.match(h.html(), /Nada pedindo atenção agora/);
  assert.match(h.html(), /href="\/pedidos"/);
  assert.match(h.html(), /E-commerce IA/);
  assert.doesNotMatch(h.html(), /copiloto-card-topo/);
});

for (const status of [401, 403, 404, 500]) test(`Copiloto: HTTP ${status} não aparece como vazio confirmado`, async t => {
  const fetch = async url => url === '/api/minha-clinica' ? resposta()(url) : { ok: false, status };
  t.mock.method(global, 'fetch', fetch);
  const h = harness(page, { fetch }); await h.load();
  assert.match(h.html(), /Visão parcial/);
  assert.match(h.html(), /Tentar novamente/);
  assert.doesNotMatch(h.html(), /Nada pedindo atenção agora/);
});

test('Copiloto: pedido existente mantém sinal, valor e destinos sem exibir UUID', async t => {
  const fetch = resposta([{ id: uuid, nome_cliente: 'Cliente TESTE LOCAL', telefone: '11911112222', valor_centavos: 12345, status: 'criado', criado_em: '2020-01-01T12:00:00Z', paciente_id: null, pagamento_confirmado_em: null }]);
  t.mock.method(global, 'fetch', fetch);
  const h = harness(page, { fetch }); await h.load();
  const html = h.html();
  assert.match(html, /Cliente TESTE LOCAL/);
  assert.match(html, /123,45/);
  assert.match(html, /Próxima ação/);
  assert.doesNotMatch(html, new RegExp(uuid));
  assert.doesNotMatch(html, /Referência:/);
  assert.ok(h.find(n => n.type === 'button' && n.props.onClick?.toString().includes('destinoAcao')));
  for (const query of h.queries) assert.ok(query.ops.some(([op, key, value]) => op === 'eq' && key === 'clinica_id' && value === 'tenant-a'));
});

test('Copiloto: falha de rede permite retry e recupera vazio verdadeiro', async t => {
  let falha = true;
  const fetch = async url => { if (falha && url !== '/api/minha-clinica') throw Error('offline'); return resposta()(url); };
  t.mock.method(global, 'fetch', fetch);
  const h = harness(page, { fetch }); await h.load();
  assert.match(h.html(), /Visão parcial/);
  falha = false;
  await h.find(n => n.type === 'button' && n.props.children === 'Tentar novamente').props.onClick();
  assert.match(h.html(), /Nada pedindo atenção agora/);
  assert.doesNotMatch(h.html(), /Visão parcial/);
});
