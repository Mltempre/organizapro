import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dir = process.env.CONVERGENCIA_BUILD_DIR;
if (!dir) throw new Error('CONVERGENCIA_BUILD_DIR não definido');
const load = name => import(pathToFileURL(path.join(dir, `${name}.js`)));
const { coordenarGerenteComercial } = await load('gerente-comercial');
const { adaptarOportunidadesClientes, adaptarOportunidadesDemanda, gerarEstadoComercialCanonico } = await load('nucleo-inteligente');
const { gerarOportunidadesClientes } = await load('oportunidades-clientes');
const { agregarReceitaPerdida } = await load('receita-perdida');
const { gerarCasosAgendaAutonoma } = await load('agenda-autonoma');

const entrada = {
  hoje: '2026-09-23', agora: '2026-09-23T12:00:00Z',
  clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: [],
  orcamentosParados: [{ id: 'orc-1', pacienteNome: 'Ana', telefone: '11911112222', procedimento: 'Serviço', valor: 250, apresentadoEm: '2026-09-01T12:00:00Z' }],
  cobrancasAtrasadas: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [], oportunidadesAbertas: [], recomprasPossiveis: [],
};
const sinais = adaptarOportunidadesClientes(gerarOportunidadesClientes(entrada));
const receita = agregarReceitaPerdida(entrada);

test('motores reais → sinal → impacto e ação governada, sem alterar a origem', () => {
  const antes = structuredClone(sinais);
  const [r] = coordenarGerenteComercial(sinais, receita);
  assert.equal(r.impacto.valor, 250);
  assert.equal(r.destinoAcao, '/follow-up');
  assert.equal(r.sinal.destino, '/orcamentos');
  assert.equal(r.sinal.entidadeId, 'orc-1');
  assert.equal(r.sinal.contexto.nome, 'Ana');
  assert.ok(r.sinal.motivo && r.sinal.evidencia && r.sinal.acaoSugerida);
  assert.deepEqual(sinais, antes);
});

test('preserva exatamente ordem e deduplicação do núcleo canônico', () => {
  const outros = [...sinais, ...sinais, { ...sinais[0], id: 'baixa', chaveDedup: 'b', prioridade: 'baixa' }];
  assert.deepEqual(coordenarGerenteComercial(outros, receita).map(r => r.sinal), gerarEstadoComercialCanonico(outros).sinais);
});

test('não liga dinheiro por cliente nem por id de outro domínio', () => {
  const r = coordenarGerenteComercial(sinais, { ...receita, itens: [
    { ...receita.itens[0], id: 'outro', valor: 900 },
    { ...receita.itens[0], origem: 'cobranca_atrasada', valor: 1000 },
  ] });
  assert.equal(r[0].impacto.valor, null);
});

test('valor ausente, inválido e zero são tratados sem estimativa inventada', () => {
  for (const valor of [null, undefined, NaN, Infinity, -1]) {
    assert.equal(coordenarGerenteComercial(sinais, { ...receita, itens: [{ ...receita.itens[0], valor }] })[0].impacto.valor, null);
  }
  assert.equal(coordenarGerenteComercial(sinais, { ...receita, itens: [{ ...receita.itens[0], valor: 0 }] })[0].impacto.valor, 0);
  assert.equal(coordenarGerenteComercial(sinais, null)[0].impacto.valor, null);
});

test('valor do tratamento continua explicitamente estimado', () => {
  const [r] = coordenarGerenteComercial([{ ...sinais[0], tipo: 'tratamento_sem_retorno' }], { ...receita, itens: [{ ...receita.itens[0], origem: 'tratamento_sem_retorno' }] });
  assert.match(r.impacto.descricao, /estimado/);
});

test('Agenda Autônoma fornece destino operacional do cliente sem compromisso', () => {
  const cliente = { id: 'cli-1', nome: 'Bia', telefone: null, whatsapp: null, proximaConsulta: null };
  const agenda = gerarCasosAgendaAutonoma({ hoje: entrada.hoje, cancelamentosRecentes: [], telefonesComReagendamentoFuturo: new Set(), agendaHoje: [], clientesAtivos: [cliente] });
  const s = adaptarOportunidadesClientes(gerarOportunidadesClientes({ ...entrada, orcamentosParados: [], clientesSemProximoCompromisso: [cliente] }));
  assert.equal(coordenarGerenteComercial(s, null, agenda)[0].destinoAcao, '/agendamentos');
});

test('oportunidade mantém origem real, confiança e rota do orçamento existente', () => {
  const s = adaptarOportunidadesDemanda([{ id: 'op-1', canal: 'site', telefone: '11911112222', nome_informado: 'Ana', status: 'sinalizada', confianca_classificacao: 'baixa', orcamento_vinculado_id: null }]);
  const [r] = coordenarGerenteComercial(s, receita);
  assert.match(r.sinal.motivo, /site/);
  assert.equal(r.sinal.confianca, 'baixa');
  assert.equal(r.sinal.prioridade, 'media');
  assert.equal(r.destinoAcao, '/oportunidades');
  assert.equal(r.impacto.valor, null);
});

test('não inventa destino nem pendência quando não há dados', () => {
  assert.deepEqual(coordenarGerenteComercial([], null), []);
  assert.equal(coordenarGerenteComercial([{ ...sinais[0], destinoAcao: undefined, destino: undefined }], null)[0].destinoAcao, null);
});

test('integração da tela preserva proveniência e não oculta falha como vazio', () => {
  const codigo = fs.readFileSync(new URL('../app/copiloto/page.tsx', import.meta.url), 'utf8');
  assert.match(codigo, /adaptarOportunidadesDemanda\(oportunidades\.map/);
  assert.match(codigo, /canal:\s*op\.canal/);
  assert.match(codigo, /confianca_classificacao:\s*op\.confianca_classificacao/);
  assert.match(codigo, /!estado.falhaParcial && totalItens === 0/);
  assert.match(codigo, /if \(erroFuturos\) throw erroFuturos/);
  assert.match(codigo, /setEstado\(null\)/);
  assert.match(codigo, /coordenarGerenteComercial\(sinais, receitaPerdida, casosAgenda\)/);
  assert.match(codigo, /router.push\(destinoAcao\)/);
});
