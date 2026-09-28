/* eslint-disable @typescript-eslint/no-require-imports -- Node local tests. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./helpers/site-harness.cjs');
const publicPage='app/empresa/[slug]/SiteEmpresaClient.tsx';
const editor='app/site/page.tsx';
const row={clinica_id:'tenant-a',nome:'Empresa TESTE LOCAL'};
const respond=(q)=>({data:q.name?row:[],error:null});
test('public: all eight content/config queries use resolved tenant and fixed product',async()=>{
 const h=harness(publicPage,{props:{slug:'slug-teste'},respond});await h.load();assert.match(h.html(),/Empresa TESTE LOCAL/);
 assert.deepEqual(h.queries[0].args,{p_slug:'slug-teste',p_produto:'organizapro'});
 assert.equal(h.queries.filter(q=>q.table).length,8);
 for(const q of h.queries.filter(q=>q.table))assert.ok(q.ops.some(op=>op[0]==='eq'&&op[1]==='clinica_id'&&op[2]==='tenant-a'));
});
test('public: empty data contains no broken CTAs, fake collections or service anchors',async()=>{
 const h=harness(publicPage,{props:{slug:'vazio'},respond});await h.load();const html=h.html();
 assert.doesNotMatch(html,/href="#"|href="#servicos"|id="equipe"|id="depoimentos"|id="faq"|id="galeria"|wa.me/);
});
for(const scenario of ['missing','empty-slug','rpc-error','network','content-error'])test('public: '+scenario+' settles honestly',async()=>{
 const h=harness(publicPage,{props:{slug:scenario==='empty-slug'?'':scenario},respond(q){if(scenario==='network')throw Error('offline');return {data:scenario==='missing'?null:q.name?row:[],error:scenario==='rpc-error'||(scenario==='content-error'&&q.table)?{message:'test'}:null};}});
 await h.load();assert.doesNotMatch(h.html(),/Carregando/);assert.match(h.html(),/missing|empty-slug/.test(scenario)?/Página não encontrada/:/temporariamente indisponível/);
});
test('public: stale slug response cannot replace new tenant',async()=>{
 let release;const old=new Promise(r=>release=r);
 const h=harness(publicPage,{props:{slug:'old'},respond:q=>q.name?(q.args.p_slug==='old'?old:{data:{...row,nome:'TENANT NOVO',clinica_id:'tenant-b'}}):{data:[]}});
 await h.load();await h.load({slug:'new'});release({data:{...row,nome:'TENANT ANTIGO'}});await h.settle();assert.match(h.html(),/TENANT NOVO/);assert.doesNotMatch(h.html(),/TENANT ANTIGO/);
});
test('public: real stored sections and before/after appear; paused services do not',async()=>{
 const data={clinica_servicos:[{id:'s',nome:'SERVICO TESTE',ordem:0},{id:'paused',nome:'PAUSADO',disponivel:false}],clinica_equipe:[{id:'e',nome:'EQUIPE TESTE'}],clinica_galeria:[{id:'g',url:'/test-g.png',titulo:'GALERIA TESTE'}],clinica_estrutura:[{id:'st',imagem_url:'/test-st.png',titulo:'ESTRUTURA TESTE'}],clinica_depoimentos:[{id:'d',nome:'CLIENTE TESTE',comentario:'DEPOIMENTO TESTE',nota:4}],clinica_faq:[{id:'f',pergunta:'FAQ TESTE?',resposta:'RESPOSTA TESTE'}],clinica_antes_depois:[{id:'a',titulo:'CASO TESTE',antes_url:'/antes.png',depois_url:'/depois.png'},{id:'incomplete',titulo:'INCOMPLETO',antes_url:null,depois_url:'/depois.png'}]};
 const h=harness(publicPage,{props:{slug:'completo'},respond:q=>({data:q.name?{...row,whatsapp:'5511999990000'}:data[q.table]})});await h.load();const html=h.html();
 for(const expected of ['SERVICO TESTE','EQUIPE TESTE','GALERIA TESTE','ESTRUTURA TESTE','DEPOIMENTO TESTE','FAQ TESTE','CASO TESTE','/antes.png','/depois.png','https://wa.me/5511999990000'])assert.ok(html.includes(expected),expected);
 assert.doesNotMatch(html,/PAUSADO|INCOMPLETO/);
});
test('public: only paused services never produce dangling navigation',async()=>{const h=harness(publicPage,{props:{slug:'paused'},respond:q=>({data:q.name?row:q.table==='clinica_servicos'?[{id:'s',nome:'Paused',disponivel:false}]:[]})});await h.load();assert.doesNotMatch(h.html(),/href="#servicos"/);});
function editorResponse(q){if(q.ops.some(op=>op[0]==='neq'))return {data:null};if(q.ops.some(op=>op[0]==='update'))return {data:{slug:'publicado'}};return {data:{slug:'publicado',user_id:'tenant-owner'}};}
test('editor: reads and updates active tenant without overwriting owner or upserting user',async()=>{
 const h=harness(editor,{respond:editorResponse});await h.load();const nav=h.find(n=>typeof n.props?.onPublish==='function');assert.equal(nav.props.siteUrl,'https://local.invalid/empresa/publicado');await nav.props.onPublish();
 const update=h.queries.find(q=>q.ops.some(op=>op[0]==='update'));assert.ok(update);assert.ok(update.ops.some(op=>op[0]==='eq'&&op[1]==='clinica_id'&&op[2]==='tenant-a'));assert.equal(update.ops.find(op=>op[0]==='update')[1].user_id,undefined);assert.ok(!h.queries.some(q=>q.ops.some(op=>op[0]==='upsert')));
});
test('editor: tenant resolution failure stops config reads and publication',async()=>{const h=harness(editor,{fetch:async()=>({ok:false})});await h.load();assert.equal(h.queries.length,0);const nav=h.find(n=>typeof n.props?.onPublish==='function');await nav.props.onPublish();assert.equal(h.queries.length,0);assert.match(h.html(),/Recarregue as configurações/);});
test('editor: slug lookup failure does not write business/config data',async()=>{const h=harness(editor,{respond:q=>q.ops.some(op=>op[0]==='neq')?{error:{message:'offline'}}:editorResponse(q)});await h.load();await h.find(n=>typeof n.props?.onPublish==='function').props.onPublish();assert.ok(!h.calls.some(c=>c.init?.method==='PUT'));assert.ok(!h.queries.some(q=>q.ops.some(op=>op[0]==='update'||op[0]==='insert')));});
test('workspace: explicitly unpublished URL never falls back to another config',async()=>{const h=harness('app/site/SiteWorkspaceNav.tsx',{props:{siteUrl:''}});await h.load();assert.equal(h.queries.length,0);assert.match(h.html(),/Configurar publicação/);});
test('workspace: published slug follows current tenant',async()=>{const h=harness('app/site/SiteWorkspaceNav.tsx',{respond:()=>({data:{slug:'publicado'}})});await h.load();assert.match(h.html(),/empresa\/publicado/);assert.ok(h.queries[0].ops.some(op=>op[1]==='clinica_id'&&op[2]==='tenant-a'));});
test('editor: failed initial config load cannot publish blank defaults',async()=>{const h=harness(editor,{respond:()=>({error:{message:'offline'}})});await h.load();const count=h.queries.length;await h.find(n=>typeof n.props?.onPublish==='function').props.onPublish();assert.equal(h.queries.length,count);assert.ok(!h.calls.some(c=>c.init?.method==='PUT'));assert.match(h.html(),/Recarregue as configurações/);});
test('public: failed optional module preserves available real content with a warning',async()=>{const h=harness(publicPage,{props:{slug:'partial'},respond:q=>({data:q.name?row:q.table==='clinica_servicos'?[{id:'s',nome:'SERVICO DISPONIVEL'}]:[],error:q.table==='clinica_antes_depois'?{message:'offline'}:null})});await h.load();assert.match(h.html(),/SERVICO DISPONIVEL/);assert.match(h.html(),/Parte do conteúdo está temporariamente indisponível/);});
test('gallery: all uploaded gallery and structure items remain visible beyond third/sixth',()=>{const {React}=require('./helpers/site-harness.cjs');const {renderToStaticMarkup}=require('react-dom/server');const Galeria=require('../app/empresa/[slug]/_components/Galeria.tsx').default;const {resolverFamilia}=require('../app/empresa/[slug]/_lib/families.ts');const html=renderToStaticMarkup(React.createElement(Galeria,{galeria:Array.from({length:7},(_,i)=>({id:String(i),url:'/test-'+i+'.png',titulo:'FOTO '+i})),estrutura:[{id:'structure',imagem_url:'/structure.png',titulo:'ESTRUTURA FINAL'}],empresa:{},tema:resolverFamilia('')}));assert.match(html,/FOTO 6/);assert.match(html,/ESTRUTURA FINAL/);assert.doesNotMatch(html,/gallery-photo--3[^}]*display:none/);});

// ── MODELO VISUAL DO CLIENTE: precedência ?modelo= válido → modelo salvo →
//    recomendação automática por segmento (Missão SITE PREMIUM / SLUG) ────────
const marcadorModelo={aurora:/aurora-nav/,vertice:/vertice-nav/,pulse:/pulse-nav/};
function respondModelo(saved,extras={}){return q=>{
 if(q.name)return {data:{...row,...extras},error:null};
 if(q.table==='clinica_config_publica'){
  if(saved==='erro-coluna')return {data:null,error:{message:'column "modelo" does not exist'}};
  return {data:{clinica_id:'tenant-a',...(saved?{modelo:saved}:{})},error:null};
 }
 return {data:[],error:null};
};}
function assertModelo(html,esperado){
 assert.match(html,marcadorModelo[esperado]);
 for(const outro of ['aurora','vertice','pulse'])if(outro!==esperado)assert.doesNotMatch(html,marcadorModelo[outro]);
}
test('A: modelo salvo Aurora é aplicado ao site publicado',async()=>{
 const h=harness(publicPage,{props:{slug:'salvo-aurora'},respond:respondModelo('aurora')});await h.load();
 const html=h.html();assertModelo(html,'aurora');assert.match(html,/Empresa TESTE LOCAL/);
 const cfg=h.queries.find(q=>q.table==='clinica_config_publica');assert.ok(cfg);
 assert.ok(cfg.ops.some(op=>op[0]==='eq'&&op[1]==='clinica_id'&&op[2]==='tenant-a'));
});
test('B: modelo salvo Vértice é aplicado ao site publicado',async()=>{
 const h=harness(publicPage,{props:{slug:'salvo-vertice'},respond:respondModelo('vertice')});await h.load();
 assertModelo(h.html(),'vertice');
});
test('C: modelo salvo Pulse é aplicado ao site publicado',async()=>{
 const h=harness(publicPage,{props:{slug:'salvo-pulse'},respond:respondModelo('pulse')});await h.load();
 assertModelo(h.html(),'pulse');
});
test('D: ?modelo= válido sobrepõe o modelo salvo do tenant',async()=>{
 const h=harness(publicPage,{props:{slug:'previa'},searchParams:'modelo=vertice',respond:respondModelo('aurora')});await h.load();
 assertModelo(h.html(),'vertice');
});
test('E: ?modelo= inválido não quebra e cai no comportamento seguro',async()=>{
 const salvo=harness(publicPage,{props:{slug:'invalido-salvo'},searchParams:'modelo=neon9000',respond:respondModelo('pulse')});await salvo.load();
 assertModelo(salvo.html(),'pulse');
 assert.doesNotMatch(salvo.html(),/Página não encontrada|Site temporariamente indisponível/);
 const sem=harness(publicPage,{props:{slug:'invalido-sem'},searchParams:'modelo=neon9000',respond:respondModelo(null,{especialidade:'Barbearia'})});await sem.load();
 assertModelo(sem.html(),'pulse');
});
test('F: tenant antigo sem modelo continua na recomendação automática por segmento',async()=>{
 const h=harness(publicPage,{props:{slug:'antigo'},respond:respondModelo(null,{especialidade:'Barbearia'})});await h.load();
 assertModelo(h.html(),'pulse');
 assert.doesNotMatch(h.html(),/Parte do conteúdo está temporariamente indisponível/);
});
test('F2: coluna modelo ainda não aplicada não quebra nem finge conteúdo parcial',async()=>{
 const h=harness(publicPage,{props:{slug:'sem-coluna'},respond:respondModelo('erro-coluna',{especialidade:'Barbearia'})});await h.load();
 assertModelo(h.html(),'pulse');
 assert.doesNotMatch(h.html(),/Parte do conteúdo está temporariamente indisponível/);
});
test('G: fixture não-barbearia (Oficina do Zé) continua renderizando corretamente',async()=>{
 const h=harness(publicPage,{props:{slug:'oficina'},respond:respondModelo(null,{nome:'Oficina do Zé',especialidade:'Oficina Mecânica'})});await h.load();
 const html=h.html();assert.match(html,/Oficina do Zé/);
 assertModelo(html,'vertice');
 assert.doesNotMatch(html,/Página não encontrada|Parte do conteúdo está temporariamente indisponível/);
});
test('editor: renders the three visual models and saves the allowlisted choice for the active tenant',async()=>{
 const h=harness(editor,{respond:editorResponse});await h.load();
 for(const id of ['aurora','vertice','pulse'])assert.ok(h.find(n=>n.props?.['data-modelo']===id),'card '+id);
 h.find(n=>n.props?.['data-modelo']==='pulse').props.onClick();
 await h.find(n=>n.props?.['data-testid']==='salvar-modelo').props.onClick();await h.settle();
 const upd=h.queries.find(q=>q.table==='clinica_config'&&q.ops.some(op=>op[0]==='update'&&op[1]&&typeof op[1]==='object'&&'modelo' in op[1]));
 assert.ok(upd,'update do modelo');
 assert.equal(upd.ops.find(op=>op[0]==='update')[1].modelo,'pulse');
 assert.ok(upd.ops.some(op=>op[0]==='eq'&&op[1]==='clinica_id'&&op[2]==='tenant-a'));
 assert.equal(upd.ops.find(op=>op[0]==='update')[1].user_id,undefined);
});
test('editor: stored value outside the allowlist never reaches the UI nor round-trips to the database',async()=>{
 const respond=q=>{
  if(q.ops.some(op=>op[0]==='neq'))return {data:null};
  const sel=q.ops.find(op=>op[0]==='select');
  if(q.table==='clinica_config'&&sel&&sel[1]==='modelo')return {data:{clinica_id:'tenant-a',modelo:'hacker'},error:null};
  if(q.ops.some(op=>op[0]==='update'))return {data:{slug:'publicado'}};
  return {data:{slug:'publicado',user_id:'tenant-owner'}};
 };
 const h=harness(editor,{respond});await h.load();
 assert.equal(h.find(n=>n.props?.['data-modelo']&&n.props['aria-pressed']===true),null);
 await h.find(n=>n.props?.['data-testid']==='salvar-modelo').props.onClick();await h.settle();
 const upd=h.queries.find(q=>q.ops.some(op=>op[0]==='update'&&op[1]&&typeof op[1]==='object'&&'modelo' in op[1]));
 assert.ok(upd);
 assert.equal(upd.ops.find(op=>op[0]==='update')[1].modelo,null);
});
test('editor: preview opens the chosen model via ?modelo= without touching the published site',async()=>{
 const h=harness(editor,{respond:editorResponse});await h.load();
 h.find(n=>n.props?.['data-modelo']==='vertice').props.onClick();
 h.find(n=>n.props?.['data-testid']==='previa-modelo').props.onClick();
 assert.deepEqual(h.opens,['https://local.invalid/empresa/publicado?modelo=vertice']);
 assert.ok(!h.queries.some(q=>q.ops.some(op=>op[0]==='update')),'prévia nunca grava nada');
});
