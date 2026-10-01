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

test('valor da venda em execução nunca é apresentado como receita confirmada', () => {
  const [r] = coordenarGerenteComercial([{ ...sinais[0], tipo: 'tratamento_sem_retorno' }], { ...receita, itens: [{ ...receita.itens[0], origem: 'tratamento_sem_retorno' }] });
  assert.match(r.impacto.descricao, /venda em execução/);
  assert.match(r.impacto.descricao, /não é receita confirmada/);
});

test('Agenda Autônoma fornece destino operacional do cliente sem compromisso', () => {
  const cliente = { id: 'cli-1', nome: 'Bia', telefone: null, whatsapp: null, proximaConsulta: null };
  const agenda = gerarCasosAgendaAutonoma({ hoje: entrada.hoje, cancelamentosRecentes: [], telefonesComReagendamentoFuturo: new Set(), agendaHoje: [], clientesAtivos: [cliente] });
  const s = adaptarOportunidadesClientes(gerarOportunidadesClientes({ ...entrada, orcamentosParados: [], clientesSemProximoCompromisso: [cliente] }));
  // KENSA: sem compromisso não há item a localizar — a ação abre o formulário de novo compromisso da Agenda.
  assert.equal(coordenarGerenteComercial(s, null, agenda)[0].destinoAcao, '/agendamentos?novo=1');
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

test('KENSA: "Ver cliente" abre o Cliente 360 só com id real de paciente; "Abrir ação" de novo horário abre o formulário da Agenda', () => {
  const uuid = '11111111-2222-4333-8444-555555555555';
  const base = { ...entrada, orcamentosParados: [] };
  const real = adaptarOportunidadesClientes(gerarOportunidadesClientes({ ...base,
    clientesSemProximoCompromisso: [{ id: uuid, nome: 'Bia', telefone: '11911113333', whatsapp: null, proximaConsulta: null }] }));
  assert.equal(real[0].destino, `/clientes/${uuid}`);
  assert.equal(real[0].destinoLabel, 'Ver cliente');
  const sintetico = adaptarOportunidadesClientes(gerarOportunidadesClientes({ ...base,
    clientesSemProximoCompromisso: [{ id: 'demo-cliente-carla', nome: 'Carla', telefone: '11911114444', whatsapp: null, proximaConsulta: null }] }));
  assert.equal(sintetico[0].destino, '/clientes', 'sem identificação segura nunca inventa o 360');
  const casos = gerarCasosAgendaAutonoma({ hoje: '2026-09-23', cancelamentosRecentes: [], telefonesComReagendamentoFuturo: new Set(), agendaHoje: [],
    clientesAtivos: [{ id: uuid, nome: 'Bia', telefone: '11911113333', whatsapp: null, proximaConsulta: null }] });
  const [atencao] = coordenarGerenteComercial(real, null, casos);
  assert.equal(atencao.destinoAcao, '/agendamentos?novo=1');
});

// Revisão do núcleo econômico (2026-09-29): na tela do Gerente Comercial AI,
// "Acompanhamentos identificados" repetia as mesmas entidades já listadas em
// "Prioridades comerciais" (mesmo destino, /follow-up). A tela agora omite o
// caso de Follow-up cuja entidade já é uma prioridade. Este teste prova, com
// os motores REAIS, que as chaves usadas pelo filtro coincidem.
test('Gerente: acompanhamento já priorizado não se repete; segundo caso do mesmo cliente continua visível', async () => {
  const { gerarFollowUpsComerciais } = await load('follow-up-comercial');
  const { organizarSinaisCanonicos } = await load('nucleo-inteligente');
  const op = { id: 'op-9', canal: 'whatsapp', telefone: '(11) 93333-4444', nome_informado: 'Caio', status: 'sinalizada', confianca_classificacao: 'alta', orcamento_vinculado_id: null };
  const tratamento = { id: 'trat-1', pacienteNome: 'Ana', telefone: '11911112222', tipoTratamento: 'Instalação', status: 'em_andamento', proximaDataPrevista: null, updatedAt: '2026-08-01T12:00:00Z', interrompidoEm: null };
  const radar = { ...entrada, tratamentosSemRetorno: [tratamento] }; // Ana: orçamento parado + serviço sem retorno
  const sinaisTela = organizarSinaisCanonicos([
    ...adaptarOportunidadesClientes(gerarOportunidadesClientes(radar)),
    ...adaptarOportunidadesDemanda([op]),
  ]);
  const casos = gerarFollowUpsComerciais({
    hoje: entrada.hoje, agora: entrada.agora, entidadesComTentativaHoje: new Set(),
    oportunidadesParadas: [{ id: op.id, telefone: op.telefone, pacienteNome: 'Caio', status: op.status, orcamentoVinculadoId: null, ultimaInteracaoEm: '2026-08-01T12:00:00Z' }],
    orcamentosParados: entrada.orcamentosParados, tratamentosSemRetorno: [tratamento],
    pedidosNaoConcluidos: [], recomprasPossiveis: [], cobrancasAtrasadas: [], casosAgendaAutonoma: [],
  }).filter(f => f.donoDoFluxo === 'follow-up');
  assert.deepEqual(casos.map(c => c.tipo).sort(), ['oportunidade_parada', 'orcamento_parado', 'tratamento_sem_retorno']);
  // Mesma expressão de app/copiloto/page.tsx.
  const jaPriorizados = new Set(sinaisTela.flatMap(s => [
    s.entidadeId,
    s.tipo === 'interesse_sem_orcamento' ? (s.contexto?.telefone || '').replace(/\D/g, '') : undefined,
  ]).filter(k => !!k));
  const visiveis = casos.filter(f => !jaPriorizados.has(f.entidadeId));
  // Oportunidade e orçamento já são prioridade; o serviço sem retorno de Ana
  // não é (o núcleo mostra um sinal principal por cliente) e continua listado.
  assert.deepEqual(visiveis.map(c => c.tipo), ['tratamento_sem_retorno']);
  const pagina = fs.readFileSync(new URL('../app/copiloto/page.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(pagina.includes("s.tipo === 'interesse_sem_orcamento' ? (s.contexto?.telefone || '').replace(/\\D/g, '') : undefined,"), 'mesma chave de oportunidade na tela');
  assert.match(pagina, /followUps\.filter\(f => f\.donoDoFluxo === 'follow-up' && !jaPriorizados\.has\(f\.entidadeId\)\)/);
});

test('Núcleo econômico: valor em risco é "registrado" (inclui estimativa e proposta), nunca "comprovado"; plural "itens"', () => {
  const ler = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  for (const f of ['app/copiloto/page.tsx', 'app/financeiro/page.tsx', 'app/receita-perdida/page.tsx']) {
    assert.doesNotMatch(ler(f), /com valor comprovado/, f);
    assert.match(ler(f), /'item' : 'itens'\} com valor registrado/, f);
  }
  assert.doesNotMatch(ler('app/copiloto/page.tsx'), /item\{[^}]*\? 's' : ''\}/, 'sem "items"');
});
