import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const dir = process.env.CONVERGENCIA_BUILD_DIR;
if (!dir) throw new Error('CONVERGENCIA_BUILD_DIR obrigatório');
const { gerarRelatorioCampanhas } = require(path.join(dir, 'atribuicao-relatorio.js'));
const { capturarOrigem, classificarOrigem } = require(path.join(dir, 'atribuicao-origem.js'));
const { capturarIdentificadoresAds, CONEXOES_ADS_V1 } = require(path.join(dir, 'ads-contratos.js'));
const { registrarVinculoAtribuicao, vincularOrigemPublica } = require(path.join(dir, 'atribuicao-vinculos.js'));
const { lerFonteAtribuicao, carregarRelatorioAtribuicao } = require(path.join(dir, 'atribuicao-dados.js'));

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const origem = (id = uuid(1), params = 'gclid=clique&utm_campaign=campanha-a') => ({
  ...capturarOrigem(new URLSearchParams(params), null, '2026-09-01T12:00:00Z'),
  id, pacienteId: uuid(2), identificadores: null,
});
const vinculo = (tipo = 'oportunidade', id = uuid(3), origemId = uuid(1)) => ({
  origemId, entidadeTipo: tipo, entidadeId: id, evidencia: 'Referência verificável do contato', metodo: 'codigo_site',
});
function entrada() {
  return {
    origens: [origem()], vinculos: [vinculo()],
    entidades: [{ tipo: 'cliente', id: uuid(2), nome: 'Cliente teste' }, { tipo: 'oportunidade', id: uuid(3), nome: 'Cliente teste' }, { tipo: 'orcamento', id: uuid(4), nome: 'Cliente teste' }, { tipo: 'agendamento', id: uuid(8), nome: 'Cliente teste' }, { tipo: 'cobranca', id: uuid(6), nome: 'Cliente teste' }, { tipo: 'pedido', id: uuid(7), nome: 'Outro cliente' }],
    oportunidades: [{ id: uuid(3), pacienteId: uuid(2), agendamentoId: uuid(8) }],
    economica: {
      oportunidades: [{ id: uuid(3), canal: 'site', status: 'convertida', orcamentoVinculadoId: uuid(4) }],
      orcamentos: [{ id: uuid(4), status: 'aprovado', valor: 1000, apresentadoEm: '2026-09-02T12:00:00Z', decididoEm: '2026-09-03T12:00:00Z' }],
      tratamentos: [{ id: uuid(5), status: 'concluido', orcamentoOrigemId: uuid(4) }],
      cobrancas: [{ id: uuid(6), pacienteNome: 'Cliente teste', status: 'pago', valor: 1000, valorPago: 125, pagoEm: '2026-09-04T12:00:00Z', vencimento: '2026-09-03', emCobrancaEm: null, tratamentoOrigemId: uuid(5) }],
      pedidos: [{ id: uuid(7), pacienteNome: 'Outro cliente', status: 'pago', valor: 20, pagamentoConfirmadoEm: '2026-09-05T12:00:00Z' }],
    },
  };
}

test('cadeia canônica completa: captura → oportunidade → orçamento → tratamento → cobrança', () => {
  const r = gerarRelatorioCampanhas(entrada());
  assert.equal(r.receitaAtribuidaCentavos, 12500); // nunca os 1000 do orçamento
  assert.equal(r.receitaNaoAtribuidaCentavos, 2000);
  assert.equal(r.linhas[0].leads, 1);
  assert.equal(r.linhas[0].clientes, 1);
  assert.equal(r.linhas[0].oportunidades, 1);
  assert.equal(r.linhas[0].orcamentos, 1);
  assert.equal(r.linhas[0].agendamentos, 1);
  assert.equal(r.linhas[0].conversoes, 1);
  assert.deepEqual(r.pagamentos[0].trilha.map(t => t.etapa), ['oportunidade', 'orcamento', 'tratamento', 'cobranca']);
});
test('pedido pago pode ser atribuído somente com vínculo explícito', () => {
  const e = entrada(); e.vinculos.push(vinculo('pedido', uuid(7)));
  const r = gerarRelatorioCampanhas(e);
  assert.equal(r.receitaAtribuidaCentavos, 14500);
  assert.equal(r.linhas[0].pedidos, 1);
  assert.equal(r.linhas[0].conversoes, 2);
});
test('orçamento aprovado/pedido criado/agendamento não viram dinheiro', () => {
  const e = entrada(); e.economica.cobrancas[0].status = 'pendente'; e.economica.pedidos[0].status = 'criado';
  const r = gerarRelatorioCampanhas(e);
  assert.equal(r.receitaAtribuidaCentavos, 0); assert.equal(r.pagamentos.length, 0);
});
test('mesmo cliente em várias capturas nunca recebe toda receita vitalícia', () => {
  const e = entrada(); e.vinculos = []; e.origens.push(origem(uuid(10)));
  const r = gerarRelatorioCampanhas(e);
  assert.equal(r.receitaAtribuidaCentavos, 0);
  assert.equal(r.receitaNaoAtribuidaCentavos, 14500);
});
test('replay de eventos e do pagamento não multiplica receita', () => {
  const e = entrada(); e.vinculos.push(vinculo()); e.economica.cobrancas.push(e.economica.cobrancas[0]);
  assert.equal(gerarRelatorioCampanhas(e).receitaAtribuidaCentavos, 12500);
});
test('origens conflitantes permanecem incertas, mesmo quando campanha coincide', () => {
  const e = entrada(); e.origens.push(origem(uuid(10))); e.vinculos.push(vinculo('cobranca', uuid(6), uuid(10)));
  const r = gerarRelatorioCampanhas(e);
  assert.equal(r.receitaAtribuidaCentavos, 0); assert.match(r.pagamentos[0].motivo, /conflitantes/);
});
test('pagamento anterior à captura não é atribuído', () => {
  const e = entrada(); e.origens[0].capturadoEm = '2026-09-10T12:00:00Z';
  assert.equal(gerarRelatorioCampanhas(e).receitaAtribuidaCentavos, 0);
});
test('data inválida/valor inválido falham fechado; zero real permanece zero', () => {
  const e = entrada(); e.economica.cobrancas[0].pagoEm = 'invalido';
  assert.equal(gerarRelatorioCampanhas(e).receitaAtribuidaCentavos, 0);
  e.economica.cobrancas[0].pagoEm = '2026-09-04T12:00:00Z'; e.economica.cobrancas[0].valorPago = NaN;
  assert.equal(gerarRelatorioCampanhas(e).pagamentos[0].valorCentavos, null);
  e.economica.cobrancas[0].valorPago = 0;
  assert.equal(gerarRelatorioCampanhas(e).pagamentos[0].valorCentavos, 0);
});
test('captura sem marcação permanece não atribuída mesmo com vínculo', () => {
  const e = entrada(); e.origens = [origem(uuid(1), '')];
  assert.equal(gerarRelatorioCampanhas(e).receitaAtribuidaCentavos, 0);
});
test('identificadores conflitantes na mesma captura não recebem receita', () => {
  const e = entrada(); e.origens = [origem(uuid(1), 'gclid=x&fbclid=y&utm_campaign=ambigua')];
  const r = gerarRelatorioCampanhas(e);
  assert.equal(r.receitaAtribuidaCentavos, 0);
  assert.match(r.pagamentos[0].motivo, /plataforma conflitantes/);
});
test('campanhas distintas não se misturam e custo ausente não produz CAC/ROAS', () => {
  const e = entrada(); e.origens.push(origem(uuid(10), 'utm_source=meta&utm_medium=paid_social&utm_campaign=b'));
  e.vinculos.push(vinculo('pedido', uuid(7), uuid(10)));
  const r = gerarRelatorioCampanhas(e);
  assert.deepEqual(r.linhas.map(l => l.receitaCentavos), [12500, 2000]);
  assert.ok(r.linhas.every(l => l.cac === null && l.roas === null));
});
test('visita isolada não vira lead e referência inexistente não cria entidade', () => {
  const e = entrada(); e.origens[0].pacienteId = null; e.vinculos = [vinculo('pedido', uuid(99))];
  const r = gerarRelatorioCampanhas(e);
  assert.equal(r.linhas[0].leads, 0); assert.equal(r.capturasSemVinculo, 1);
});
test('fbclid isolado não prova Ads; marcação paga é distinta; conflito não escolhe plataforma', () => {
  assert.equal(classificarOrigem(origem(uuid(1), 'fbclid=x')), 'referencia');
  assert.equal(classificarOrigem(origem(uuid(1), 'fbclid=x&utm_source=meta&utm_medium=paid_social')), 'meta_ads');
  assert.equal(classificarOrigem(origem(uuid(1), 'gclid=x&fbclid=y')), 'campanha_utm');
});
test('contrato captura somente identificadores conhecidos com tamanho limitado, sem token', () => {
  const ids = capturarIdentificadoresAds(new URLSearchParams(`utm_id=123&ad_id=456&gbraid=g&access_token=segredo&adset_id=${'x'.repeat(900)}`));
  assert.equal(ids.campaign_id, '123'); assert.equal(ids.ad_id, '456'); assert.equal(ids.adset_id.length, 200);
  assert.ok(!('access_token' in ids)); assert.ok(CONEXOES_ADS_V1.every(c => c.estado === 'nao_configurada'));
});

// Adaptador de banco em memória: executa as funções reais de persistência,
// isolamento e replay sem carregar cliente real, credenciais ou rede.
function banco({ origemTenant = 'a', entidadeTenant = 'a', insertError = null, replayOrigem = uuid(1) } = {}) {
  const chamadas = [];
  return { chamadas, from(tabela) {
    const filtros = {}; let inserindo = false;
    const q = {
      select() { return q; }, eq(k,v) { filtros[k] = v; return q; },
      insert(payload) { inserindo = true; chamadas.push({ tabela, payload }); return q; },
      maybeSingle() { return q; },
      then(resolve) {
        chamadas.push({ tabela, filtros: { ...filtros } });
        if (inserindo) return Promise.resolve(resolve({ error: insertError }));
        let data = null;
        if (tabela === 'origem_captacoes' && filtros.clinica_id === origemTenant) data = { id: uuid(1) };
        if (tabela === 'oportunidades_demanda' && filtros.clinica_id === entidadeTenant) data = { id: uuid(3) };
        if (tabela === 'eventos_dominio') data = { payload: { origemId: replayOrigem } };
        return Promise.resolve(resolve({ data, error: null }));
      },
    }; return q;
  } };
}
test('tenant cruzado na origem ou entidade é recusado antes de INSERT', async () => {
  for (const opt of [{ origemTenant: 'b' }, { entidadeTenant: 'b' }]) {
    const db = banco(opt); const r = await registrarVinculoAtribuicao(db, 'a', vinculo(), uuid(8));
    assert.equal(r.status, 404); assert.ok(!db.chamadas.some(c => c.payload));
  }
});
test('evento usa chave determinística, autoria e evidência', async () => {
  const db = banco(); const r = await registrarVinculoAtribuicao(db, 'a', vinculo(), uuid(8));
  assert.equal(r.status, 201);
  const e = db.chamadas.find(c => c.payload).payload;
  assert.equal(e.clinica_id, 'a'); assert.equal(e.tipo, 'atribuicao.vinculo');
  assert.equal(e.chave_idempotencia, `atribuicao.vinculo:v1:oportunidade:${uuid(3)}`);
  assert.equal(e.payload.usuarioId, uuid(8));
});
test('replay da mesma origem retorna sucesso; outra origem não sobrescreve', async () => {
  assert.equal((await registrarVinculoAtribuicao(banco({ insertError: { code: '23505' } }), 'a', vinculo(), null)).status, 200);
  assert.equal((await registrarVinculoAtribuicao(banco({ insertError: { code: '23505' }, replayOrigem: uuid(99) }), 'a', vinculo(), null)).status, 409);
});
test('falha de INSERT é visível e evidência vazia é rejeitada', async () => {
  assert.equal((await registrarVinculoAtribuicao(banco({ insertError: { code: 'XX' } }), 'a', vinculo(), null)).status, 503);
  assert.equal((await registrarVinculoAtribuicao(banco(), 'a', { ...vinculo(), evidencia: '' }, null)).status, 400);
});
test('código público inexistente/outro tenant nunca vincula; ausência não cria evento', async () => {
  const db = banco({ origemTenant: 'b' });
  assert.equal(await vincularOrigemPublica(db, 'a', 'abcdefghij', 'oportunidade', uuid(3)), false);
  assert.equal(await vincularOrigemPublica(db, 'a', null, 'oportunidade', uuid(3)), false);
  assert.ok(!db.chamadas.some(c => c.payload));
});
test('código público válido vincula à entidade criada sem fabricar cliente', async () => {
  const db = banco(); assert.equal(await vincularOrigemPublica(db, 'a', 'abcdefghij', 'oportunidade', uuid(3)), true);
  assert.equal(db.chamadas.find(c => c.payload).payload.payload.metodo, 'codigo_site');
});
test('leitura pagina mais de 500 registros e filtra tenant em cada página', async () => {
  const filtros = []; let inicio;
  const db = { from() { const q = { select() { return q; }, eq(k,v) { filtros.push([k,v]); return q; }, order() { return q; }, range(a) { inicio = a; return q; }, then(fn) { return Promise.resolve(fn({ data: inicio === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: i })) : [{ id: 500 }], error: null })); } }; return q; } };
  assert.equal((await lerFonteAtribuicao(db, 'a', 'pedidos', 'id')).length, 501);
  assert.deepEqual(filtros, [['clinica_id','a'], ['clinica_id','a']]);
});
test('falha de fonte não vira zero no relatório', async () => {
  const db = { from() { const q = { select() { return q; }, eq() { return q; }, order() { return q; }, range() { return q; }, then(fn) { return Promise.resolve(fn({ data: null, error: { code: '42P01' } })); } }; return q; } };
  await assert.rejects(carregarRelatorioAtribuicao(db, 'a'), /SCHEMA_PENDENTE/);
});
