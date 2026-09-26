/* eslint-disable @typescript-eslint/no-require-imports -- Actual routes in isolated VM. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, A, B } = require('./helpers/security-config-fixture.cjs');
const P = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const request = body => ({ headers: new Headers({ authorization: 'Bearer session-a' }), json: async () => body });

for (const table of ['cobrancas', 'tratamentos']) {
  const body = { clinica_id: A, paciente_nome: 'Synthetic', descricao: 'Synthetic', tipo_tratamento: 'Synthetic', valor: 10, valor_estimado: 10, vencimento: '2026-10-01', idempotency_key: 'synthetic' };
  for (const [name, patient, rows, errorTable, expected] of [
    ['proprio tenant', P, [{ id: P, clinica_id: A }], undefined, 200],
    ['outro tenant', P, [{ id: P, clinica_id: B }], undefined, 400],
    ['inexistente', P, [], undefined, 400],
    ['nulo', null, [], undefined, 200],
    ['omitido', undefined, [], undefined, 200],
    ['malformado', 'invalid', [], undefined, 400],
    ['tipo invalido', {}, [], undefined, 400],
    ['falha banco', P, [], 'pacientes', 503],
  ]) test(`${table}: paciente ${name}`, async () => {
    const f = fixture({ tables: { pacientes: rows }, errorTable });
    const result = await f.load(`app/api/${table}/route.ts`).POST(request({ ...body, paciente_id: patient }));
    assert.equal(result.status, expected);
    const writes = f.queries.filter(q => q.action !== 'select');
    if (expected !== 200) assert.equal(writes.length, 0);
    else {
      const insert = writes.find(q => q.table === table);
      assert.equal(insert.value.clinica_id, A);
      assert.equal(insert.value.paciente_id, patient ?? null);
      if (patient) {
        const lookup = f.queries.find(q => q.table === 'pacientes');
        assert.ok(lookup.filters.some(([key, value]) => key === 'id' && value === P));
        assert.ok(lookup.filters.some(([key, value]) => key === 'clinica_id' && value === A));
        assert.ok(f.queries.indexOf(lookup) < f.queries.indexOf(insert));
      }
    }
    assert.equal(f.network.length, 0);
  });
}
