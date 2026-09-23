/* eslint-disable @typescript-eslint/no-require-imports -- Reutiliza o harness local CommonJS da Casa. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar, root } = require('./helpers/casa-harness.cjs');
const { gerarResumoFechamento } = require(root + '/lib/fechamento-contabil.ts');
const competencia = new Date().toLocaleDateString('en-CA', { timeZone:'America/Sao_Paulo' }).slice(0,7);
const tipos = [{nome:'Extrato',ativo:true,obrigatorio:true}];
const resumo = (clientes=[],documentos=[]) => gerarResumoFechamento(competencia,clientes,tipos,documentos);

test('sem configuração ou tipos ativos a vertical não ocupa a Casa nem busca resumo',async()=>{
 for(const fechamentoTipos of [[],[{...tipos[0],ativo:false}]]){
  const r=await carregar({fechamentoTipos});
  assert.doesNotMatch(r.html,/Fechamento contábil|Ver fechamentos/);
  assert.ok(!r.calls.some(c=>c.url.startsWith('/api/fechamento?')));
 }
});
test('card usa os totais retornados pelo motor existente e contexto da competência',async()=>{
 const clientes=Array.from({length:6},(_,i)=>({id:String(i),nome:'Cliente '+i}));
 const documentos=['recebido','recebido','pendente','invalido','revisao_necessaria','pendente'].map((status,i)=>({clienteId:String(i),tipoDocumento:'Extrato',status}));
 const esperado=resumo(clientes,documentos);
 const r=await carregar({fechamentoTipos:tipos,fechamentoResumo:esperado});
 assert.deepEqual(r.element.props.fechamento.resumo,esperado);
 for(const [label,value] of [['Prontos',2],['Pendentes',2],['Bloqueados',1],['Em revisão',1]])assert.ok(r.html.includes(`<dt>${label}</dt><dd>${value}</dd>`));
 assert.match(r.html,/href="\/fechamento-contabil"/);
 assert.ok(r.html.includes(competencia.split('-').reverse().join('/')));
 for(const c of r.calls.filter(c=>c.url.startsWith('/api/fechamento'))){
  assert.equal(new URL(c.url,'https://local.invalid').searchParams.get('clinica_id'),'tenant-teste');
  assert.equal(c.init.headers.Authorization,'Bearer token-local-de-teste');
 }
 const url=new URL(r.calls.find(c=>c.url.startsWith('/api/fechamento?')).url,'https://local.invalid');
 assert.equal(url.searchParams.get('competencia'),competencia);
});
test('configurado sem clientes mostra vazio útil em vez de contagens inventadas',async()=>{
 const r=await carregar({fechamentoTipos:tipos,fechamentoResumo:resumo()});
 assert.match(r.html,/Nenhum cliente ativo/);assert.match(r.html,/Ver fechamentos/);assert.doesNotMatch(r.html,/<dt>Prontos/);
});
test('sem documentos registrados os clientes são pendentes reais, revisão zero fica oculta',async()=>{
 const r=await carregar({fechamentoTipos:tipos,fechamentoResumo:resumo([{id:'a',nome:'A'}])});
 assert.match(r.html,/<dt>Pendentes<\/dt><dd>1<\/dd>/);assert.doesNotMatch(r.html,/<dt>Em revisão/);
});
test('sem documentos obrigatórios mostra instrução de configuração',async()=>{
 const r=await carregar({fechamentoTipos:[{...tipos[0],obrigatorio:false}],fechamentoResumo:gerarResumoFechamento(competencia,[{id:'a',nome:'A'}],[],[])});
 assert.match(r.html,/Nenhum documento obrigatório definido/);assert.doesNotMatch(r.html,/<dt>Prontos/);
});
for(const route of ['/api/fechamento/tipos','/api/fechamento']){
 for(const failure of ['apiError','networkError','invalidBody'])test(`${failure} ${route}: aviso discreto, sem zerar totais ou bloquear a Casa`,async()=>{
  const r=await carregar({fechamentoTipos:tipos,fechamentoResumo:resumo(),[failure]:route});
  assert.match(r.html,/Resumo do fechamento contábil indisponível/);
  assert.match(r.html,/id="casa-dinheiro"/);assert.doesNotMatch(r.html,/<dt>Prontos|role="alert"/);
 });
}
test('resumo inválido ou de outra competência nunca é mostrado como real',async()=>{
 for(const fechamentoResumo of [{...resumo(),competencia:'1900-01'},{...resumo(),prontos:-1},{...resumo(),emRevisao:undefined}]){
  assert.match((await carregar({fechamentoTipos:tipos,fechamentoResumo})).html,/Resumo do fechamento contábil indisponível/);
 }
});
test('sem tenant ou sessão não consulta a vertical',async()=>{
 for(const options of [{semTenant:true},{semSessao:true},{semUsuario:true}]){
  const r=await carregar(options);assert.ok(!r.calls.some(c=>c.url.startsWith('/api/fechamento')));
 }
});
