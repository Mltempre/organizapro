/* eslint-disable @typescript-eslint/no-require-imports -- Harness CommonJS usa Module._extensions para executar TSX localmente sem build ou serviços. */
// Dashboard real (/dashboard → CasaDashboard): o mesmo fato não aparece duas
// vezes em "Precisa da sua atenção" (agregado × cards de cliente), e os dois
// números de orçamento dizem explicitamente o que contam.
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./helpers/casa-harness.cjs');

const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
// Índices das consultas diretas da Casa: 0 agenda de hoje · 3 total de clientes
// · 4 clientes para reativar (contagem) · 5 total de compromissos · 8 clientes
// sem próximo compromisso (lista).
const agendaPendente = [
  { id: 'ag1', hora: '09:00:00', paciente_nome: 'Ana Teste', telefone: '11911110001', status: 'agendado', data: hoje },
  { id: 'ag2', hora: '10:00:00', paciente_nome: 'Bia Teste', telefone: '11911110002', status: 'agendado', data: hoje },
];
const semProximo = [
  { id: 'c1', nome: 'Caio Teste', telefone: '11922220001', whatsapp: null, proxima_consulta: null },
  { id: 'c2', nome: 'Duda Teste', telefone: '11922220002', whatsapp: null, proxima_consulta: null },
];

test('confirmação pendente: só os cards por cliente, sem o agregado "sem confirmação"', async () => {
  const { html } = await carregar({ rows: { 0: agendaPendente }, counts: { 3: 2, 5: 2 } });
  assert.match(html, /Ana Teste/); assert.match(html, /Bia Teste/);
  assert.equal((html.match(/Confirmar presença agora/g) || []).length >= 2, true);
  assert.doesNotMatch(html, /ainda sem confirmação/);
  // A agenda de hoje continua mostrando a contagem operacional.
  assert.match(html, /2 aguardando confirmação/);
});

test('reativação coberta pelos cards: agregado sai, clientes nomeados ficam', async () => {
  const { html } = await carregar({ rows: { 8: semProximo }, counts: { 3: 2, 4: 2, 5: 1 } });
  assert.match(html, /Caio Teste/); assert.match(html, /Duda Teste/);
  assert.doesNotMatch(html, /sem nenhuma movimentação recente/);
});

test('cobertura parcial: agregado permanece porque informa casos sem card', async () => {
  const { html } = await carregar({ rows: { 8: semProximo }, counts: { 3: 9, 4: 5, 5: 1 } });
  assert.match(html, /Caio Teste/);
  assert.match(html, /sem nenhuma movimentação recente/);
  assert.match(html, /5 clientes sem próximo compromisso agendado/);
});

test('fatos sem card equivalente continuam no agregado (atrasados)', async () => {
  const atrasados = [{ id: 'at1', hora: '08:00:00', paciente_nome: 'Eva Teste', tipo_consulta: null, status: 'agendado', data: '2020-01-01' }];
  const { html } = await carregar({ rows: { 2: atrasados }, counts: { 3: 1, 5: 1 } });
  assert.match(html, /compromisso em atraso/);
});

test('orçamentos: total apresentado e parados dizem o que contam', async () => {
  const orcamentos = [
    { id: 'o1', paciente_nome: 'Recente', telefone: null, procedimento: 'Serviço', valor: 100, apresentado_em: new Date().toISOString() },
    { id: 'o2', paciente_nome: 'Antigo', telefone: null, procedimento: 'Serviço', valor: 500, apresentado_em: '2020-01-01T12:00:00Z' },
  ];
  const { html } = await carregar({ apiRows: { orcamentos } });
  assert.match(html, /2 orçamento\(s\) apresentado\(s\) aguardando resposta \(todos, inclusive os enviados há menos de 3 dias\)/);
  assert.match(html, /Orçamentos parados \(sem resposta há 3\+ dias\)/);
  assert.doesNotMatch(html, />Orçamentos sem resposta</);
});
