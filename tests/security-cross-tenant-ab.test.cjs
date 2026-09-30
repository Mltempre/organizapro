/* eslint-disable @typescript-eslint/no-require-imports -- Isolated security VM, no network. */
// Cross-tenant A↔B — executa o código REAL das rotas (harness isolado, sem
// rede nem banco). Cada cenário roda nos dois sentidos: usuário de A mira
// recurso de B e usuário de B mira recurso de A. Esperado: nenhuma leitura,
// nenhuma escrita, nenhuma chamada externa no tenant alheio.
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, A, B } = require('./helpers/security-config-fixture.cjs');

const ROW = { [A]: 'aaaaaaaa-0000-4000-8000-00000000000a', [B]: 'bbbbbbbb-0000-4000-8000-00000000000b' };
const SESSAO = { [A]: 'session-a', [B]: 'session-b' };
const SENTIDOS = [[A, B], [B, A]];

function cenario() {
  const linha = (extra) => [A, B].map(c => ({ id: ROW[c], clinica_id: c, ...extra }));
  return fixture({
    sessions: { 'session-b': 'user-b' },
    tables: {
      clinica_usuarios: [
        { usuario_id: 'user-a', clinica_id: A, ativo: true, papel: 'dono' },
        { usuario_id: 'user-b', clinica_id: B, ativo: true, papel: 'dono' },
      ],
      chatbot_config: [A, B].map(c => ({ clinica_id: c, ativo: true, nome_assistente: 'bot-' + c })),
      chatbot_treinamento: linha({ pergunta: 'p', resposta: 'r', ativo: true }),
      orcamentos: linha({ status: 'apresentado', paciente_nome: 'x', valor: 10 }),
      cobrancas: linha({ status: 'pendente', valor: 10 }),
      tratamentos: linha({ status: 'em_andamento' }),
      pedidos: linha({ status: 'criado', valor_centavos: 100 }),
      fechamento_arquivos: linha({ storage_path: 'p', nome_original: 'n' }),
      clinica_config: [A, B].map(c => ({ clinica_id: c, user_id: 'dono-' + c, zapi_instance: 'INST-' + c, zapi_token: 't', zapi_client_token: 'ct' })),
    },
  });
}

// Request real + nextUrl (as rotas usam new URL(req.url) ou req.nextUrl).
const req = (url, sessao, init = {}) => Object.assign(new Request('https://h.local' + url, {
  ...init, headers: { authorization: 'Bearer ' + sessao, 'content-type': 'application/json', ...(init.headers || {}) },
}), { nextUrl: new URL('https://h.local' + url) });
const json = (url, sessao, method, body) => req(url, sessao, { method, body: JSON.stringify(body) });
const params = (id) => ({ params: Promise.resolve({ id }) });
// Nenhuma escrita (insert/update/upsert/delete) pode tocar o tenant alvo.
function semEscritaNoAlvo(f, alvo) {
  const escritas = f.queries.filter(q => q.action !== 'select');
  for (const q of escritas) {
    const tenantFiltro = q.filters.find(([k]) => k === 'clinica_id')?.[1];
    const tenantValor = q.value && q.value.clinica_id;
    assert.notEqual(tenantFiltro, alvo, `escrita em ${q.table} filtrada no tenant alvo`);
    assert.notEqual(tenantValor, alvo, `escrita em ${q.table} com clinica_id do alvo`);
  }
  return escritas.length;
}

for (const [atacante, alvo] of SENTIDOS) {
  const tag = atacante === A ? 'A→B' : 'B→A';
  const s = SESSAO[atacante];

  test(`${tag} chatbot/config: não lê nem grava a configuração do outro negócio`, async () => {
    const f = cenario(); const r = f.load('app/api/chatbot/config/route.ts');
    const get = await r.GET(req(`/api/chatbot/config?clinica_id=${alvo}`, s));
    assert.equal(get.status, 403); assert.equal(get.body.data, undefined);
    const post = await r.POST(json('/api/chatbot/config', s, 'POST', { clinica_id: alvo, ativo: false }));
    assert.equal(post.status, 403);
    assert.equal(semEscritaNoAlvo(f, alvo), 0);
  });

  test(`${tag} chatbot/treinamento: não edita nem apaga registro do outro negócio pelo id`, async () => {
    const f = cenario(); const r = f.load('app/api/chatbot/treinamento/route.ts');
    const get = await r.GET(req(`/api/chatbot/treinamento?clinica_id=${alvo}`, s));
    assert.equal(get.status, 403);
    const put = await r.PUT(json('/api/chatbot/treinamento', s, 'PUT', { id: ROW[alvo], pergunta: 'x', resposta: 'y' }));
    assert.equal(put.status, 403);
    const del = await r.DELETE(req(`/api/chatbot/treinamento?id=${ROW[alvo]}`, s, { method: 'DELETE' }));
    assert.equal(del.status, 403);
    assert.equal(semEscritaNoAlvo(f, alvo), 0);
    assert.equal(f.tables.chatbot_treinamento.find(t => t.id === ROW[alvo]).pergunta, 'p');
  });

  for (const [rota, body] of [
    ['orcamentos', { novo_status: 'aprovado' }],
    ['cobrancas', { novo_status: 'em_cobranca' }],
    ['tratamentos', { novo_status: 'concluido' }],
    ['pedidos', { evento: 'confirmar_pedido' }],
  ]) {
    test(`${tag} ${rota}/[id]/transicao: id do outro negócio com o próprio clinica_id não é encontrado`, async () => {
      const f = cenario(); const r = f.load(`app/api/${rota}/[id]/transicao/route.ts`);
      const res = await r.POST(json(`/api/${rota}/${ROW[alvo]}/transicao`, s, 'POST', { clinica_id: atacante, ...body }), params(ROW[alvo]));
      assert.ok([403, 404].includes(res.status), `status ${res.status}`);
      assert.equal(f.tables[rota].find(x => x.id === ROW[alvo]).status, cenario().tables[rota].find(x => x.id === ROW[alvo]).status);
      assert.equal(semEscritaNoAlvo(f, alvo), 0);
    });
    test(`${tag} ${rota}/[id]/transicao: clinica_id do outro negócio é recusado`, async () => {
      const f = cenario(); const r = f.load(`app/api/${rota}/[id]/transicao/route.ts`);
      const res = await r.POST(json(`/api/${rota}/${ROW[alvo]}/transicao`, s, 'POST', { clinica_id: alvo, ...body }), params(ROW[alvo]));
      assert.equal(res.status, 403);
      assert.equal(semEscritaNoAlvo(f, alvo), 0);
    });
  }

  test(`${tag} fechamento/documento/arquivo/[id]: arquivo do outro negócio não gera link`, async () => {
    const f = cenario(); const r = f.load('app/api/fechamento/documento/arquivo/[id]/route.ts');
    const proprio = await r.GET(req(`/api/fechamento/documento/arquivo/${ROW[alvo]}?clinica_id=${atacante}`, s), params(ROW[alvo]));
    assert.equal(proprio.status, 404); assert.equal(proprio.body.url, undefined);
    const alheio = await r.GET(req(`/api/fechamento/documento/arquivo/${ROW[alvo]}?clinica_id=${alvo}`, s), params(ROW[alvo]));
    assert.equal(alheio.status, 403);
  });

  test(`${tag} whatsapp: não envia pelo número/credenciais do outro negócio`, async () => {
    const f = cenario(); const r = f.load('app/api/whatsapp/route.ts');
    const res = await r.POST(json('/api/whatsapp', s, 'POST', { clinica_id: alvo, telefone: '5511999990000', mensagem: 'oi' }));
    assert.equal(res.status, 403);
    assert.equal(f.network.length, 0);
    assert.equal(semEscritaNoAlvo(f, alvo), 0);
  });

  test(`${tag} configuracoes: não lê config alheia nem sequestra a instância Z-API do outro negócio`, async () => {
    const f = cenario(); const r = f.load('app/api/configuracoes/route.ts');
    const get = await r.GET(req(`/api/configuracoes?clinica_id=${alvo}`, s));
    assert.equal(get.status, 403);
    const put = await r.PUT(json('/api/configuracoes', s, 'PUT', { clinica_id: alvo, nome_clinica: 'x' }));
    assert.equal(put.status, 403);
    const sequestro = await r.PUT(json('/api/configuracoes', s, 'PUT', { clinica_id: atacante, zapi_instance: 'INST-' + alvo }));
    assert.equal(sequestro.status, 409);
    assert.equal(f.tables.clinica_config.find(c => c.clinica_id === atacante).zapi_instance, 'INST-' + atacante);
    assert.equal(semEscritaNoAlvo(f, alvo), 0);
  });
}

test('sem sessão válida nada é lido nem gravado', async () => {
  const f = cenario();
  const cfg = await f.load('app/api/chatbot/config/route.ts').GET(req(`/api/chatbot/config?clinica_id=${A}`, 'forjada'));
  assert.equal(cfg.status, 401);
  const tr = await f.load('app/api/orcamentos/[id]/transicao/route.ts').POST(json(`/api/orcamentos/${ROW[A]}/transicao`, 'forjada', 'POST', { clinica_id: A, novo_status: 'aprovado' }), params(ROW[A]));
  assert.equal(tr.status, 401);
  assert.equal(f.queries.filter(q => q.action !== 'select').length, 0);
});
