/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route tests, no network. */
// Estoque V1 — rotas reais em harness isolado (sem rede nem banco):
// transição de pedido com baixa/estorno atômicos, APIs de estoque e
// isolamento por negócio. A lógica SQL (baixa única, estorno único, saldo
// insuficiente) é provada executando a migration num Postgres real — ver
// relatório da missão; aqui se prova a ligação rota ↔ função do banco.
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/pedidos-fixture.cjs');

const TRANSICAO = 'app/api/pedidos/[id]/transicao/route.ts';
const ESTOQUE = 'app/api/estoque/route.ts';
const MOVIMENTOS = 'app/api/estoque/movimentos/route.ts';
const params = id => ({ params: Promise.resolve({ id }) });

function comPedido(opts, status = 'criado') {
  const f = fixture(opts);
  f.tables.pedidos.push({ id: 'p1', clinica_id: 'a', status, valor_centavos: 1500 });
  f.tables.pedido_itens.push({ id: 'i1', pedido_id: 'p1', clinica_id: 'a', servico_id: 'service-a', quantidade: 1 });
  return f;
}
const rpcs = f => f.calls.filter(c => c.action === 'rpc');
const updatesPedido = f => f.calls.filter(c => c.table === 'pedidos' && c.action === 'update');
const transicionar = (f, evento, tenant = 'a') => f.load(TRANSICAO).POST(f.request({ clinica_id: tenant, evento }, tenant), params('p1'));

test('sem a migration: confirmar e cancelar seguem o caminho original (update direto)', async () => {
  const f = comPedido();
  assert.equal((await transicionar(f, 'confirmar_pedido')).status, 200);
  assert.equal(rpcs(f)[0].table, 'rpc:pedido_transicionar_com_estoque_v1');
  assert.equal(updatesPedido(f).length, 1);
  assert.equal(f.tables.pedidos[0].status, 'confirmado');
});

test('com a migration: confirmar usa a função atômica (sem update paralelo) com status esperado e novo', async () => {
  const f = comPedido({ rpc: { pedido_transicionar_com_estoque_v1: (a, t) => {
    const p = t.pedidos.find(x => x.id === a.p_pedido_id && x.clinica_id === a.p_clinica_id && x.status === a.p_status_esperado);
    if (!p) return { data: { ok: false, erro: 'conflito' }, error: null };
    p.status = a.p_status_novo; return { data: { ok: true, pedido: { ...p } }, error: null };
  } } });
  const r = await transicionar(f, 'confirmar_pedido');
  assert.equal(r.status, 200); assert.equal(r.body.pedido.status, 'confirmado');
  assert.deepEqual(JSON.parse(JSON.stringify(rpcs(f)[0].value)), { p_clinica_id: 'a', p_pedido_id: 'p1', p_status_esperado: 'criado', p_status_novo: 'confirmado' });
  assert.equal(updatesPedido(f).length, 0, 'status muda só dentro da função (mesma transação do estoque)');
  assert.ok(f.tables.eventos_dominio.some(e => e.tipo === 'pedido.confirmado'));
});

test('estoque insuficiente: 409 com mensagem clara e pedido inalterado', async () => {
  const f = comPedido({ rpc: { pedido_transicionar_com_estoque_v1: () => ({ data: { ok: false, erro: 'estoque_insuficiente', itens: [{ servico_id: 'service-a', nome: 'Camiseta preta M', saldo: 0, necessario: 1 }] }, error: null }) } });
  const r = await transicionar(f, 'confirmar_pedido');
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Estoque insuficiente.*Camiseta preta M \(saldo 0, pedido 1\)/);
  assert.equal(r.body.estoque_insuficiente.length, 1);
  assert.equal(f.tables.pedidos[0].status, 'criado');
  assert.equal(updatesPedido(f).length, 0);
});

test('concorrência (status mudou) vira 409 sem escrita paralela; erro do banco vira 503 fail-closed', async () => {
  const conflito = comPedido({ rpc: { pedido_transicionar_com_estoque_v1: () => ({ data: { ok: false, erro: 'conflito' }, error: null }) } });
  assert.equal((await transicionar(conflito, 'confirmar_pedido')).status, 409);
  assert.equal(updatesPedido(conflito).length, 0);
  const falha = comPedido({ rpc: { pedido_transicionar_com_estoque_v1: () => ({ data: null, error: { code: 'XX000', message: 'falha local' } }) } });
  assert.equal((await transicionar(falha, 'confirmar_pedido')).status, 503);
  assert.equal(updatesPedido(falha).length, 0);
  assert.equal(falha.tables.pedidos[0].status, 'criado');
});

test('cancelar usa a mesma função (estorno); outros eventos não tocam estoque', async () => {
  const chamadas = [];
  const opts = { rpc: { pedido_transicionar_com_estoque_v1: a => { chamadas.push(a); return { data: { ok: true, pedido: { id: 'p1', status: a.p_status_novo } }, error: null }; } } };
  assert.equal((await transicionar(comPedido(opts, 'confirmado'), 'cancelar_pedido')).status, 200);
  assert.equal(chamadas[0].p_status_novo, 'cancelado'); assert.equal(chamadas[0].p_status_esperado, 'confirmado');
  for (const [status, evento] of [['confirmado', 'cliente_informou_pagamento'], ['confirmado', 'pagamento_confirmado'], ['aguardando_confirmacao_pagamento', 'confirmacao_rejeitada']]) {
    const f = comPedido(opts, status);
    assert.equal((await transicionar(f, evento)).status, 200, evento);
    assert.equal(rpcs(f).length, 0, evento);
  }
  assert.equal(chamadas.length, 1);
});

test('transição repetida é recusada antes de qualquer baixa', async () => {
  const f = comPedido({ rpc: { pedido_transicionar_com_estoque_v1: () => { throw Error('não deveria chamar'); } } }, 'confirmado');
  assert.equal((await transicionar(f, 'confirmar_pedido')).status, 409);
  const g = comPedido({ rpc: { pedido_transicionar_com_estoque_v1: () => { throw Error('não deveria chamar'); } } }, 'cancelado');
  assert.equal((await transicionar(g, 'cancelar_pedido')).status, 409);
});

test('negócio B não confirma pedido de A (nem chega à função de estoque)', async () => {
  const f = comPedido({ rpc: { pedido_transicionar_com_estoque_v1: () => { throw Error('não deveria chamar'); } } });
  const r = await f.load(TRANSICAO).POST(f.request({ clinica_id: 'b', evento: 'confirmar_pedido' }, 'b'), params('p1'));
  assert.equal(r.status, 404);
  const s = await f.load(TRANSICAO).POST(f.request({ clinica_id: 'a', evento: 'confirmar_pedido' }, 'b'), params('p1'));
  assert.equal(s.status, 403);
  assert.equal(rpcs(f).length, 0);
});

// ── APIs de estoque ─────────────────────────────────────────────────────
function comEstoque(opts) {
  const f = fixture(opts);
  // SKU/código de barras ficam em estoque_identificadores (privada), nunca no catálogo público.
  Object.assign(f.tables.clinica_servicos[0], { tipo_item: 'produto', controla_estoque: true, estoque_minimo: 2 });
  Object.assign(f.tables.clinica_servicos[1], { tipo_item: 'produto', controla_estoque: true, estoque_minimo: 5 });
  f.tables.clinica_servicos.push({ id: 'service-a2', clinica_id: 'a', nome: 'Corte', preco_centavos: 500, disponivel: true, tipo_item: 'servico', controla_estoque: false, estoque_minimo: null });
  f.tables.estoque_identificadores = [
    { servico_id: 'service-a', clinica_id: 'a', sku: 'CAM-M', codigo_barras: '789' },
    { servico_id: 'service-b', clinica_id: 'b', sku: 'SEGREDO-B', codigo_barras: '999' },
  ];
  f.tables.estoque_saldos = [{ servico_id: 'service-a', clinica_id: 'a', saldo: 2 }, { servico_id: 'service-b', clinica_id: 'b', saldo: 1 }];
  f.tables.estoque_movimentos = [
    { id: 'm1', clinica_id: 'a', servico_id: 'service-a', tipo: 'entrada', quantidade: 3, saldo_apos: 3 },
    { id: 'm2', clinica_id: 'b', servico_id: 'service-b', tipo: 'entrada', quantidade: 1, saldo_apos: 1 },
  ];
  return f;
}
const get = (f, rota, url, tenant = 'a') => f.load(rota).GET({ tenant, url, json: async () => ({}) });

test('GET /api/estoque: só itens e saldos do próprio negócio; serviço sem saldo; estoque baixo', async () => {
  const f = comEstoque();
  const r = await get(f, ESTOQUE, 'https://local.invalid/api/estoque?clinica_id=a');
  assert.equal(r.status, 200); assert.equal(r.body.estoqueAtivo, true);
  assert.deepEqual(r.body.itens.map(i => i.id).sort(), ['service-a', 'service-a2']);
  const cam = r.body.itens.find(i => i.id === 'service-a');
  assert.equal(cam.saldo, 2); assert.equal(cam.baixo, true);
  assert.equal(r.body.itens.find(i => i.id === 'service-a2').saldo, null);
  assert.equal(r.body.estoqueBaixo, 1);
  assert.equal(cam.sku, 'CAM-M'); assert.equal(cam.codigo_barras, '789', 'tenant correto lê SKU/código');
  assert.equal(r.body.itens.find(i => i.id === 'service-a2').sku, null);
  assert.doesNotMatch(JSON.stringify(r.body), /SEGREDO-B|"999"/, 'SKU/código de B nunca aparecem para A');
  assert.ok(f.calls.filter(c => ['clinica_servicos', 'estoque_saldos', 'estoque_identificadores'].includes(c.table)).every(c => c.filters.some(([k, v]) => k === 'clinica_id' && v === 'a')));
  assert.equal((await get(f, ESTOQUE, 'https://local.invalid/api/estoque?clinica_id=a', 'b')).status, 403);
});

test('PUT /api/estoque: valida, grava só no próprio negócio e não acha item de outro', async () => {
  const f = comEstoque();
  const put = (body, tenant = 'a') => f.load(ESTOQUE).PUT({ tenant, json: async () => body });
  assert.equal((await put({ clinica_id: 'a', servico_id: 'service-a2', tipo_item: 'servico', controla_estoque: true })).status, 400);
  const ok = await put({ clinica_id: 'a', servico_id: 'service-a', tipo_item: 'produto', sku: ' CAM-P ', codigo_barras: '', controla_estoque: true, estoque_minimo: '3' });
  assert.equal(ok.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(ok.body.config)), { tipo_item: 'produto', sku: 'CAM-P', codigo_barras: null, controla_estoque: true, estoque_minimo: 3 });
  const idA = f.tables.estoque_identificadores.find(x => x.servico_id === 'service-a');
  assert.equal(idA.sku, 'CAM-P'); assert.equal(idA.codigo_barras, null); assert.equal(idA.clinica_id, 'a');
  assert.equal(f.tables.clinica_servicos[0].sku, undefined, 'SKU nunca é gravado no catálogo público');
  assert.equal(f.tables.clinica_servicos[0].estoque_minimo, 3);
  const upserts = f.calls.filter(c => c.table === 'estoque_identificadores' && c.action === 'upsert');
  assert.equal(upserts[0].onConflict, 'servico_id');
  const novo = await put({ clinica_id: 'a', servico_id: 'service-a2', tipo_item: 'produto', sku: 'NOVO-1', codigo_barras: '123', controla_estoque: false });
  assert.equal(novo.status, 200);
  assert.equal(f.tables.estoque_identificadores.find(x => x.servico_id === 'service-a2').sku, 'NOVO-1');
  const alheio = await put({ clinica_id: 'a', servico_id: 'service-b', tipo_item: 'produto', sku: 'X', controla_estoque: false });
  assert.equal(alheio.status, 404);
  assert.equal(f.tables.clinica_servicos[1].controla_estoque, true, 'item de B intacto');
  assert.equal(f.tables.estoque_identificadores.find(x => x.servico_id === 'service-b').sku, 'SEGREDO-B', 'SKU de B intacto');
  assert.equal(f.calls.filter(c => c.table === 'estoque_identificadores' && c.action === 'upsert').length, 2, 'item alheio não chega a gravar');
  assert.equal((await put({ clinica_id: 'b', servico_id: 'service-b', tipo_item: 'produto' }, 'a')).status, 403);
});

test('movimentos: histórico só do próprio negócio; entrada usa a função com autor da sessão', async () => {
  const recebidos = [];
  const f = comEstoque({ rpc: { estoque_registrar_movimento_v1: a => { recebidos.push(a); return { data: { ok: true, saldo: 12 }, error: null }; } } });
  const hist = await get(f, MOVIMENTOS, 'https://local.invalid/api/estoque/movimentos?clinica_id=a&servico_id=service-b');
  assert.equal(hist.status, 200); assert.deepEqual(hist.body.movimentos, [], 'movimento de B nunca aparece para A');
  assert.equal((await get(f, MOVIMENTOS, 'https://local.invalid/api/estoque/movimentos?clinica_id=b&servico_id=service-b', 'a')).status, 403);

  const post = (body, tenant = 'a') => f.load(MOVIMENTOS).POST({ tenant, json: async () => body });
  assert.equal((await post({ clinica_id: 'a', servico_id: 'service-a', tipo: 'entrada', quantidade: 0, idempotency_key: 'k' })).status, 400);
  assert.equal((await post({ clinica_id: 'a', servico_id: 'service-a', tipo: 'ajuste', quantidade: 1, idempotency_key: 'k' })).status, 400, 'ajuste sem motivo');
  assert.equal((await post({ clinica_id: 'a', servico_id: 'service-a', tipo: 'entrada', quantidade: 10 })).status, 400, 'sem chave de idempotência');
  const r = await post({ clinica_id: 'a', servico_id: 'service-a', tipo: 'entrada', quantidade: 10, motivo: 'Compra', idempotency_key: 'k1', autor_id: 'forjado' });
  assert.equal(r.status, 200); assert.equal(r.body.saldo, 12);
  assert.equal(recebidos[0].p_autor_id, 'local-user', 'autor vem da sessão, nunca do corpo');
  assert.equal(recebidos[0].p_clinica_id, 'a');
  assert.equal(recebidos[0].p_chave, 'manual:k1');
  assert.equal((await post({ clinica_id: 'b', servico_id: 'service-b', tipo: 'entrada', quantidade: 1, idempotency_key: 'k2' }, 'a')).status, 403);
  assert.equal(recebidos.length, 1);
});

test('movimentos: recusas da função viram mensagem clara', async () => {
  const f = comEstoque({ rpc: { estoque_registrar_movimento_v1: () => ({ data: { ok: false, erro: 'estoque_nao_controlado' }, error: null }) } });
  const r = await f.load(MOVIMENTOS).POST({ tenant: 'a', json: async () => ({ clinica_id: 'a', servico_id: 'service-a2', tipo: 'entrada', quantidade: 1, idempotency_key: 'k' }) });
  assert.equal(r.status, 409); assert.match(r.body.error, /não controla estoque/);
  const semMigration = comEstoque();
  const s = await semMigration.load(MOVIMENTOS).POST({ tenant: 'a', json: async () => ({ clinica_id: 'a', servico_id: 'service-a', tipo: 'entrada', quantidade: 1, idempotency_key: 'k' }) });
  assert.equal(s.status, 503); assert.match(s.body.error, /ainda não foi ativado/);
});
