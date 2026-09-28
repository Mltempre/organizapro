// ── Meta Ads V1 Enxuto — suíte da missão META ADS V1 ───────────────────────
// Cobre: autenticação/autorização das rotas, isolamento por tenant, estados
// sem integração (config ausente / sem conexão / schema pendente), erro da
// API externa, ausência de token/configuração, sanitização de segredos,
// mapeamento de métricas, atribuição SEM inferência, OAuth (escopo mínimo
// ads_read), migration preparada e UI em todos os estados.
// Nenhuma rede real, nenhum banco real, nenhum segredo real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (arquivo) => fs.readFileSync(path.join(root, arquivo), 'utf8');

// ── Módulo TS puro (lib/meta-ads-metricas.ts — sem server-only/imports) ────
function carregarTsPuro(relativo) {
  const file = path.join(root, relativo);
  const code = ts.transpileModule(ler(relativo), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const m = { exports: {} };
  new Function('exports', 'require', 'module', code)(m.exports, require, m);
  return m.exports;
}
const metricas = carregarTsPuro('lib/meta-ads-metricas.ts');

// ── Credenciais FIXTURE (nunca reais) no formato canônico AES-256-GCM ──────
const ENV_META = {
  NODE_ENV: 'production',
  META_APP_ID: 'fixture-app',
  META_APP_SECRET: 'fixture-secret',
  META_TOKEN_KEY: 'fixture-meta-key-32-bytes!!',
};
function cifrarFixture(token, secret) {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}
function decifrarFixture(valor, secret) {
  const [iv, tag, data] = valor.split('.');
  const key = crypto.createHash('sha256').update(secret).digest();
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}

class Request {
  constructor(url, options = {}) {
    this.url = url;
    this.nextUrl = new URL(url);
    this.headers = new Headers(options.headers);
    this.cookies = { get: (k) => (options.cookies?.[k] ? { value: options.cookies[k] } : undefined) };
    this.json = async () => options.body;
  }
}
function requisicao(url, { bearer = 'fixture-session', body, cookies, origin } = {}) {
  const headers = {};
  if (bearer) headers.Authorization = 'Bearer ' + bearer;
  if (origin) headers.origin = origin;
  return new Request(url, { headers, body, cookies });
}
function resposta(body, options = {}) {
  const values = new Map();
  const headers = new Headers();
  if (options.headers) for (const [k, v] of Object.entries(options.headers)) headers.set(k, v);
  return { body, status: options.status || 200, headers, cookies: { values, set: (k, v, o) => values.set(k, { value: v, ...o }) } };
}

// ── Fixture vm: executa o código de produção com loader allowlisted ────────
function fixture(options = {}) {
  const calls = [], queries = [], logs = [], saved = [];
  const settings = { member: true, product: 'organizapro', user: 'user-a', vinculosExtra: [], env: {}, ...options };
  const db = {
    auth: { getUser: async (token) => ({ data: { user: token === 'fixture-session' && settings.user ? { id: settings.user } : null }, error: null }) },
    from(table) {
      const q = { table, filters: [], action: 'select' };
      queries.push(q);
      const chain = {
        select(cols) { q.cols = cols; return chain; },
        eq(k, v) { q.filters.push([k, v]); return chain; },
        upsert(v) { q.action = 'upsert'; q.value = v; return chain; },
        maybeSingle() { return run(); },
        then(a, b) { return run().then(a, b); },
      };
      async function run() {
        const tenant = q.filters.find(([k]) => k === 'clinica_id')?.[1];
        if (table === 'clinica_usuarios') {
          const ok = settings.member && (tenant === 'tenant-a' || settings.vinculosExtra.includes(tenant));
          return { data: ok ? { clinica_id: tenant } : null, error: null };
        }
        if (table === 'clinicas') return { data: { produto: settings.product }, error: null };
        if (table === 'meta_ads_conexoes') {
          if (settings.dbError) return { data: null, error: { message: 'fixture-sensitive-db' } };
          if (q.action === 'upsert') { saved.push(q.value); return { data: null, error: null }; }
          if (settings.semConexao || tenant !== 'tenant-a') return { data: null, error: null };
          const cifrado = settings.ciphertext ?? cifrarFixture('fixture-token-real', settings.ciphertextKey ?? ENV_META.META_TOKEN_KEY);
          return {
            data: {
              conta_ads_id: 'act_123', conta_ads_nome: 'Conta Teste', moeda: 'BRL',
              access_token_ciphertext: cifrado, conectado_em: '2026-09-28T00:00:00.000Z',
            },
            error: null,
          };
        }
        throw new Error('Unexpected table ' + table);
      }
      return chain;
    },
    rpc() { throw new Error('Unexpected rpc'); },
  };
  async function fetchMock(url) {
    const call = { url: String(url) };
    calls.push(call);
    let result = settings.fetch ? await settings.fetch(call) : undefined;
    if (result === undefined) {
      const u = new URL(url);
      if (u.hostname !== 'graph.facebook.com') throw new Error('Unexpected host ' + u.hostname);
      if (u.pathname.endsWith('/oauth/access_token')) result = { access_token: 'fixture-token-long' };
      else if (u.pathname === '/v25.0/me/adaccounts') result = settings.contas ?? { data: [{ id: 'act_123', account_id: '123', name: 'Conta Teste', account_status: 1, currency: 'BRL' }] };
      else if (u.pathname.endsWith('/act_123/campaigns')) result = { data: [{ id: '601', name: 'Campanha Teste', status: 'ACTIVE', effective_status: 'ACTIVE' }] };
      else if (u.pathname.endsWith('/act_123/insights')) result = { data: [{ campaign_id: '601', campaign_name: 'Campanha Teste', spend: '123.45', impressions: '1000', reach: '800', clicks: '50', ctr: '5.00' }] };
      else throw new Error('Unexpected endpoint ' + u.pathname);
    }
    return { ok: !result.http || result.http < 400, status: result.http || 200, json: async () => result.body ?? result };
  }
  const cache = new Map();
  function load(relativo) {
    const file = path.resolve(root, relativo);
    if (!file.startsWith(root + path.sep)) throw new Error('Outside fixture root');
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: file,
    }).outputText;
    const localRequire = (s) => {
      if (s === 'server-only') return {};
      if (s === 'node:crypto') return crypto;
      if (s === '@supabase/supabase-js') return { createClient: () => db };
      if (s === 'next/server') return { NextRequest: Request, NextResponse: { json: resposta, redirect: (url) => ({ ...resposta(null), location: String(url) }) } };
      if (s.startsWith('.')) {
        const alvo = path.resolve(path.dirname(file), s);
        return load(path.relative(root, alvo.endsWith('.ts') ? alvo : alvo + '.ts'));
      }
      throw new Error('Forbidden import ' + s);
    };
    vm.runInNewContext(code, {
      module: loaded, exports: loaded.exports, require: localRequire,
      Buffer, URL, URLSearchParams, Headers, AbortController, setTimeout, clearTimeout,
      process: { env: { ...ENV_META, ...settings.env } },
      console: { error: (...v) => logs.push(v), warn: (...v) => logs.push(v), log() {} },
      fetch: fetchMock,
    }, { filename: file });
    return loaded.exports;
  }
  return { load, calls, queries, logs, saved, settings };
}


// ── A) Mapeamento de métricas (puro) ───────────────────────────────────────
test('numeroMeta: formato textual da Graph API vira número finito ou null — nunca 0 fabricado', () => {
  assert.equal(metricas.numeroMeta('123.45'), 123.45);
  assert.equal(metricas.numeroMeta('0'), 0);
  assert.equal(metricas.numeroMeta(''), null);
  assert.equal(metricas.numeroMeta('abc'), null);
  assert.equal(metricas.numeroMeta(undefined), null);
  assert.equal(metricas.numeroMeta(NaN), null);
});
test('mapearMetricas: campanha sem insights fica null (nunca 0); insights de campanha fora da lista ainda entram', () => {
  const campanhas = [{ id: '601', nome: 'Campanha Teste', status: 'ACTIVE' }, { id: '602', nome: 'Sem dado', status: 'PAUSED' }];
  const insights = [
    { campaign_id: '601', campaign_name: 'Campanha Teste', spend: '123.45', impressions: '1000', reach: '800', clicks: '50', ctr: '5.00' },
    { campaign_id: '603', campaign_name: 'Removida', spend: '9.99', impressions: '10', reach: '8', clicks: '1', ctr: '1.0' },
  ];
  const m = metricas.mapearMetricas(campanhas, insights);
  assert.equal(m.length, 3);
  const t = m.find((x) => x.campaignId === '601');
  assert.deepEqual([t.gasto, t.impressoes, t.alcance, t.cliques, t.ctr], [123.45, 1000, 800, 50, 5]);
  const sem = m.find((x) => x.campaignId === '602');
  assert.deepEqual([sem.gasto, sem.impressoes, sem.alcance, sem.cliques, sem.ctr], [null, null, null, null, null]);
  const orfa = m.find((x) => x.campaignId === '603');
  assert.equal(orfa.gasto, 9.99);
  assert.equal(orfa.status, null);
});
test('juntarAtribuicaoMeta: só correspondência EXATA meta_ads+campaign_id — nunca por nome, utm ou outra plataforma', () => {
  const m = [{ campaignId: '601', nome: 'Campanha Teste', status: 'ACTIVE', gasto: 1, impressoes: 1, alcance: 1, cliques: 1, ctr: 1 }];
  const linhas = [
    { plataforma: 'meta_ads', campanha: '601', capturas: 3, leads: 2, oportunidades: 1, conversoes: 1, receitaCentavos: 2500 },
    { plataforma: 'meta_ads', campanha: '601', capturas: 1, leads: 0, oportunidades: 0, conversoes: 0, receitaCentavos: 0 },
    { plataforma: 'meta_ads', campanha: 'Campanha Teste', capturas: 9, leads: 9, oportunidades: 9, conversoes: 9, receitaCentavos: 9999 },
    { plataforma: 'google_ads', campanha: '601', capturas: 7, leads: 7, oportunidades: 7, conversoes: 7, receitaCentavos: 7777 },
  ];
  const j = metricas.juntarAtribuicaoMeta(m, linhas);
  assert.equal(j.length, 1);
  assert.deepEqual(j[0].atribuicao, { capturas: 4, leads: 2, oportunidades: 1, conversoes: 1, receitaCentavos: 2500 });
  const sem = metricas.juntarAtribuicaoMeta(m, [
    { plataforma: 'meta_ads', campanha: 'outra-id', capturas: 5, leads: 5, oportunidades: 5, conversoes: 5, receitaCentavos: 500 },
  ]);
  assert.equal(sem[0].atribuicao, null);
});
test('formatação: ausência vira "—", moeda malformada cai no fallback e total informa sem-dados', () => {
  assert.equal(metricas.formatarGastoMeta(null, 'BRL'), '—');
  assert.match(metricas.formatarGastoMeta(123.45, 'BRL'), /123,45/);
  assert.equal(metricas.formatarGastoMeta(1.5, 'E'), '1.50 E');
  assert.equal(metricas.formatarNumeroMeta(null), '—');
  assert.deepEqual(metricas.totalGastoMeta([{ gasto: 10 }, { gasto: null }, { gasto: 5.5 }]), { total: 15.5, semDados: 1 });
});

// ── B) GET /api/meta-ads — autorização, estados e sanitização ──────────────
const getReq = (params = '', opcoes = {}) => requisicao(`https://fixture.test/api/meta-ads${params}`, opcoes);
test('GET: sem clínica 400; sem sessão 401; vínculo alheio 403 ANTES de tocar na conexão', async () => {
  const f = fixture();
  const { GET } = f.load('app/api/meta-ads/route.ts');
  assert.equal((await GET(getReq())).status, 400);
  assert.equal((await GET(getReq('?clinica_id=tenant-a', { bearer: null }))).status, 401);
  const f2 = fixture({ member: false });
  const get2 = f2.load('app/api/meta-ads/route.ts').GET;
  assert.equal((await get2(getReq('?clinica_id=tenant-a'))).status, 403);
  assert.equal(f2.queries.filter((q) => q.table === 'meta_ads_conexoes').length, 0, 'nada é lido antes da autorização');
});
test('GET: sem configuração no servidor → estado honesto, ZERO chamadas à Meta e zero leituras', async () => {
  const f = fixture({ env: { META_APP_ID: '', META_APP_SECRET: '', META_TOKEN_KEY: '' } });
  const { GET } = f.load('app/api/meta-ads/route.ts');
  const r = await GET(getReq('?clinica_id=tenant-a'));
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'nao_configurada');
  assert.equal(r.body.detalhe, 'configuracao_ausente');
  assert.equal(f.calls.length, 0);
  assert.equal(f.queries.filter((q) => q.table === 'meta_ads_conexoes').length, 0);
});
test('GET: tenant sem conexão → sem_conexao com nenhuma chamada externa (estado vazio útil e verdadeiro)', async () => {
  const f = fixture({ semConexao: true });
  const { GET } = f.load('app/api/meta-ads/route.ts');
  const r = await GET(getReq('?clinica_id=tenant-a'));
  assert.equal(r.body.estado, 'nao_configurada');
  assert.equal(r.body.detalhe, 'sem_conexao');
  assert.equal(r.body.metricas, null);
  assert.equal(f.calls.length, 0);
});


test('GET: conectado lê campanhas+insights, mapeia métricas e NUNCA devolve credencial', async () => {
  const f = fixture();
  const { GET } = f.load('app/api/meta-ads/route.ts');
  const r = await GET(getReq('?clinica_id=tenant-a'));
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'conectada');
  assert.equal(r.body.conexao.contaNome, 'Conta Teste');
  assert.equal(r.body.metricas.periodo, 'last_30d');
  const c = r.body.metricas.campanhas[0];
  assert.equal(c.campaignId, '601');
  assert.equal(c.gasto, 123.45);
  assert.equal(c.impressoes, 1000);
  assert.equal(c.alcance, 800);
  assert.equal(c.cliques, 50);
  const bruto = JSON.stringify(r);
  assert.ok(!bruto.includes('access_token_ciphertext'));
  assert.ok(!bruto.includes('fixture-token'));
  const q = f.queries.find((q) => q.table === 'meta_ads_conexoes');
  assert.ok(q.filters.some(([k, v]) => k === 'clinica_id' && v === 'tenant-a'));
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
});
test('GET: falha da API externa → conectada + erroMetricas, métricas null (nunca zeros fabricados)', async () => {
  const f = fixture({ fetch: async () => ({ http: 500, body: { error: { message: 'boom interno' } } }) });
  const { GET } = f.load('app/api/meta-ads/route.ts');
  const r = await GET(getReq('?clinica_id=tenant-a'));
  assert.equal(r.body.estado, 'conectada');
  assert.equal(r.body.erroMetricas, true);
  assert.equal(r.body.metricas, null);
  assert.ok(!JSON.stringify(r).includes('boom interno'));
});
test('GET: permissão recusada pela Meta → pendente_homologacao honesto (App Review), sem número algum', async () => {
  const f = fixture({ fetch: async () => ({ http: 403, body: { error: { code: 200, type: 'OAuthException', message: 'Requires ads_read permission' } } }) });
  const { GET } = f.load('app/api/meta-ads/route.ts');
  const r = await GET(getReq('?clinica_id=tenant-a'));
  assert.equal(r.body.estado, 'pendente_homologacao');
  assert.equal(r.body.detalhe, 'conta_sem_permissao');
  assert.equal(r.body.metricas, null);
  assert.equal(r.body.erroMetricas, false);
});
test('GET: tabela ainda não aplicada → 503 indisponível sem vazar a mensagem do banco', async () => {
  const f = fixture({ dbError: true });
  const { GET } = f.load('app/api/meta-ads/route.ts');
  const r = await GET(getReq('?clinica_id=tenant-a'));
  assert.equal(r.status, 503);
  assert.equal(r.body.indisponivel, true);
  assert.equal(r.body.schemaPendente, true);
  assert.ok(!JSON.stringify(r).includes('fixture-sensitive-db'));
});
test('GET: isolamento por tenant — tenant autorizado sem conexão própria nunca vê a do tenant-a', async () => {
  const f = fixture({ vinculosExtra: ['tenant-b'] });
  const { GET } = f.load('app/api/meta-ads/route.ts');
  const r = await GET(getReq('?clinica_id=tenant-b'));
  assert.equal(r.body.estado, 'nao_configurada');
  assert.equal(r.body.detalhe, 'sem_conexao');
  const q = f.queries.find((q) => q.table === 'meta_ads_conexoes');
  assert.ok(q.filters.some(([k, v]) => k === 'clinica_id' && v === 'tenant-b'));
});
test('GET: cifra com outra chave → revogada e ZERO tentativas de leitura na Meta', async () => {
  const f = fixture({ ciphertext: cifrarFixture('token-de-outra-chave', 'segredo-diferente-total') });
  const { GET } = f.load('app/api/meta-ads/route.ts');
  const r = await GET(getReq('?clinica_id=tenant-a'));
  assert.equal(r.body.estado, 'revogada');
  assert.equal(r.body.detalhe, 'credencial_invalida');
  assert.equal(r.body.metricas, null);
  assert.equal(f.calls.length, 0);
});

// ── C) OAuth start — dialog oficial com escopo mínimo ──────────────────────
const startReq = (opcoes = {}) => requisicao('https://fixture.test/api/meta-ads/oauth/start', { body: { clinica_id: 'tenant-a' }, ...opcoes });
test('OAuth start: devolve dialog oficial v25.0 com scope=ads_read (nunca ads_management) e cookie HttpOnly', async () => {
  const f = fixture();
  const { POST, GET: getStart } = f.load('app/api/meta-ads/oauth/start/route.ts');
  const r = await POST(startReq());
  assert.equal(r.status, 200);
  assert.match(r.body.url, /facebook\.com\/v25\.0\/dialog\/oauth/);
  assert.match(r.body.url, /scope=ads_read/);
  assert.ok(!r.body.url.includes('ads_management'));
  assert.match(r.body.url, /state=/);
  assert.match(r.body.url, /client_id=fixture-app/);
  const cookie = r.cookies.values.get('meta_ads_oauth_session');
  assert.ok(cookie && cookie.httpOnly && cookie.value.length > 0);
  assert.ok(!String(cookie.value).includes('fixture-session'), 'bearer nunca em claro no cookie');
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal((await getStart()).status, 405, 'start só aceita POST');
});
test('OAuth start: origem divergente 403 e tenant sem vínculo 403 antes de qualquer chamada', async () => {
  const f = fixture();
  const { POST } = f.load('app/api/meta-ads/oauth/start/route.ts');
  const origemErrado = startReq({ origin: 'https://evil.test' });
  assert.equal((await POST(origemErrado)).status, 403);
  const f2 = fixture({ member: false });
  const post2 = f2.load('app/api/meta-ads/oauth/start/route.ts').POST;
  assert.equal((await post2(startReq())).status, 403);
  assert.equal(f2.calls.length, 0);
});
test('OAuth start: sem env do app → 409 configuracao, sem URL e sem chamada externa', async () => {
  const f = fixture({ env: { META_APP_ID: '' } });
  const { POST } = f.load('app/api/meta-ads/oauth/start/route.ts');
  const r = await POST(startReq());
  assert.equal(r.status, 409);
  assert.equal(r.body.estado, 'nao_configurada');
  assert.equal(f.calls.length, 0);
});


// ── D) OAuth callback — gravação cifrada por tenant e retornos honestos ────
function montarCallback(f, { estado = null, cookie = null, extra = '' } = {}) {
  const meta = f.load('lib/meta-ads.ts');
  const state = estado ?? meta.criarEstadoMeta('tenant-a', 'user-a', ENV_META.META_TOKEN_KEY);
  const cookieValor = cookie === null
    ? cifrarFixture(JSON.stringify({ bearer: 'fixture-session', state }), ENV_META.META_TOKEN_KEY + ':meta-oauth-session')
    : cookie;
  const cookies = cookieValor ? { meta_ads_oauth_session: cookieValor } : {};
  return new Request(
    `https://fixture.test/api/meta-ads/oauth/callback?code=fixture-code&state=${encodeURIComponent(state)}${extra}`,
    { cookies }
  );
}
test('OAuth callback: fluxo completo grava credencial CIFRADA do tenant e volta com status honesto', async () => {
  const f = fixture();
  const { GET } = f.load('app/api/meta-ads/oauth/callback/route.ts');
  const r = await GET(montarCallback(f));
  assert.match(r.location, /\/atribuicao\?meta_status=connected$/);
  assert.equal(f.saved.length, 1);
  const v = f.saved[0];
  assert.equal(v.clinica_id, 'tenant-a');
  assert.equal(v.conta_ads_id, 'act_123');
  assert.equal(v.conta_ads_nome, 'Conta Teste');
  assert.deepEqual([...v.escopos_grantados], ['ads_read']);
  assert.notEqual(v.access_token_ciphertext, 'fixture-token-long', 'token nunca em texto puro');
  assert.equal(decifrarFixture(v.access_token_ciphertext, ENV_META.META_TOKEN_KEY), 'fixture-token-long');
  assert.ok(!JSON.stringify(f.logs).includes('fixture-token'), 'nenhum segredo em log');
  const cookie = r.cookies.values.get('meta_ads_oauth_session');
  assert.equal(cookie.maxAge, 0, 'cookie temporário é limpo no retorno');
});
test('OAuth callback: state inválido ou cookie ausente → volta "oauth" sem gravar nada', async () => {
  const f = fixture();
  const { GET } = f.load('app/api/meta-ads/oauth/callback/route.ts');
  const comEstadoInvalido = await GET(montarCallback(f, { estado: 'estado-falso.assinatura' }));
  assert.match(comEstadoInvalido.location, /meta_status=oauth$/);
  const semCookie = await GET(montarCallback(f, { cookie: '' }));
  assert.match(semCookie.location, /meta_status=oauth$/);
  assert.equal(f.saved.length, 0);
});
test('OAuth callback: cancelamento na Meta → denied; sem conta ativa → sem_conta SEM gravar', async () => {
  const f1 = fixture();
  const get1 = f1.load('app/api/meta-ads/oauth/callback/route.ts').GET;
  const negado = await get1(montarCallback(f1, { extra: '&error=access_denied' }));
  assert.match(negado.location, /meta_status=denied$/);
  assert.equal(f1.saved.length, 0);
  const f2 = fixture({ contas: { data: [] } });
  const get2 = f2.load('app/api/meta-ads/oauth/callback/route.ts').GET;
  const semConta = await get2(montarCallback(f2));
  assert.match(semConta.location, /meta_status=sem_conta$/);
  assert.equal(f2.saved.length, 0, 'sem conta ativa nada é persistido');
});
test('OAuth callback: falha na troca do code → volta "erro" sem segredo em log', async () => {
  const f = fixture({ fetch: async () => ({ http: 400, body: { error: { message: 'bad code com token' } } }) });
  const { GET } = f.load('app/api/meta-ads/oauth/callback/route.ts');
  const r = await GET(montarCallback(f));
  assert.match(r.location, /meta_status=erro$/);
  assert.equal(f.saved.length, 0);
  assert.ok(!JSON.stringify(f.logs).includes('bad code com token'));
  assert.ok(!JSON.stringify(f.logs).includes('fixture-token'));
});
test('OAuth callback: recusa gravar sem revisar vínculo — revalidação do bearer no retorno externo', async () => {
  const f = fixture({ member: false });
  const { GET } = f.load('app/api/meta-ads/oauth/callback/route.ts');
  const r = await GET(montarCallback(f));
  assert.match(r.location, /meta_status=oauth$/);
  assert.equal(f.saved.length, 0);
});


// ── E) UI (MetaAdsSecao.tsx real) — estados sem dado fabricado ─────────────
function renderSecao(estados, linhas = []) {
  const file = path.join(root, 'app/atribuicao/MetaAdsSecao.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: file,
  }).outputText;
  let index = 0;
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'react') {
      return {
        ...React,
        useState: (inicial) => {
          const v = index < estados.length ? estados[index++] : (index++, typeof inicial === 'function' ? inicial() : inicial);
          return [v, () => {}];
        },
        useEffect: () => {},
        useCallback: (f) => f,
      };
    }
    if (request.endsWith('/meta-ads-metricas')) return metricas;
    return original.call(this, request, parent, isMain);
  };
  try {
    const m = new Module(file);
    m.filename = file;
    m.paths = Module._nodeModulePaths(path.dirname(file));
    m._compile(compiled, file);
    return renderToStaticMarkup(React.createElement(m.exports.default, {
      sessao: async () => ({ headers: {}, clinicaId: 'tenant-a' }),
      linhas,
    }));
  } finally {
    Module._load = original;
  }
}
const resumo = (extra) => ({ estado: 'nao_configurada', detalhe: 'sem_conexao', conexao: null, metricas: null, erroMetricas: false, ...extra });
const campanhas = [
  { campaignId: '601', nome: 'Campanha Teste', status: 'ACTIVE', gasto: 123.45, impressoes: 1000, alcance: 800, cliques: 50, ctr: 5.5 },
  { campaignId: '602', nome: 'Sem dado', status: 'PAUSED', gasto: null, impressoes: null, alcance: null, cliques: null, ctr: null },
];
const linhasJoin = [
  { plataforma: 'meta_ads', campanha: '601', capturas: 3, leads: 2, oportunidades: 1, conversoes: 1, receitaCentavos: 2500 },
  { plataforma: 'meta_ads', campanha: 'Sem dado', capturas: 9, leads: 9, oportunidades: 9, conversoes: 9, receitaCentavos: 9999 },
];
function semSegredos(html) {
  assert.ok(!html.includes('access_token'), 'UI nunca menciona token');
  assert.ok(!html.includes('fixture-token'), 'segredo fixture nunca aparece');
  assert.ok(!html.includes('ciphertext'), 'cifra nunca aparece');
}
test('UI: loading e erro de leitura são honestos — sem tabela, sem totais', () => {
  const carregando = renderSecao([true]);
  assert.match(carregando, /Verificando a conexão/);
  const erro = renderSecao([false, 'Falha ao ler a integração Meta']);
  assert.match(erro, /role="alert"/);
  assert.doesNotMatch(erro, /Campanha Teste/);
  semSegredos(erro);
});
test('UI: aguardando configuração mostra vazio acionável SEM botão; sem conexão mostra o botão e o escopo', () => {
  const configurando = renderSecao([false, '', resumo({ detalhe: 'configuracao_ausente' })]);
  assert.match(configurando, /aguardando configuração/);
  assert.doesNotMatch(configurando, /Conectar conta Meta/, 'sem config no servidor não se oferece conexão');
  const desconectado = renderSecao([false, '', resumo({ detalhe: 'sem_conexao' })]);
  assert.match(desconectado, /Conta de anúncios não conectada/);
  assert.match(desconectado, /Conectar conta Meta/);
  assert.match(desconectado, /ads_read/);
  assert.match(desconectado, /App Review/);
  semSegredos(configurando);
  semSegredos(desconectado);
});
test('UI: conectada renderiza métricas reais + atribuição EXATA (nome da campanha nunca casa)', () => {
  const html = renderSecao([false, '', resumo({
    estado: 'conectada', detalhe: 'ok',
    conexao: { contaNome: 'Conta Teste', conectadoEm: '2026-09-28' },
    metricas: { periodo: 'last_30d', moeda: 'BRL', campanhas },
  })], linhasJoin);
  assert.match(html, /Conta Teste/);
  assert.match(html, /Campanha Teste/);
  assert.match(html, /123,45/, 'gasto formatado');
  assert.match(html, /Ativa/);
  assert.match(html, /1\.000/, 'impressões formatadas');
  assert.match(html, /5,50%/);
  assert.match(html, /25,00/, 'receita da junção exata');
  assert.ok(html.includes('<td>3</td>') && html.includes('<td>2</td>'), 'capturas/leads da junção exata');
  assert.ok(!html.includes('<td>9</td>'), 'linha cujo campanha é só o NOME nunca é inferida como correspondência');
  assert.match(html, /Gasto lido no período/);
  semSegredos(html);
});
test('UI: erro de leitura com conexão ativa suprime a tabela (nunca zeros); estados revogada/pendente são honestos', () => {
  const falha = renderSecao([false, '', resumo({ estado: 'conectada', detalhe: 'erro_leitura', conexao: { contaNome: 'Conta Teste', conectadoEm: null }, metricas: null, erroMetricas: true })]);
  assert.match(falha, /role="alert"/);
  assert.match(falha, /Nada foi exibido como zero/);
  assert.doesNotMatch(falha, /Campanha Teste/);
  assert.doesNotMatch(falha, /Gasto lido/);
  const revogada = renderSecao([false, '', resumo({ estado: 'revogada', detalhe: 'credencial_invalida', conexao: { contaNome: 'X', conectadoEm: null } })]);
  assert.match(revogada, /Reconectar conta Meta/);
  const pendente = renderSecao([false, '', resumo({ estado: 'pendente_homologacao', detalhe: 'conta_sem_permissao', conexao: { contaNome: 'X', conectadoEm: null } })]);
  assert.match(pendente, /App Review/);
  assert.match(pendente, /Nenhum número foi lido/);
  assert.doesNotMatch(pendente, /123,45/);
  semSegredos(falha);
  semSegredos(revogada);
  semSegredos(pendente);
});


// ── F) Migration e wiring estático ─────────────────────────────────────────
test('migration: preparada e não executada, tenant-safe (FK/unique), RLS fechado e não-destrutiva', () => {
  const sql = ler('supabase/migrations/20260928000002_meta_ads_conexoes_v1.sql');
  assert.match(sql, /PREPARADA, NÃO EXECUTADA/);
  assert.match(sql, /create table if not exists public\.meta_ads_conexoes/);
  assert.match(sql, /clinica_id uuid not null unique references public\.clinicas\(id\)/);
  assert.match(sql, /access_token_ciphertext text not null/);
  assert.match(sql, /alter table public\.meta_ads_conexoes enable row level security/);
  assert.match(sql, /revoke all on public\.meta_ads_conexoes from public, anon, authenticated/);
  assert.doesNotMatch(sql, /drop table|truncate|delete from/i);
  assert.match(sql, /begin;[\s\S]*commit;/, 'transação explícita');
});
test('escopo mínimo ads_read; nenhuma escrita (ads_management) no código do V1', () => {
  const base = ler('lib/meta-ads.ts');
  const api = ler('lib/meta-ads-api.ts');
  // O dialog só pode pedir o que a constante contém — e ela é "ads_read".
  assert.match(base, /META_ADS_SCOPE = "ads_read"/);
  assert.match(base, /scope: META_ADS_SCOPE/);
  // Nenhuma escrita na Graph API: nenhuma requisição POST e nenhuma função
  // de criação/edição (ads_management) existe no código — comentários podem
  // documentar a exclusão, mas nada a implementa.
  assert.doesNotMatch(api, /method:\s*["']POST["']/, 'só leitura na Graph API');
  assert.doesNotMatch(api, /criarCampanha|editarCampanha|createCampaign|updateCampaign/);
  assert.doesNotMatch(ler('lib/meta-ads-oauth.ts'), /fetch\(/, 'oauth delega à camada de leitura; nenhuma escrita');
  assert.match(base, /v25\.0/, 'versão oficial consultada');
});
test('página /atribuicao: seção Meta Ads reusada (sem nav nova) e texto "não conectada" restrito ao Google', () => {
  const pagina = ler('app/atribuicao/page.tsx');
  assert.match(pagina, /import MetaAdsSecao from '.\/MetaAdsSecao'/);
  assert.match(pagina, /<MetaAdsSecao sessao=\{sessao\}/);
  assert.match(pagina, /filter\(c => c\.plataforma === 'google_ads'\)/);
  assert.match(pagina, /integração oficial não conectada/);
  assert.match(pagina, /AdminShell title="Ads e Atribuição"/);
  assert.match(pagina, /CAC\/ROAS: —/, 'CAC/ROAS continua honesto (custo não entra na agregação legada)');
});
test('rotas: start POST + 405 GET; callback GET + 405 POST; rota principal autoriza antes de ler', () => {
  assert.match(ler('app/api/meta-ads/oauth/start/route.ts'), /iniciarMeta as POST/);
  assert.match(ler('app/api/meta-ads/oauth/start/route.ts'), /status: 405/);
  assert.match(ler('app/api/meta-ads/oauth/callback/route.ts'), /concluirMeta as GET/);
  assert.match(ler('app/api/meta-ads/oauth/callback/route.ts'), /status: 405/);
  const rota = ler('app/api/meta-ads/route.ts');
  assert.match(rota, /autorizarUsuarioNaClinica/);
  assert.match(rota, /'Cache-Control': 'no-store'/);
  assert.match(rota, /schemaPendente/);
  const oauth = ler('lib/meta-ads-oauth.ts');
  assert.match(oauth, /httpOnly: true/, 'cookie de sessão HttpOnly');
  assert.match(oauth, /cifrarSegredoMeta/, 'bearer cifrado, nunca em claro');
  assert.doesNotMatch(oauth, /console\.(log|error)\([^)]*token/i, 'nenhum log com token');
});
test('suíte legada de UI de atribuição stuba o componente filho (regressão do import)', () => {
  assert.match(ler('tests/ads-atribuicao-ui.test.mjs'), /MetaAdsSecao/);
});

