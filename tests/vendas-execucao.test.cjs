/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route + engine tests, no network, no database. */
// Convergência Comercial Definitiva — Pedidos = Venda/Execução única.
//
// Prova, sem rede e sem banco, o fluxo inteiro
//   Oportunidade → Orçamento → Registrar venda → Execução → Retorno →
//   Cobrança → Pagamento/Receita
// com as rotas REAIS (harness isolado) e os motores REAIS dos leitores
// (Receita Perdida, Previsor, Linha Econômica, Cliente 360, Follow-up).
// Regras centrais: uma venda por orçamento, nenhuma dupla receita, cada
// venda uma única vez no dinheiro, nada gravado sem confirmação humana.
//
// node --test tests/vendas-execucao.test.cjs

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture } = require('./helpers/pedidos-fixture.cjs');

const root = path.resolve(__dirname, '..');
const ler = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const semComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/^\s*--.*$/gm, '');
const plain = v => JSON.parse(JSON.stringify(v));

const PEDIDOS = 'app/api/pedidos/route.ts';
const EXECUCAO = 'app/api/pedidos/[id]/execucao/route.ts';
const COBRANCAS = 'app/api/cobrancas/route.ts';
const params = id => ({ params: Promise.resolve({ id }) });

const ORC = '11111111-1111-4111-8111-111111111111';
const ORC_APRESENTADO = '22222222-2222-4222-8222-222222222222';
const HOJE = '2026-10-02';
const AGORA = '2026-10-02T12:00:00.000Z';

function comOrcamento() {
  const f = fixture();
  f.tables.orcamentos.push(
    { id: ORC, clinica_id: 'a', status: 'aprovado', paciente_nome: 'Maria', telefone: '43999990001', procedimento: 'Instalação de box', valor: 180 },
    { id: ORC_APRESENTADO, clinica_id: 'a', status: 'apresentado', paciente_nome: 'João', telefone: null, procedimento: 'Pintura', valor: 500 },
  );
  return f;
}
const venda = (f, extra = {}) => f.load(PEDIDOS).POST(f.request({
  clinica_id: 'a', nome_cliente: 'Maria', telefone: '43999990001',
  itens: [{ descricao: 'Instalação de box', valor_unitario_centavos: 18000, quantidade: 1 }],
  idempotency_key: 'k-' + Math.random(), ...extra,
}));
const execucao = (f, id, body, tenant = 'a', usuarioDe = tenant) => f.load(EXECUCAO).POST(f.request({ clinica_id: tenant, ...body }, usuarioDe), params(id));

// ── 1. Orçamento → Registrar venda ──────────────────────────────────────

test('orçamento aprovado vira venda com vínculo de origem e execução acompanhada (só ao confirmar)', async () => {
  const f = comOrcamento();
  const r = await venda(f, { orcamento_origem_id: ORC, acompanhar_execucao: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const p = f.tables.pedidos[0];
  assert.equal(p.orcamento_origem_id, ORC);
  assert.equal(p.execucao_status, 'em_andamento');
  assert.equal(p.status, 'criado', 'comercial/pagamento começa igual a qualquer pedido');
  assert.equal(f.tables.pedido_itens[0].descricao, 'Instalação de box');
  assert.equal(p.valor_centavos, 18000);
});

test('uma venda por orçamento: segunda venda do mesmo orçamento é recusada (409)', async () => {
  const f = comOrcamento();
  assert.equal((await venda(f, { orcamento_origem_id: ORC })).status, 200);
  const r = await venda(f, { orcamento_origem_id: ORC });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Já existe uma venda registrada a partir deste orçamento/);
  assert.equal(f.tables.pedidos.length, 1, 'nenhum segundo pedido gravado');
});

test('só orçamento APROVADO do MESMO negócio vira venda', async () => {
  const f = comOrcamento();
  assert.equal((await venda(f, { orcamento_origem_id: ORC_APRESENTADO })).status, 409);
  f.tables.orcamentos.push({ id: '33333333-3333-4333-8333-333333333333', clinica_id: 'b', status: 'aprovado' });
  assert.equal((await venda(f, { orcamento_origem_id: '33333333-3333-4333-8333-333333333333' })).status, 400, 'orçamento de outro negócio');
  assert.equal((await venda(f, { orcamento_origem_id: 'nao-uuid' })).status, 400);
  assert.equal(f.tables.pedidos.length, 0);
});

test('pedido avulso (sem orçamento/execução) continua idêntico: nenhuma coluna nova gravada', async () => {
  const f = comOrcamento();
  assert.equal((await venda(f)).status, 200);
  const insert = f.calls.find(c => c.table === 'pedidos' && c.action === 'insert');
  assert.ok(!('orcamento_origem_id' in insert.value) && !('execucao_status' in insert.value));
});

test('pedido do site não aceita orçamento de origem nem execução', async () => {
  const f = comOrcamento();
  const r = await venda(f, { origem: 'site_publico', orcamento_origem_id: ORC, itens: [{ servico_id: 'service-a', quantidade: 1 }] });
  assert.equal(r.status, 400);
  assert.equal(f.tables.pedidos.length, 0);
});

// ── 2. Execução e retorno (dimensão separada do pagamento) ──────────────

test('execução: em andamento → retorno agendado (exige data) → concluído, sem tocar no pagamento', async () => {
  const f = comOrcamento();
  await venda(f, { orcamento_origem_id: ORC, acompanhar_execucao: true });
  const id = f.tables.pedidos[0].id;
  assert.equal((await execucao(f, id, { novo_status: 'retorno_agendado' })).status, 400, 'retorno sem data');
  const r1 = await execucao(f, id, { novo_status: 'retorno_agendado', proxima_data_prevista: '2026-10-20' });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(f.tables.pedidos[0].proxima_data_prevista, '2026-10-20');
  const r2 = await execucao(f, id, { novo_status: 'concluido' });
  assert.equal(r2.status, 200);
  assert.equal(f.tables.pedidos[0].execucao_status, 'concluido');
  assert.ok(f.tables.pedidos[0].execucao_concluida_em);
  assert.equal(f.tables.pedidos[0].status, 'criado', 'serviço concluído não é pagamento recebido');
  assert.equal((await execucao(f, id, { novo_status: 'interrompido' })).status, 409, 'sem regressão depois de concluído');
  const eventos = f.tables.eventos_dominio.filter(e => e.entidade_tipo === 'pedido').map(e => e.tipo);
  assert.ok(eventos.includes('pedido.execucao_retorno_agendado') && eventos.includes('pedido.execucao_concluido'), eventos.join(','));
});

test('execução: interromper registra motivo; abandonar só depois de interrompido; venda cancelada não tem execução', async () => {
  const f = comOrcamento();
  await venda(f, { acompanhar_execucao: true });
  const id = f.tables.pedidos[0].id;
  assert.equal((await execucao(f, id, { novo_status: 'abandonado' })).status, 409);
  assert.equal((await execucao(f, id, { novo_status: 'interrompido', motivo_interrupcao: 'financeiro' })).status, 200);
  assert.equal(f.tables.pedidos[0].motivo_interrupcao, 'financeiro');
  assert.equal((await execucao(f, id, { novo_status: 'abandonado' })).status, 200);
  f.tables.pedidos.push({ id: 'p-cancelado', clinica_id: 'a', status: 'cancelado', execucao_status: null, valor_centavos: 100 });
  assert.equal((await execucao(f, 'p-cancelado', { novo_status: 'em_andamento' })).status, 409);
});

test('execução: venda sem acompanhamento pode começar a ser acompanhada; outro negócio é recusado', async () => {
  const f = comOrcamento();
  await venda(f);
  const id = f.tables.pedidos[0].id;
  assert.equal((await execucao(f, id, { novo_status: 'em_andamento' }, 'b', 'a')).status, 403, 'usuário sem vínculo com o negócio');
  assert.equal((await execucao(f, id, { novo_status: 'em_andamento' }, 'b')).status, 404, 'outro negócio nem descobre que a venda existe');
  assert.equal(f.tables.pedidos[0].execucao_status ?? null, null);
  assert.equal((await execucao(f, id, { novo_status: 'em_andamento' })).status, 200);
  assert.equal(f.tables.pedidos[0].execucao_status, 'em_andamento');
  assert.equal((await execucao(f, id, { novo_status: 'xpto' })).status, 400);
});

// ── 3. Cobrança nasce da venda ──────────────────────────────────────────

const cobranca = (f, extra = {}) => f.load(COBRANCAS).POST(f.request({
  clinica_id: 'a', paciente_nome: 'Maria', paciente_telefone: '43999990001', descricao: 'Instalação de box',
  vencimento: '2026-10-15', idempotency_key: 'c-' + Math.random(), ...extra,
}));

test('cobrança com venda de origem: valor da venda por padrão, vínculo gravado; venda cancelada/inexistente recusada', async () => {
  const f = comOrcamento();
  f.tables.pedidos.push({ id: '44444444-4444-4444-8444-444444444444', clinica_id: 'a', status: 'confirmado', valor_centavos: 18000 });
  const r = await cobranca(f, { pedido_origem_id: '44444444-4444-4444-8444-444444444444' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(f.tables.cobrancas[0].pedido_origem_id, '44444444-4444-4444-8444-444444444444');
  assert.equal(f.tables.cobrancas[0].valor, 180);
  f.tables.pedidos.push({ id: '55555555-5555-4555-8555-555555555555', clinica_id: 'a', status: 'cancelado', valor_centavos: 100 });
  assert.equal((await cobranca(f, { pedido_origem_id: '55555555-5555-4555-8555-555555555555' })).status, 409);
  assert.equal((await cobranca(f, { pedido_origem_id: '66666666-6666-4666-8666-666666666666' })).status, 400);
});

test('cobrança avulsa continua idêntica (sem pedido_origem_id)', async () => {
  const f = comOrcamento();
  assert.equal((await cobranca(f, { valor: 99.9 })).status, 200);
  assert.ok(!('pedido_origem_id' in f.tables.cobrancas[0]));
});

// ── 4. Leitores: cada venda uma única vez, nenhuma dupla receita ────────

function motores() {
  const f = fixture();
  return {
    vendas: f.load('lib/venda-execucao.ts'),
    receita: f.load('lib/receita-perdida.ts'),
    previsor: f.load('lib/previsor-faturamento.ts'),
    linha: f.load('lib/linha-economica.ts'),
    c360: f.load('lib/cliente-360.ts'),
    followup: f.load('lib/follow-up-comercial.ts'),
  };
}
const pedido = (id, extra = {}) => ({ id, clinica_id: 'a', paciente_id: null, nome_cliente: 'Maria', telefone: '43999990001', valor_centavos: 18000,
  status: 'confirmado', criado_em: '2026-09-01T12:00:00.000Z', updated_at: '2026-09-01T12:00:00.000Z', pagamento_confirmado_em: null,
  pedido_itens: [{ descricao: 'Instalação de box', quantidade: 1 }], ...extra });

test('partição: cada venda entra no dinheiro por UM só caminho; cobrança vinculada e venda paga ficam fora', () => {
  const { vendas } = motores();
  const partes = vendas.particionarVendas([
    pedido('p-exec', { execucao_status: 'em_andamento' }),          // execução ativa, a receber
    pedido('p-aberto'),                                              // sem execução, a receber
    pedido('p-cobranca', { execucao_status: 'em_andamento' }),      // tem cobrança → fora do dinheiro
    pedido('p-pago', { status: 'pago', execucao_status: 'retorno_agendado' }), // pago → fora do dinheiro
    pedido('p-concluido', { execucao_status: 'concluido' }),        // execução encerrada → caminho de pedido
    pedido('p-cancelado', { status: 'cancelado', execucao_status: 'em_andamento' }),
  ], [{ pedido_origem_id: 'p-cobranca', status: 'pendente' }, { pedido_origem_id: 'p-aberto', status: 'cancelada' }]);
  assert.deepEqual(plain(partes.acompanhamentos.map(t => t.id).sort()), ['p-cobranca', 'p-exec', 'p-pago'], 'sinais de relacionamento: pago ou não');
  assert.deepEqual(plain(partes.acompanhamentosAReceber.map(t => t.id)), ['p-exec']);
  assert.deepEqual(plain(partes.pedidosAReceber.map(p => p.id).sort()), ['p-aberto', 'p-concluido'], 'cobrança cancelada não conta como vínculo');
  const ids = [...partes.acompanhamentosAReceber.map(t => t.id), ...partes.pedidosAReceber.map(p => p.id)];
  assert.equal(new Set(ids).size, ids.length, 'nenhuma venda em dois caminhos');
  const t = partes.acompanhamentosAReceber[0];
  assert.equal(t.tipo_tratamento, 'Instalação de box');
  assert.equal(t.valor_estimado, 180);
  assert.equal(t.status, 'em_andamento');
});

test('Receita Perdida: venda em execução sem retorno conta uma vez (→ /pedidos) e nunca também como pedido não concluído', () => {
  const { vendas, receita } = motores();
  const partes = vendas.particionarVendas([pedido('p1', { execucao_status: 'em_andamento' }), pedido('p2')], []);
  const r = receita.agregarReceitaPerdida({
    hoje: HOJE, agora: AGORA, orcamentosParados: [], cobrancasAtrasadas: [], oportunidadesAbertas: [],
    tratamentosSemRetorno: partes.acompanhamentosAReceber.map(t => ({ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status, proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em, valorEstimado: t.valor_estimado })),
    pedidosNaoConcluidos: partes.pedidosAReceber.map(p => ({ id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: 'pedido', valor: p.valor_centavos / 100, criadoEm: p.criado_em })),
  });
  const itens = plain(r).itens ?? plain(r).grupos?.flatMap(g => g.itens);
  const porId = Object.fromEntries(itens.map(i => [i.id, i]));
  assert.equal(itens.filter(i => i.id === 'p1').length, 1);
  assert.equal(porId.p1.origem, 'tratamento_sem_retorno');
  assert.equal(porId.p1.destino, '/pedidos');
  assert.equal(porId.p2.origem, 'pedido_nao_concluido');
  assert.equal(r.totalConhecido, 360);
});

test('Previsor: venda com cobrança aberta conta só pela cobrança', () => {
  const { vendas, previsor } = motores();
  const cobrancas = [{ id: 'c1', pedido_origem_id: 'p1', status: 'pendente' }];
  const partes = vendas.particionarVendas([pedido('p1', { execucao_status: 'retorno_agendado', proxima_data_prevista: '2026-10-10' })], cobrancas);
  const r = previsor.gerarPrevisorFaturamento({
    hoje: HOJE, agora: AGORA, orcamentosApresentados: [], oportunidadesAbertas: [],
    cobrancasAbertas: [{ id: 'c1', pacienteNome: 'Maria', telefone: null, descricao: 'Box', valor: 180, vencimento: '2026-10-15', status: 'pendente', tratamentoOrigemId: null }],
    tratamentos: partes.acompanhamentosAReceber.map(t => ({ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status, valorEstimado: t.valor_estimado, proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em })),
    pedidosAbertos: partes.pedidosAReceber.map(p => ({ id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: 'pedido', valor: p.valor_centavos / 100, criadoEm: p.criado_em, status: p.status })),
  });
  assert.equal(r.totalEsperado30Dias, 180, 'a mesma venda nunca soma duas vezes');
});

test('fluxo completo → Linha Econômica e Cliente 360: cobrança paga da venda conta UMA vez, rastreável até a oportunidade', () => {
  const { linha, c360 } = motores();
  const vendaPaga = { id: 'p1', status: 'pago', pacienteNome: 'Maria', valor: 180, pagamentoConfirmadoEm: '2026-10-01T10:00:00Z', orcamentoOrigemId: 'orc-1' };
  const r = linha.gerarLinhaEconomica({
    oportunidades: [{ id: 'op-1', canal: 'site', status: 'convertida', orcamentoVinculadoId: 'orc-1' }],
    orcamentos: [{ id: 'orc-1', status: 'aprovado', valor: 180, apresentadoEm: '2026-09-01T10:00:00Z', decididoEm: '2026-09-03T10:00:00Z' }],
    tratamentos: [],
    cobrancas: [{ id: 'c1', pacienteNome: 'Maria', tratamentoOrigemId: null, pedidoOrigemId: 'p1', status: 'pago', valor: 180, valorPago: 180, vencimento: '2026-10-15', pagoEm: '2026-10-01T10:00:00Z', emCobrancaEm: null }],
    pedidos: [vendaPaga],
  });
  assert.equal(r.totalComprovado, 180, 'pedido pago + cobrança paga da mesma venda = uma receita');
  assert.equal(r.quantidadeComprovada, 1);
  assert.equal(r.itens[0].origem, 'cobranca');
  assert.deepEqual(plain(r.itens[0].trilha.map(e => e.etapa)),['oportunidade', 'orcamento', 'pedido', 'cobranca']);
  assert.equal(r.totalAtribuivel, 180);
  // Sem cobrança, a venda paga pelo fluxo próprio do pedido é a receita — e também rastreável.
  const s = linha.gerarLinhaEconomica({ oportunidades: [{ id: 'op-1', canal: 'site', status: 'convertida', orcamentoVinculadoId: 'orc-1' }],
    orcamentos: [{ id: 'orc-1', status: 'aprovado', valor: 180, apresentadoEm: '2026-09-01T10:00:00Z', decididoEm: null }], tratamentos: [], cobrancas: [], pedidos: [vendaPaga] });
  assert.equal(s.totalComprovado, 180);
  assert.equal(s.totalAtribuivel, 180);

  const cliente = { id: 'cli-1', nome: 'Maria', telefone: '43999990001', whatsapp: null, email: null, status: 'ativo', proximaConsulta: null, criadoEm: '2026-01-01T00:00:00Z' };
  const v = c360.gerarCliente360({
    cliente, agora: AGORA, agendamentos: [], oportunidades: [], orcamentos: [], avaliacoes: [],
    tratamentos: [{ id: 't-legado', pacienteId: null, telefone: '43999990001', tipoTratamento: 'Serviço antigo', status: 'concluido', valorEstimado: 90, proximaDataPrevista: null, iniciadoEm: '2026-05-01T00:00:00Z', concluidoEm: '2026-05-10T00:00:00Z' }],
    cobrancas: [{ id: 'c1', pacienteId: null, telefone: '43999990001', descricao: 'Box', valor: 180, valorPago: 180, vencimento: '2026-10-15', status: 'pago', pagoEm: '2026-10-01T10:00:00Z', emCobrancaEm: null, pedidoOrigemId: 'p1' }],
    pedidos: [{ id: 'p1', pacienteId: null, telefone: '43999990001', descricao: 'Instalação de box', valor: 180, status: 'pago', criadoEm: '2026-09-05T10:00:00Z', pagamentoConfirmadoEm: '2026-10-01T10:00:00Z', execucaoConcluidaEm: '2026-09-20T10:00:00Z' }],
  });
  assert.equal(v.indicadores.totalPago, 180, 'sem dupla receita no cliente');
  const descricoes = v.timeline.map(e => e.descricao);
  assert.ok(descricoes.includes('Serviço concluído: Instalação de box'), 'execução da venda aparece');
  assert.ok(descricoes.includes('Serviço iniciado: Serviço antigo'), 'histórico antigo continua visível');
});

test('Follow-up: "sem retorno" vem da venda (entidade pedido, destino /pedidos)', () => {
  const { vendas, followup } = motores();
  const partes = vendas.particionarVendas([pedido('p1', { execucao_status: 'em_andamento', updated_at: '2026-09-01T12:00:00.000Z' })], []);
  const casos = followup.gerarFollowUpsComerciais({
    hoje: HOJE, agora: AGORA, entidadesComTentativaHoje: new Set(), oportunidadesParadas: [], orcamentosParados: [], pedidosNaoConcluidos: [], recomprasPossiveis: [],
    tratamentosSemRetorno: partes.acompanhamentos.map(t => ({ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status, proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em })),
  });
  assert.equal(casos.length, 1);
  assert.equal(casos[0].tipo, 'tratamento_sem_retorno');
  assert.equal(casos[0].entidadeTipo, 'pedido');
  assert.equal(casos[0].entidadeId, 'p1');
  assert.equal(casos[0].destino, '/pedidos');
});

test('máquina de execução: mesmas regras do motor de tratamento, adaptadas à venda', () => {
  const { vendas } = motores();
  assert.deepEqual(plain(vendas.proximosStatusExecucao(null)), ['em_andamento']);
  assert.deepEqual(plain(vendas.proximosStatusExecucao('em_andamento')), ['retorno_agendado', 'concluido', 'interrompido']);
  assert.deepEqual(plain(vendas.proximosStatusExecucao('retorno_agendado')), ['concluido']);
  assert.deepEqual(plain(vendas.proximosStatusExecucao('interrompido')), ['abandonado']);
  assert.deepEqual(plain(vendas.proximosStatusExecucao('concluido')), []);
  assert.equal(vendas.transicionarExecucao({ status: 'confirmado', execucao_status: 'em_andamento' }, 'retorno_agendado', { proximaDataPrevista: '20/10/2026' }, AGORA), null, 'data inválida');
  assert.equal(vendas.pedidoPagoContaComoReceita({ id: 'p1', status: 'pago' }, new Set(['p1'])), false);
  assert.equal(vendas.pedidoPagoContaComoReceita({ id: 'p1', status: 'pago' }, new Set()), true);
});

// ── 5. Telas, menu, histórico e SQL preparado ───────────────────────────

test('Serviços contratados fora do menu operacional; rota mantida como histórico somente leitura', () => {
  const shell = ler('app/components/AdminShellFrame.tsx');
  assert.doesNotMatch(shell, /l: "Serviços contratados"/);
  assert.match(shell, /export const ROTAS_COM_SHELL[\s\S]*?"\/tratamentos",/);
  const trat = semComentarios(ler('app/tratamentos/page.tsx'));
  assert.doesNotMatch(trat, /method: 'POST'|actionLabel="\+ Novo serviço"/, 'nenhum cadastro novo');
  assert.match(trat, /fetch\(`\/api\/tratamentos\?clinica_id=\$\{cid\}`/, 'histórico preservado');
  // APIs antigas preservadas por compatibilidade (ClínicaFlow / histórico).
  for (const f of ['app/api/tratamentos/route.ts', 'app/api/tratamentos/[id]/transicao/route.ts']) assert.ok(fs.existsSync(path.join(root, f)), f);
});

test('nenhum leitor do OrganizaPro depende de /api/tratamentos para funcionar (exceto histórico do cliente e a própria tela de histórico)', () => {
  for (const f of ['app/dashboard/page.tsx', 'app/copiloto/page.tsx', 'app/financeiro/page.tsx', 'app/follow-up/page.tsx', 'app/previsor-faturamento/page.tsx',
    'app/linha-economica/page.tsx', 'app/receita-perdida/page.tsx', 'app/cobrancas/page.tsx', 'app/pedidos/page.tsx', 'app/orcamentos/page.tsx']) {
    assert.doesNotMatch(ler(f), /\/api\/tratamentos/, f);
  }
  assert.match(ler('lib/follow-up-persistencia.ts'), /admin\.from\("pedidos"\)[\s\S]*?\.in\("execucao_status", \["em_andamento", "interrompido"\]\)/);
  // Cliente 360: histórico antigo visível, sem duplicar o que já virou venda.
  assert.match(ler('app/clientes/[id]/page.tsx'), /filter\(t => !migrados\.has\(t\.id\)\)/);
});

test('navegar/abrir formulários não cria registro: Pedidos só grava ao confirmar', () => {
  const p = semComentarios(ler('app/pedidos/page.tsx'));
  const posts = [...p.matchAll(/fetch\(([^,]+),\s*\{\s*method: 'POST'/g)].map(m => m[1].trim());
  assert.deepEqual(posts, ["'/api/pedidos'", '`/api/pedidos/${pedido.id}/transicao`', '`/api/pedidos/${pedido.id}/execucao`']);
  assert.match(p, /setModalNovo\(true\);\s*\}/, 'prefill de orçamento só abre o formulário');
});

test('migration preparada: só aditiva, nada apagado, vínculos dentro do mesmo negócio', () => {
  const sql = semComentarios(ler('supabase/migrations/20261002000001_vendas_execucao_v1.sql'));
  assert.match(sql, /^begin;[\s\S]*commit;\s*$/m);
  assert.doesNotMatch(sql, /\bdrop\s+(table|column)\b|\bdelete\s+from\b|\btruncate\b|\bupdate\s+public\./i);
  for (const col of ['orcamento_origem_id', 'tratamento_legado_id', 'execucao_status', 'proxima_data_prevista', 'motivo_interrupcao', 'execucao_concluida_em', 'execucao_interrompida_em', 'execucao_abandonada_em', 'pedido_origem_id']) {
    assert.match(sql, new RegExp(`add column if not exists ${col}\\b`), col);
  }
  assert.match(sql, /create unique index if not exists pedidos_orcamento_origem_uidx\s+on public\.pedidos \(orcamento_origem_id\) where orcamento_origem_id is not null;/);
  assert.match(sql, /pedidos_valida_origem_tenant/);
  assert.match(sql, /cobrancas_valida_pedido_tenant/);
});

test('migração de dados preparada: transacional, idempotente, valida antes/depois e nunca apaga histórico', () => {
  const sql = semComentarios(ler('sql/convergencia-vendas-migrar-servicos-contratados.sql'));
  // v2: UMA instrução (bloco DO) — atômica mesmo quando o cliente (SQL Editor
  // do Supabase) executa cada instrução em transação própria. Sem tabela
  // temporária e sem depender de begin/commit (causa do incidente da v1).
  assert.equal(sql.match(/\bdo \$\$/g)?.length, 1, 'um único bloco DO');
  assert.doesNotMatch(sql, /\bcreate\s+temp|\bbegin;|\bcommit;/i);
  const posBloco = sql.slice(sql.lastIndexOf('end $$;') + 'end $$;'.length);
  assert.doesNotMatch(posBloco, /\b(insert|update|delete)\b/i, 'depois do bloco, só leitura');
  // "on commit drop" é só a tabela temporária de controle; nada real é apagado.
  assert.doesNotMatch(sql, /\bdelete\s+from\b|\bdrop\s+(table|column|function|trigger|index|constraint)\b|\btruncate\b/i);
  assert.doesNotMatch(sql, /update\s+public\.(tratamentos|eventos_dominio|estoque_movimentos|pedido_itens)\b/i);
  assert.doesNotMatch(sql, /update\s+public\.pedidos\b/i, 'pedido existente (cancelado) nunca é alterado');
  assert.match(sql, /where not exists \(select 1 from public\.pedidos p where p\.tratamento_legado_id = t\.id\)/, 'idempotente');
  assert.match(sql, /on conflict \(clinica_id, chave_idempotencia\) do nothing/);
  assert.match(sql, /raise exception 'Esperados 3 serviços contratados/);
  assert.match(sql, /raise exception 'Eventos históricos de tratamento foram alterados/);
  assert.match(sql, /raise exception 'Movimentos de estoque foram alterados/);
});
