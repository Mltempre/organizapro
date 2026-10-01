/* eslint-disable @typescript-eslint/no-require-imports -- Harness CommonJS usa Module._extensions para executar TSX localmente sem build ou serviços. */
// Dashboard real (/dashboard → CasaDashboard) após a Limpeza GO 1 (2026-10-01):
// "Precisa da sua atenção" virou RESUMO (total + 1ª prioridade + acesso ao
// Gerente Comercial, dono da lista completa — a deduplicação agregado × cards
// de cliente continua acontecendo em app/dashboard/page.tsx, antes do resumo).
// A contagem operacional da Agenda de hoje e a contagem de orçamentos (que diz
// explicitamente o que conta) permanecem na Casa.
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

test('confirmação pendente: detalhes por cliente saíram da Casa (ficam no Gerente Comercial); contagem operacional permanece', async () => {
  const { html } = await carregar({ rows: { 0: agendaPendente }, counts: { 3: 2, 5: 2 } });
  // Resumo curto + acesso ao Gerente Comercial: no máximo a 1ª prioridade
  // renderiza (título); a lista de casos por cliente não existe mais aqui.
  assert.match(html, /prioridades? identificadas?/);
  assert.match(html, /href="\/copiloto">Abrir Gerente Comercial/);
  assert.ok((html.match(/Confirmar presença agora/g) || []).length <= 1, 'no máximo a 1ª prioridade pode aparecer (resumo)');
  // A agenda de hoje continua mostrando a contagem operacional.
  assert.match(html, /2 aguardando confirmação/);
});

test('reativação: agregado não renderiza; no máximo a 1ª prioridade (resumo) — nunca a lista de clientes', async () => {
  const { html } = await carregar({ rows: { 8: semProximo }, counts: { 3: 2, 4: 2, 5: 1 } });
  assert.match(html, /prioridades? identificadas?/);
  assert.match(html, /A lista completa está no Gerente Comercial\./);
  // O motivo/agregado nunca renderiza; e nunca os DOIS clientes (seria lista).
  assert.doesNotMatch(html, /clientes sem próximo compromisso agendado/);
  assert.ok(!(html.includes('Caio Teste') && html.includes('Duda Teste')), 'lista de clientes não pode renderizar na Casa');
});

test('cobertura parcial: motivo do agregado não renderiza na Casa (detalhe só no Gerente Comercial)', async () => {
  const { html } = await carregar({ rows: { 8: semProximo }, counts: { 3: 9, 4: 5, 5: 1 } });
  assert.match(html, /prioridades? identificadas?/);
  assert.doesNotMatch(html, /clientes sem próximo compromisso agendado/);
});

test('atrasados sem desfecho: a Casa mantém o alerta operacional na Agenda de hoje', async () => {
  const atrasados = [{ id: 'at1', hora: '08:00:00', paciente_nome: 'Eva Teste', tipo_consulta: null, status: 'agendado', data: '2020-01-01' }];
  const { html } = await carregar({ rows: { 2: atrasados }, counts: { 3: 1, 5: 1 } });
  assert.match(html, /Revisar até 1 compromisso\(s\) anteriores sem conclusão/);
  assert.match(html, /href="\/agendamentos\?filtro=historico"/);
});

test('orçamentos: total apresentado diz o que conta; parados viram só o total em risco (detalhe na Receita Perdida)', async () => {
  const orcamentos = [
    { id: 'o1', paciente_nome: 'Recente', telefone: null, procedimento: 'Serviço', valor: 100, apresentado_em: new Date().toISOString() },
    { id: 'o2', paciente_nome: 'Antigo', telefone: null, procedimento: 'Serviço', valor: 500, apresentado_em: '2020-01-01T12:00:00Z' },
  ];
  const { html } = await carregar({ apiRows: { orcamentos } });
  assert.match(html, /2 orçamento\(s\) apresentado\(s\) aguardando resposta \(todos, inclusive os enviados há menos de 3 dias\)/);
  // O breakdown por categoria saiu da Casa; o orçamento parado aparece só no total em risco.
  assert.doesNotMatch(html, /Orçamentos parados \(sem resposta há 3\+ dias\)/);
  assert.match(html, /Em risco:/);
  assert.match(html, /500,00/);
  assert.doesNotMatch(html, />Orçamentos sem resposta</);
});
