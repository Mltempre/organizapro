/* eslint-disable @typescript-eslint/no-require-imports -- Local route/domain integration. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/pedidos-fixture.cjs');
const pub = 'app/api/site-publico/pedidos/route.ts', manual = 'app/api/pedidos/route.ts', transition = 'app/api/pedidos/[id]/transicao/route.ts';
const input = { slug: 'a', nome_cliente: 'Cliente local', telefone: '11900000000', itens: [{ servico_id: 'service-a', quantidade: 2 }], idempotency_key: 'local-attempt' };
const staff = { ...input, clinica_id: 'a', paciente_id: 'client-a' };

test('catálogo → pedido público → operação → receita comprovada e retirada do risco', async () => {
  const f = fixture();
  const created = await f.load(pub).POST(f.request({ ...input, valor_centavos: 1 }));
  assert.equal(created.status, 201); assert.equal(created.body.pedido.valor_centavos, 3000);
  assert.equal(created.body.pedido.origem, 'site_publico');
  assert.equal(created.body.pedido.pedido_itens[0].descricao, 'Serviço local A');
  const id = created.body.pedido.id;
  const listed = await f.load(manual).GET(f.request({ clinica_id: 'a' }));
  assert.equal(listed.body.pedidos[0].id, id);
  const risk = f.load('lib/receita-perdida.ts').agregarReceitaPerdida;
  const economic = f.load('lib/linha-economica.ts').gerarLinhaEconomica;
  const today = new Date().toISOString().slice(0,10);
  const fromRow = r => ({ id: r.id, pacienteNome: r.nome_cliente, telefone: r.telefone, descricao: 'pedido', valor: r.valor_centavos / 100, criadoEm: '2020-01-01T00:00:00Z', status: r.status, pagamentoConfirmadoEm: r.pagamento_confirmado_em });
  const initialRisk = risk({ hoje: today, agora: new Date().toISOString(), orcamentosParados: [], cobrancasAtrasadas: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [fromRow(created.body.pedido)], oportunidadesAbertas: [] });
  assert.equal(initialRisk.totalConhecido, 30);
  const apply = evento => f.load(transition).POST(f.request({ clinica_id: 'a', evento }), { params: Promise.resolve({ id }) });
  assert.equal((await apply('pagamento_confirmado')).status, 409);
  for (const event of ['confirmar_pedido', 'cliente_informou_pagamento', 'pagamento_confirmado']) assert.equal((await apply(event)).status, 200);
  const paid = (await f.load(manual).GET(f.request({ clinica_id: 'a' }))).body.pedidos[0];
  const summary = economic({ oportunidades: [], orcamentos: [], tratamentos: [], cobrancas: [], pedidos: [fromRow(paid)] });
  assert.equal(summary.totalComprovado, 30);
  const remaining = [paid].filter(p => p.status === 'criado' || p.status === 'confirmado');
  assert.equal(risk({ hoje: today, agora: new Date().toISOString(), orcamentosParados: [], cobrancasAtrasadas: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: remaining.map(fromRow), oportunidadesAbertas: [] }).totalConhecido, 0);
  assert.equal((await apply('cancelar_pedido')).status, 409);
});

test('painel preserva cliente, nome/preço do catálogo e replay sem duplicação', async () => {
  const f = fixture(), route = f.load(manual);
  const first = await route.POST(f.request(staff));
  assert.equal(first.status, 200); assert.equal(first.body.pedido.paciente_id, 'client-a');
  assert.equal(first.body.pedido.pedido_itens[0].descricao, 'Serviço local A');
  const again = await route.POST(f.request(staff));
  assert.equal(again.body.pedido.id, first.body.pedido.id); assert.equal(f.tables.pedidos.length, 1);
});

test('tenant: catálogo, cliente, listagem, transição e replay não atravessam empresa', async () => {
  const f = fixture(), route = f.load(manual);
  assert.equal((await f.load(pub).POST(f.request({ ...input, itens: [{ servico_id: 'service-b', quantidade: 1 }] }))).status, 400);
  assert.equal((await route.POST(f.request({ ...staff, paciente_id: 'client-b' }))).status, 400);
  assert.equal((await route.GET(f.request({ clinica_id: 'b' }, 'a'))).status, 403);
  f.tables.pedidos.push({ id: 'foreign', clinica_id: 'b', status: 'criado' });
  f.tables.eventos_dominio.push({ clinica_id: 'a', chave_idempotencia: 'criar-pedido:local-attempt', entidade_id: 'foreign' });
  const replay = await route.POST(f.request(staff));
  assert.equal(replay.status, 409); assert.equal(f.tables.pedidos.length, 1);
  assert.equal((await f.load(transition).POST(f.request({ clinica_id: 'a', evento: 'confirmar_pedido' }), { params: Promise.resolve({ id: 'foreign' }) })).status, 404);
});

for (const routeName of [pub, manual]) test('entrada/erro/retry: ' + routeName, async () => {
  const f = fixture(), route = f.load(routeName), body = routeName === pub ? input : staff;
  for (const invalid of [null, [], { ...body, itens: [null] }, { ...body, itens: [{ servico_id: 'service-a', quantidade: 0 }] }]) assert.equal((await route.POST(f.request(invalid))).status, 400);
  f.faults.push({ table: 'eventos_dominio', action: 'select' });
  assert.equal((await route.POST(f.request(body))).status, 503); assert.equal(f.tables.pedidos.length, 0);
  f.faults.push({ table: 'pedido_itens', action: 'insert' });
  assert.equal((await route.POST(f.request(body))).status, 500); assert.equal(f.tables.pedidos.length, 0);
  const ok = await route.POST(f.request(body)); assert.ok(ok.status < 300);
  const replay = await route.POST(f.request(body)); assert.equal(replay.body.pedido.id, ok.body.pedido.id); assert.equal(f.tables.pedidos.length, 1);
});

test('catálogo pausado, sem preço e total fora do inteiro do banco são rejeitados antes da escrita', async () => {
  for (const change of [{ disponivel: false }, { preco_centavos: null }, { preco_centavos: 2147483647 }]) {
    const f = fixture(); Object.assign(f.tables.clinica_servicos[0], change);
    assert.equal((await f.load(pub).POST(f.request(input))).status, 400);
    assert.equal(f.tables.pedidos.length, 0);
  }
});
