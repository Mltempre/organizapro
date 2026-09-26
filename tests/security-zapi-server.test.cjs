/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route, synthetic credentials, mocked provider. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, A } = require('./helpers/security-config-fixture.cjs');

for (const ok of [true, false]) test(`Z-API server-side: provider ${ok ? 'sucesso' : 'erro'}, sem ecoar credenciais`, async () => {
  const secret = require('node:crypto').randomBytes(24).toString('hex');
  let sent = 0;
  const f = fixture({ tables: { clinica_config: [{ clinica_id: A, zapi_instance: 'synthetic-instance', zapi_token: secret, zapi_client_token: secret, telefone: '11900000000' }] },
    fetchStub: async (url, init) => {
      sent++;
      assert.ok(String(url).includes(`/token/${secret}/send-text`));
      assert.ok(init.headers['Client-Token'] === secret);
      return { ok, status: ok ? 200 : 500, json: async () => ({ credential: secret }) };
    } });
  const r = await f.load('app/api/whatsapp/route.ts').POST({
    headers: new Headers({ authorization: 'Bearer session-a' }),
    json: async () => ({ clinica_id: A, telefone: '11900000000', mensagem: '✅ Teste OrganizaPro: integração Z-API funcionando corretamente!' }),
  });
  assert.equal(r.status, ok ? 200 : 502);
  assert.equal(sent, 1);
  assert.equal(f.clients[0], 'fixture-admin');
  assert.ok(!JSON.stringify(r.body).includes(secret));
  assert.ok(!JSON.stringify(f.queries.filter(q => q.action !== 'select')).includes(secret));
});
