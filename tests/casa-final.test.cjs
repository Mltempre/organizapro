/* eslint-disable @typescript-eslint/no-require-imports -- Harness CommonJS usa Module._extensions para executar TSX localmente sem build ou serviços. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { carregar, render, Casa, React, root } = require('./helpers/casa-harness.cjs');

test('conta vazia: mensagem honesta, sem receita, sucesso fictício ou caixas de IA', async () => {
  const { html } = await carregar();
  assert.match(html, /Nenhuma cobrança registrada/);
  assert.match(html, /Nenhum compromisso ativo hoje/);
  assert.doesNotMatch(html, /R\$|operando normalmente|Consultoria do Dia|Diretor Digital|SinalCanonico|100%|Recursos Incluídos/);
});

for (const api of ['/api/orcamentos','/api/pedidos','/api/tratamentos','/api/cobrancas','/api/oportunidades']) {
  test(`HTTP indisponível ${api} não vira zero nem lista vazia`, async () => {
    const { html } = await carregar({ apiError: api });
    assert.match(html, /role="alert"/); assert.match(html, /Tentar novamente/);
    assert.doesNotMatch(html, /Nenhuma cobrança|Nenhuma prioridade|casa-dinheiro/);
  });
  test(`contrato inválido ${api} não vira vazio`, async () => assert.match((await carregar({ invalidBody: api })).html, /role="alert"/));
}
test('falha de rede não vira ausência de oportunidades', async () => assert.match((await carregar({ networkError: '/api/oportunidades' })).html, /role="alert"/));
for (let i=0; i<10; i++) test(`erro da consulta ${i} impede resumo enganoso`, async () => assert.match((await carregar({ queryError: i })).html, /role="alert"/));

test('tenant ausente impede consultas de negócio', async () => {
  const r = await carregar({ semTenant: true });
  assert.match(r.html, /Verifique seu acesso/); assert.equal(r.queries.length,0); assert.equal(r.calls.length,1);
});
test('usuário sem autenticação não consulta dados e redireciona', async () => {
  const r = await carregar({ semUsuario: true }); assert.deepEqual(r.redirects,['/login']); assert.equal(r.queries.length,0); assert.equal(r.calls.length,0);
});
test('sem sessão não consulta dados', async () => {
  const r = await carregar({ semSessao: true }); assert.deepEqual(r.redirects,['/login']); assert.equal(r.calls.length,0);
});
test('todas as consultas diretas filtram tenant e APIs recebem autenticação', async () => {
  const r = await carregar();
  assert.equal(r.queries.length,10);
  for (const q of r.queries) assert.ok(q.ops.some(op => op[0] === 'eq' && op[1] === 'clinica_id' && op[2] === 'tenant-teste'), q.table);
  for (const call of r.calls) assert.equal(call.init.headers.Authorization,'Bearer token-local-de-teste');
  for (const call of r.calls.filter(c => /orcamentos|pedidos|cobrancas|tratamentos/.test(c.url))) assert.match(call.url,/clinica_id=tenant-teste/);
  assert.ok(!r.calls.some(c=>c.url.includes('atividade-recente')));
});
test('reagendamento: consulta adicional mantém tenant e falha não fabrica cancelamento recuperável', async () => {
  const options = { rows: { 9: [{ id:'cancelado',paciente_nome:'Teste',telefone:'11999999999',data:'2026-09-20' }] }, queryError:10 };
  const r = await carregar(options); assert.match(r.html,/reagendamentos/);
  assert.ok(r.queries[10].ops.some(op=>op[0]==='eq' && op[1]==='clinica_id' && op[2]==='tenant-teste'));
});
test('orçamento recente aparece como aguardando resposta, não em risco', async () => {
  const r = await carregar({ apiRows: { orcamentos: [{id:'o1',paciente_nome:'Teste',telefone:null,procedimento:'Serviço',valor:500,apresentado_em:new Date().toISOString()}] } });
  assert.match(r.html,/1 orçamento\(s\) apresentado\(s\) aguardando resposta/);
  assert.equal(r.element.props.receitaPerdida.itens.length,0);
  assert.doesNotMatch(r.html,/R\$/);
});
test('dinheiro em risco reutiliza predicado real sem virar receita recebida', async () => {
  const r = await carregar({ apiRows: { orcamentos: [{id:'o1',paciente_nome:'Teste',telefone:null,procedimento:'Serviço',valor:500,apresentado_em:'2020-01-01T12:00:00Z'}] } });
  assert.equal(r.element.props.receitaPerdida.itens[0].valor,500);
  assert.match(r.html,/500,00/); assert.doesNotMatch(r.html,/Recebido no mês/);
});
test('prioridades não repetem sinais entre resumo e expansão; destino de ação prevalece', async () => {
  const { element } = await carregar();
  const signals = Array.from({length:4},(_,i)=>({ id:`s${i}`,titulo:`Prioridade única ${i}`,prioridade:'alta',motivo:'Motivo registrado',evidencia:'Registro de teste',acaoSugerida:'Revisar',destino:'/orcamentos',destinoAcao:'/follow-up',contexto:{nome:'Cliente',telefone:'11999999999'} }));
  const html = render(React.createElement(Casa,{...element.props,temDados:true,missaoDoDia:signals.slice(0,3),outrasPrioridades:signals.slice(3)}));
  for (let i=0;i<4;i++) assert.equal(html.split(`Prioridade única ${i}`).length-1,1);
  assert.match(html,/<details/); assert.equal((html.match(/href="\/follow-up"/g)||[]).length,4);
  assert.doesNotMatch(html,/wa.me|Tempo estimado|Diretor Digital/);
});
test('links estáticos renderizados apontam para páginas existentes e ações novo=1 têm consumidores', async () => {
  const { html } = await carregar();
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(hrefs.length>=10);
  for (const href of hrefs) assert.ok(fs.existsSync(path.join(root,'app',href.split('?')[0],'page.tsx')),href);
  for (const page of ['clientes','agendamentos']) assert.match(fs.readFileSync(path.join(root,'app',page,'page.tsx'),'utf8'),/get\('novo'\) === '1'\) abrirNovo\(\)/);
});
test('agenda exclui cancelados e faltas, mantém status e contexto de histórico', async () => {
  const {element} = await carregar();
  const html=render(React.createElement(Casa,{...element.props,agendaHoje:[{id:'a',hora:'09:30',paciente_nome:'Cliente ativo',status:'confirmado'},{id:'b',hora:'10:00',paciente_nome:'Cliente cancelado',status:'cancelado'}],indicadores:{...element.props.indicadores,atrasados:20}}));
  assert.match(html,/Cliente ativo/);assert.doesNotMatch(html,/Cliente cancelado/);assert.match(html,/href="\/agendamentos\?filtro=historico"/);
});

test('Tentar novamente recupera a Casa depois da falha, sem manter o estado de erro', async () => {
  const options={apiError:'/api/cobrancas'};
  const r=await carregar(options);
  options.apiError=undefined;
  await r.element.props.children.props.children[2].props.onClick();
  const html=render(r.page());
  assert.doesNotMatch(html,/role="alert"/);
  assert.match(html,/Nenhuma cobrança registrada/);
});
