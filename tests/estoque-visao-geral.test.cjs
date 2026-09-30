/* eslint-disable @typescript-eslint/no-require-imports -- Harness CommonJS executa a Visão Geral real localmente, sem serviços. */
// Estoque V1 na Visão Geral: só um alerta resumido quando há estoque baixo,
// com acesso à tela Estoque. Nunca aparece sem dado real, e falha da leitura
// de estoque nunca derruba a Casa.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { carregar } = require('./helpers/casa-harness.cjs');

const root = path.resolve(__dirname, '..');
const ler = p => fs.readFileSync(path.join(root, p), 'utf8');

test('estoque baixo: alerta resumido com link para Estoque', async () => {
  const { html } = await carregar({ estoque: { sucesso: true, estoqueAtivo: true, itens: [], estoqueBaixo: 2 } });
  assert.match(html, /data-testid="alerta-estoque-baixo"/);
  assert.match(html, /2 produtos chegaram<!-- --> ao estoque mínimo|2 produtos chegaram ao estoque mínimo/);
  assert.match(html, /href="\/estoque"/);
});

test('sem estoque baixo, estoque não ativo ou leitura com falha: nenhum alerta e Casa intacta', async () => {
  for (const options of [
    { estoque: { sucesso: true, estoqueAtivo: true, itens: [], estoqueBaixo: 0 } },
    { estoque: { sucesso: true, estoqueAtivo: false, itens: [], estoqueBaixo: 3 } },
    { apiError: '/api/estoque' },
    { networkError: '/api/estoque' },
  ]) {
    const { html } = await carregar(options);
    assert.doesNotMatch(html, /alerta-estoque-baixo/, JSON.stringify(options));
    assert.match(html, /Precisa da sua atenção/);
    assert.doesNotMatch(html, /role="alert"/);
  }
});

test('leitura de estoque na Casa é autenticada e filtrada pelo negócio', async () => {
  const r = await carregar();
  const chamada = r.calls.find(c => c.url.startsWith('/api/estoque'));
  assert.ok(chamada);
  assert.match(chamada.url, /clinica_id=tenant-teste/);
  assert.equal(chamada.init.headers.Authorization, 'Bearer token-local-de-teste');
});

test('menu tem "Estoque" logo após Catálogo e Pedidos; a tela existe', () => {
  const menu = ler('app/components/AdminShellFrame.tsx');
  assert.match(menu, /\{ l: "Catálogo e Pedidos",\s+h: "\/pedidos",[^\n]*\n\s+\{ l: "Estoque",\s+h: "\/estoque"/);
  const tela = ler('app/estoque/page.tsx');
  assert.match(tela, /<AdminShell title="Estoque"/);
  for (const f of ['+ Entrada', 'Ajustar', 'Histórico', 'Configurar', 'Estoque baixo', 'Buscar por nome, SKU ou código de barras']) assert.ok(tela.includes(f), f);
});

test('Estoque V1 é só operacional: nenhum termo fiscal/tributário/contábil', () => {
  const arquivos = ['app/estoque/page.tsx', 'lib/motor-estoque.ts', 'app/api/estoque/route.ts', 'app/api/estoque/movimentos/route.ts', 'supabase/migrations/20261001000001_estoque_basico_v1.sql'];
  for (const a of arquivos) {
    const semComentariosDeEscopo = ler(a).replace(/nenhuma\s*(?:\/\/|--)?\s*função fiscal, tributária ou\s*(?:\/\/|--)?\s*contábil/g, '');
    assert.doesNotMatch(semComentariosDeEscopo, /nota fiscal|\bNF-?e\b|\bNCM\b|\bCFOP\b|\bICMS\b|\bIPI\b|tribut|fiscal|contábil|custo médio/i, a);
  }
});

test('migration: tabelas novas fechadas, SKU/código únicos por negócio, funções só do servidor', () => {
  const sql = ler('supabase/migrations/20261001000001_estoque_basico_v1.sql');
  assert.match(sql, /^-- PREPARADA PARA REVISAO\. NAO APLICADA AO SUPABASE\./);
  for (const t of ['estoque_saldos', 'estoque_movimentos']) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security;`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${t} from public, anon, authenticated;`));
  }
  assert.doesNotMatch(sql, /create policy/i, 'sem policies: acesso só via service role');
  assert.match(sql, /on public\.clinica_servicos \(clinica_id, lower\(sku\)\) where sku is not null/);
  assert.match(sql, /on public\.clinica_servicos \(clinica_id, codigo_barras\) where codigo_barras is not null/);
  assert.match(sql, /on public\.estoque_movimentos \(pedido_id, servico_id, tipo\) where pedido_id is not null/);
  assert.match(sql, /foreign key \(servico_id, clinica_id\) references public\.clinica_servicos\(id, clinica_id\)/);
  assert.match(sql, /revoke all on function public\.pedido_transicionar_com_estoque_v1\(uuid, uuid, text, text\) from public, anon, authenticated;/);
  assert.match(sql, /revoke all on function public\.estoque_registrar_movimento_v1\([^)]*\) from public, anon, authenticated;/);
  assert.match(sql, /add column if not exists tipo_item text not null default 'servico'/);
  assert.match(sql, /add column if not exists controla_estoque boolean not null default false/);
});
