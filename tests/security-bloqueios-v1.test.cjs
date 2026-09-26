/* eslint-disable @typescript-eslint/no-require-imports -- Isolated actual route execution. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { fixture: pedidos } = require('./helpers/pedidos-fixture.cjs');
const { fixture, A, B } = require('./helpers/security-config-fixture.cjs');
const pub = 'app/api/site-publico/pedidos/route.ts';
const cfg = 'app/api/configuracoes/route.ts';
const input = { slug: 'a', nome_cliente: 'Fixture', telefone: '11900000000', itens: [{ servico_id: 'service-a', quantidade: 2 }], idempotency_key: '1' };
const req = (body = {}, token = 'session-a', tenant = A) => ({ nextUrl: new URL('https://audit.invalid/?clinica_id=' + tenant), headers: new Headers(token ? { authorization: 'Bearer ' + token } : {}), json: async () => ({ clinica_id: tenant, ...body }) });

test('criação/replay só confirmam; chave não lê PII, campos internos ou nova atribuição', async () => {
  const f = pedidos(), route = f.load(pub);
  const first = await route.POST(f.request({ ...input, valor_centavos: 1 }));
  assert.equal(first.status, 201);
  assert.equal(JSON.stringify(first.body), JSON.stringify({ sucesso: true, idempotente: false }));
  assert.equal(f.tables.pedidos[0].valor_centavos, 3000);
  Object.assign(f.tables.pedidos[0], { paciente_id: 'private-id', created_by: 'staff', observacao: 'internal', status: 'pago' });
  const before = JSON.stringify(f.tables);
  for (const body of [input, { ...input, nome_cliente: 'Outro', telefone: '11888888888', itens: [{ servico_id: 'service-b', quantidade: 1 }] }]) {
    const start = f.calls.length;
    const r = await route.POST(f.request(body));
    assert.equal(r.status, 200);
    assert.equal(JSON.stringify(r.body), JSON.stringify({ sucesso: true, idempotente: true }));
    assert.equal(JSON.stringify(f.tables), before);
    assert.ok(!f.calls.slice(start).some(c => c.table === 'pedidos' || c.table === 'pedido_itens'));
  }
  assert.equal((await route.POST(f.request({ idempotency_key: '1' }))).status, 400);
});

test('chave de B não reutiliza pedido em A; item/preço não são confiados ao browser', async () => {
  const f = pedidos(), route = f.load(pub);
  f.tables.eventos_dominio.push({ clinica_id: 'b', chave_idempotencia: 'criar-pedido-publico:1', entidade_id: 'private-b' });
  const r = await route.POST(f.request({ ...input, clinica_id: 'b', valor_centavos: 1 }));
  assert.equal(r.status, 201); assert.equal(f.tables.pedidos[0].clinica_id, 'a');
  assert.equal(f.tables.pedidos[0].valor_centavos, 3000);
  assert.equal((await route.POST(f.request({ ...input, idempotency_key: '2', itens: [{ servico_id: 'service-b', quantidade: 1 }] }))).status, 400);
  assert.equal((await route.POST(f.request({ ...input, slug: 'unknown' }))).status, 404);
});

for (const method of ['GET', 'PUT']) test('configuração ' + method + ': sessão/tenant/inativo/erro negados', async () => {
  for (const [settings, token, tenant, status] of [[{}, '', A, 401], [{}, 'session-a', B, 403], [{ active: false }, 'session-a', A, 403], [{ errorTable: 'clinica_usuarios' }, 'session-a', A, 403]]) {
    const f = fixture(settings);
    assert.equal((await f.load(cfg)[method](req({}, token, tenant))).status, status);
    assert.ok(!f.queries.some(q => q.table === 'clinica_config'));
  }
});

test('GET/PUT removem segredos por allowlist; salvar vazio preserva; rotação não ecoa', async () => {
  // Random synthetic values; assertions deliberately never print their contents.
  const secret = require('node:crypto').randomBytes(24).toString('hex');
  const row = { clinica_id: A, user_id: 'user-a', nome_clinica: 'Fixture', zapi_instance: 'instance', zapi_token: secret, zapi_client_token: secret, internal_secret: secret };
  const f = fixture({ tables: { clinica_config: [row] } }), route = f.load(cfg);
  for (const operation of [() => route.GET(req()), () => route.PUT(req({ nome_clinica: 'Atualizado', zapi_token: '', zapi_client_token: '', user_id: 'forjado', internal_secret: secret })), () => route.PUT(req({ zapi_token: secret }))]) {
    const r = await operation(); assert.equal(r.status, 200);
    assert.equal(r.body.zapi_configurado, true);
    assert.ok(!JSON.stringify(r.body).includes(secret));
    assert.ok(!Object.keys(r.body.config).some(k => /token|secret|user_id|clinica_id/.test(k)));
  }
  const writes = f.queries.filter(q => q.action === 'update');
  assert.ok(!('zapi_token' in writes[0].value)); assert.ok(!('user_id' in writes[0].value));
  assert.ok(!('internal_secret' in writes[0].value));
  assert.ok(writes.every(q => q.filters.some(([k,v]) => k === 'clinica_id' && v === A)));
  assert.ok(writes[1].value.zapi_token === secret);
});

test('configuração inicial e falha de leitura são estados distintos', async () => {
  const f = fixture(), route = f.load(cfg);
  assert.equal((await route.GET(req())).body.zapi_configurado, false);
  assert.equal((await route.PUT(req({ nome_clinica: 'Nova' }))).status, 200);
  assert.equal(f.queries.find(q => q.action === 'insert').value.user_id, 'user-a');
  const broken = fixture({ errorTable: 'clinica_config' });
  assert.equal((await broken.load(cfg).GET(req())).status, 503);
  assert.equal((await broken.load(cfg).PUT(req())).status, 503);
  assert.ok(!broken.queries.some(q => q.action !== 'select'));
});

test('frontend não lê valores salvos; inputs só recebem novas credenciais e limpam após salvar', () => {
  const page = fs.readFileSync('app/configuracoes/page.tsx', 'utf8');
  assert.doesNotMatch(page, /\.from\('clinica_config'\)|data\.zapi_token|data\.zapi_client_token/);
  assert.match(page, /zapi_token: '', zapi_client_token: ''/);
  assert.match(page, /!zapiConfigurado/);
  const casa = fs.readFileSync('app/dashboard/page.tsx', 'utf8');
  assert.doesNotMatch(casa, /zapi_token|zapi_client_token/);
  assert.match(casa, /configSegura.zapi_configurado/);
});
