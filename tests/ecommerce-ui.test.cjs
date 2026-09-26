/* eslint-disable @typescript-eslint/no-require-imports -- Isolated component tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/site-harness.cjs');
const page = 'app/pedidos/page.tsx';
const fetchOk = async url => ({ ok: true, json: async () => url === '/api/minha-clinica' ? { clinica_id: 'a' } : { pedidos: [] } });

test('painel: vazio verdadeiro aparece após todas as fontes carregarem', async () => {
  const h = harness(page, { fetch: fetchOk }); await h.load();
  assert.match(h.html(), /Ainda não há pedidos/);
});

for (const source of ['pedidos', 'pacientes', 'clinica_servicos']) test('painel: falha em ' + source + ' não é vazio e permite tentar novamente', async () => {
  const h = harness(page, { fetch: url => source === 'pedidos' && url !== '/api/minha-clinica' ? Promise.resolve({ ok: false, status: 404 }) : fetchOk(url),
    respond: q => ({ data: [], error: q.table === source ? { message: 'offline' } : null }) });
  await h.load(); assert.doesNotMatch(h.html(), /Ainda não há pedidos/); assert.match(h.html(), /Tentar novamente/);
});

test('painel: erro de rede ao salvar libera botão e conserva a chave para retry', async () => {
  const h = harness(page, { fetch: async (url, init) => {
    if (init?.method === 'POST') throw Error('offline');
    return fetchOk(url);
  } });
  await h.load(); h.page().props.actionOnClick();
  h.find(n => n.props?.placeholder === 'Ex: Maria Silva').props.onChange({ target: { value: 'Cliente local' } });
  h.find(n => n.props?.placeholder === 'Descrição').props.onChange({ target: { value: 'Serviço' } });
  h.find(n => n.props?.placeholder === 'R$').props.onChange({ target: { value: '20' } });
  for (let i = 0; i < 2; i++) {
    await h.find(n => n.props?.className === 'ped-btn-salvar').props.onClick();
    assert.equal(h.find(n => n.props?.className === 'ped-btn-salvar').props.disabled, false);
  }
  const posts = h.calls.filter(c => c.init?.method === 'POST');
  assert.equal(posts.length, 2);
  assert.equal(JSON.parse(posts[0].init.body).idempotency_key, JSON.parse(posts[1].init.body).idempotency_key);
  assert.match(h.html(), /Não foi possível confirmar o registro/);
});

test('pedido público: seleção manda IDs/quantidades, não preço, e conserva tentativa em retry', async () => {
  const h = harness('app/empresa/[slug]/_components/PedidoPublico.tsx', {
    props: { slug: 'a', servicos: [{ id: 's', nome: 'Serviço local', preco_centavos: 1500, disponivel: true }, { id: 'paused', nome: 'Pausado', preco_centavos: 10, disponivel: false }] },
    fetch: async () => { throw Error('offline'); },
  });
  await h.load(); assert.doesNotMatch(h.html(), /Pausado/);
  h.find(n => n.type === 'input' && n.props.type === 'number').props.onChange({ target: { value: '2' } });
  assert.match(h.html(), /30,00/);
  for (let i = 0; i < 2; i++) await h.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  const first = JSON.parse(h.calls[0].init.body), second = JSON.parse(h.calls[1].init.body);
  assert.deepEqual(first.itens, [{ servico_id: 's', quantidade: 2 }]);
  assert.equal(first.idempotency_key, second.idempotency_key);
  assert.equal(h.find(n => n.props?.type === 'submit').props.disabled, false);
});
