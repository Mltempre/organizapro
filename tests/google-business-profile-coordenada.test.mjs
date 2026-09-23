import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture, request, Request, parent, review} from './helpers/gbp-fixture.mjs';
const api = f=>f.load('lib/google-business-profile-api.ts');
const handlers = f=>f.load('lib/google-business-profile-handlers.ts');
const oauth = f=>f.load('lib/google-business-profile-oauth.ts');
const cookieName='google_business_oauth_session';
const body = (extra={})=>({clinica_id:'tenant-a',texto:'Obrigado',idempotency_key:'key-one',review_name:review.name,...extra});
async function start(f){return oauth(f).iniciarGoogle(request({clinica_id:'tenant-a'}));}
function callback(s, overrides={}) {
  const state=new URL(s.body.url).searchParams.get('state');
  return new Request('https://fixture.test/api/google-business-profile/oauth/callback?code=fixture-code&state='+encodeURIComponent(state),
    {cookies:{[cookieName]:s.cookies.values.get(cookieName).value},...overrides});
}
test('OAuth POST Bearer -> cookie cifrado -> callback sem Bearer revalida usuário/tenant e conecta',async()=>{
  const f=fixture(),s=await start(f);
  assert.equal(s.status,200); assert.ok(!s.body.url.includes('fixture-session'));
  const cookie=s.cookies.values.get(cookieName);
  assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'lax');assert.equal(cookie.maxAge,600);
  assert.ok(!cookie.value.includes('fixture-session'));
  const r=await oauth(f).concluirGoogle(callback(s));
  assert.equal(new URL(r.location).searchParams.get('status'),'connected');
  assert.equal(r.cookies.values.get(cookieName).maxAge,0);
  assert.equal(f.saved[0].clinica_id,'tenant-a');assert.equal(f.saved[0].google_location_name,'locations/L');
  assert.notEqual(f.saved[0].refresh_token_ciphertext,'fixture-refresh');
  assert.ok(f.queries.filter(q=>q.table==='clinica_usuarios').length>=2);
  await oauth(f).concluirGoogle(callback(s));
  assert.equal(f.calls.filter(c=>c.url.includes('/token')).length,1,'nonce replay cannot exchange twice');
});
test('OAuth inicia somente autenticado, tenant ativo e Origin correto',async()=>{
  for(const opts of [{member:false},{product:'outro'},{user:null}]) {
    const f=fixture(opts),r=await start(f); assert.ok(r.status>=400);assert.equal(f.calls.length,0);
  }
  const f=fixture();
  assert.equal((await oauth(f).iniciarGoogle(request({clinica_id:'tenant-a'},{headers:{}}))).status,401);
  assert.equal((await oauth(f).iniciarGoogle(request({clinica_id:'tenant-a'},{headers:{Origin:'https://foreign.test'}}))).status,400);
});
test('callback rejeita cookie ausente/adulterado, usuário trocado e vínculo revogado',async()=>{
  for(const kind of ['missing','tampered','user','member']) {
    const f=fixture(),s=await start(f);
    if(kind==='user')f.settings.user='user-b';if(kind==='member')f.settings.member=false;
    const r=await oauth(f).concluirGoogle(callback(s,kind==='missing'?{cookies:{}}:kind==='tampered'?{cookies:{[cookieName]:'bad'}}:{}));
    assert.equal(new URL(r.location).searchParams.get('status'),'oauth');assert.equal(f.calls.length,0);
  }
});
test('state rejeita expiração exata, assinatura Unicode e segmentos extras sem lançar',()=>{
  const h=fixture().load('lib/google-business-profile.ts'),state=h.criarEstadoGoogle('a','u','s',100);
  assert.equal(h.validarEstadoGoogle(state,'s',700),null);
  assert.equal(h.validarEstadoGoogle(state+'.extra','s',100),null);
  assert.equal(h.validarEstadoGoogle(state.split('.')[0]+'.'+'é'.repeat(43),'s',100),null);
});
test('callback sem contas/locais nunca grava conexão nem declara connected',async()=>{
  for(const field of ['accounts','locations']) {
    const f=fixture({fetch:({url})=>url.includes(field==='accounts'?'/v1/accounts':'/locations')?{[field]:[]}:undefined});
    const s=await start(f),r=await oauth(f).concluirGoogle(callback(s));
    assert.equal(new URL(r.location).searchParams.get('status'),'sem_local');assert.equal(f.saved.length,0);
  }
});
test('OAuth erro externo não reflete descrição na URL nem logs',async()=>{
  const f=fixture(),s=await start(f),req=callback(s);req.nextUrl.searchParams.set('error','denied');req.nextUrl.searchParams.set('error_description','fixture-sensitive');
  const r=await oauth(f).concluirGoogle(req);assert.ok(r.location.endsWith('status=denied'));
  assert.ok(!JSON.stringify(f.logs).includes('fixture-sensitive'));assert.equal(f.calls.length,0);
});
test('canônico aceita v1 e legado v4 do mesmo account; rejeita account estrangeiro/traversal',()=>{
  const h=fixture().load('lib/google-business-profile-resources.ts');
  assert.equal(h.recursoGoogle('accounts/A','locations/L').parent,parent);
  assert.equal(h.recursoGoogle('accounts/A',parent).location,'locations/L');
  for(const location of ['accounts/B/locations/L','locations/../B','locations/L?x=1'])assert.throws(()=>h.recursoGoogle('accounts/A',location));
});
test('v4 reviews/posts usam account+location; performance usa somente locations/L',async()=>{
  const f=fixture(),a=api(f);
  await a.buscarAvaliacoesGoogle('fixture',parent);await a.publicarPostGoogle('fixture',parent,'Exemplo');
  await a.buscarMetricasGoogle('fixture','locations/L',[],'2026-01-01','2026-01-02');
  assert.ok(f.calls[0].url.includes('/v4/'+parent+'/reviews'));assert.ok(f.calls[1].url.endsWith('/v4/'+parent+'/localPosts'));
  assert.ok(f.calls[2].url.includes('/v1/locations/L:'));await assert.rejects(a.buscarAvaliacoesGoogle('fixture','locations/L'));
});
for(const [field,fn,args] of [['accounts','listarContasGoogle',[]],['locations','listarLocalizacoesGoogle',['accounts/A']],['reviews','buscarAvaliacoesGoogle',[parent]]]) {
  test(`paginação completa ${field}, preservando pageToken na segunda página`,async()=>{
    const f=fixture({fetch:({url})=>{const second=new URL(url).searchParams.get('pageToken')==='p2';
      const item=field==='reviews'?{...review,reviewId:second?'R2':'R',name:parent+'/reviews/'+(second?'R2':'R')}:{name:(field==='accounts'?'accounts/':'locations/')+(second?'B':'A')};
      return {[field]:[item],...(second?{}:{nextPageToken:'p2'})};}});
    assert.equal((await api(f)[fn]('fixture',...args)).length,2);assert.equal(f.calls.length,2);
  });
}
test('paginação falha fechada com token repetido, inválido e limite 100; sem lista parcial',async()=>{
  for(const token of ['repeat',42,null,'bad\nvalue','x'.repeat(2049)]) {
    const f=fixture({fetch:()=>({accounts:[],nextPageToken:token})});
    await assert.rejects(api(f).listarContasGoogle('fixture'),e=>e.codigo==='PAGINACAO');assert.ok(f.calls.length<=2);
  }
  const f=fixture({fetch:(_,i)=>({accounts:[],nextPageToken:'p'+i})});
  await assert.rejects(api(f).listarContasGoogle('fixture'),e=>e.codigo==='PAGINACAO');assert.equal(f.calls.length,100);
});
test('cross-tenant/foreign review_name não autoriza leitura da avaliação nem publicação',async()=>{
  for(const extra of [{clinica_id:'tenant-b'},{review_name:'accounts/B/locations/B/reviews/R'},{review_name:parent+'/reviews/other'}]) {
    const f=fixture(),r=await handlers(f).escreverGoogle(request(body(extra)),'resposta','R');
    assert.equal(r.status,403);assert.equal(f.calls.filter(c=>c.url.includes('/reviews')).length,0);assert.equal(f.events.length,0);
  }
});
test('localização não pertence mais à conta: bloqueia drafts/posts/respostas antes da escrita',async()=>{
  for(const type of ['rascunho','resposta','post']) {
    const f=fixture({fetch:({url})=>url.includes('/locations?')?{locations:[{name:'locations/foreign'}]}:undefined});
    const r=await handlers(f).escreverGoogle(request(body()),type,'R');assert.equal(r.status,403);
    assert.equal(f.calls.filter(c=>c.init.method==='PUT'||c.url.endsWith('/localPosts')).length,0);
  }
});
test('review retornado com id/name divergente e review já respondido falham fechados',async()=>{
  for(const patch of [{reviewId:'other'},{name:'accounts/B/locations/B/reviews/R'},{reviewReply:{comment:'Respondido'}}]) {
    const f=fixture({fetch:({url})=>url.endsWith('/reviews/R')?{...review,...patch}:undefined});
    const r=await handlers(f).escreverGoogle(request(body()),'resposta','R');assert.ok(r.status>=400);
    assert.equal(f.calls.filter(c=>c.init.method==='PUT').length,0);assert.equal(f.events.length,0);
  }
});
test('conexão ausente difere de falha DB, token revogado, configuração ausente e upstream indisponível',async()=>{
  const cases=[[{disconnected:true},200,'desconectado'],[{dbError:true},503,'indisponivel'],
    [{env:{GOOGLE_BUSINESS_PROFILE_TOKEN_KEY:''}},503,'erro_configuracao'],
    [{fetch:()=>({http:400,body:{error:'invalid_grant'}})},409,'renovacao_necessaria'],
    [{fetch:()=>({http:503,body:{error_description:'fixture-sensitive'}})},503,'indisponivel']];
  for(const [opts,status,state] of cases){const f=fixture(opts),r=await handlers(f).lerGoogle(request(),'status');
    assert.equal(r.status,status);assert.equal(r.body.estado,state);assert.notEqual(r.body.conectado,true);}
});
test('erros upstream preservam código/status e ocultam payload/segredos em resposta e log',async()=>{
  const f=fixture({fetch:()=>({http:403,body:{error_description:'fixture-sensitive',error:{message:'fixture-sensitive'}}})});
  const r=await handlers(f).lerGoogle(request(),'status');assert.equal(r.body.codigo,'GOOGLE');
  assert.ok(!JSON.stringify([r.body,f.logs]).includes('fixture-sensitive'));assert.equal(f.logs[0][1].httpGoogle,403);
});
test('publicação confirmada: retry mesma chave retorna resultado, uma escrita e um evento com UUID',async()=>{
  const f=fixture();for(let i=0;i<2;i++)assert.equal((await handlers(f).escreverGoogle(request(body()),'resposta','R')).body.sucesso,true);
  assert.equal(f.calls.filter(c=>c.init.method==='PUT').length,1);assert.equal(f.events.length,1);
  assert.match(f.events[0].p_entidade,/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
});
test('mesma chave com outro texto conflita; nova chave permite novo rascunho',async()=>{
  const f=fixture();assert.equal((await handlers(f).escreverGoogle(request(body()),'rascunho','R')).status,200);
  assert.equal((await handlers(f).escreverGoogle(request(body({texto:'Editado'})),'rascunho','R')).body.codigo,'CONFLITO');
  assert.equal((await handlers(f).escreverGoogle(request(body({texto:'Editado',idempotency_key:'two'})),'rascunho','R')).status,200);
  assert.equal(f.events.length,2);assert.equal(f.calls.filter(c=>c.init.method==='PUT').length,0);
});
test('falha definida antes/sobre escrita permite retry legítimo sem sucesso/evento falso',async()=>{
  let failed=true;const f=fixture({fetch:({init})=>init.method==='PUT'&&failed?{http:403,body:{}}:undefined});
  assert.ok((await handlers(f).escreverGoogle(request(body()),'resposta','R')).status>=400);assert.equal(f.events.length,0);
  failed=false;assert.equal((await handlers(f).escreverGoogle(request(body()),'resposta','R')).status,200);assert.equal(f.events.length,1);
});
test('timeout/5xx na escrita bloqueia retry mesma/outra chave, sem declarar publicação',async()=>{
  for(const kind of ['timeout','server']) {
    const f=fixture({fetch:({init})=>{if(init.method==='PUT'){if(kind==='timeout')throw new Error('fixture-sensitive');return {http:500,body:{}};}}});
    for(const key of ['key-one','key-one','new-key']) {
      const r=await handlers(f).escreverGoogle(request(body({idempotency_key:key})),'resposta','R');
      assert.equal(r.body.codigo,'PENDENTE');assert.equal(r.body.sucesso,false);assert.equal(r.body.manterChave,true);
    }
    assert.equal(f.calls.filter(c=>c.init.method==='PUT').length,1);assert.equal(f.events.length,0);
  }
});
test('Google confirmou mas persistência falhou: pendente preservado, nenhum retry externo',async()=>{
  const f=fixture({finishError:true});
  assert.equal((await handlers(f).escreverGoogle(request(body()),'post')).body.codigo,'PERSISTENCIA');
  f.settings.finishError=false;
  assert.equal((await handlers(f).escreverGoogle(request(body()),'post')).body.codigo,'PENDENTE');
  assert.equal(f.calls.filter(c=>c.url.endsWith('/localPosts')).length,1);assert.equal(f.events.length,0);
});
test('HTTP 200 sem confirmação do texto não vira sucesso nem permite repetir escrita',async()=>{
  const f=fixture({fetch:({init})=>init.method==='PUT'?{comment:'Outro texto'}:undefined});
  for(let i=0;i<2;i++)assert.equal((await handlers(f).escreverGoogle(request(body()),'resposta','R')).body.codigo,'PENDENTE');
  assert.equal(f.calls.filter(c=>c.init.method==='PUT').length,1);assert.equal(f.events.length,0);
});
test('concorrência: reserva impede duas escritas do mesmo recurso',async()=>{
  const f=fixture();const results=await Promise.all(['one','two'].map(key=>handlers(f).escreverGoogle(request(body({idempotency_key:key})),'resposta','R')));
  assert.equal(results.filter(r=>r.body.sucesso).length,1);assert.equal(f.calls.filter(c=>c.init.method==='PUT').length,1);
});
test('RPC ausente falha antes de publicação; listagem não oculta falha da persistência de rascunhos',async()=>{
  const f=fixture({rpcError:true});assert.equal((await handlers(f).escreverGoogle(request(body()),'post')).body.codigo,'PERSISTENCIA');
  assert.equal(f.calls.filter(c=>c.url.endsWith('/localPosts')).length,0);
  const g=fixture({eventsError:true});assert.equal((await handlers(g).lerGoogle(request(),'avaliacoes')).body.codigo,'PERSISTENCIA');
});
test('DELETE escopa tenant; GET associa rascunho ao resource estável e Google prevalece',async()=>{
  const f=fixture();await handlers(f).escreverGoogle(request(body()),'rascunho','R');
  let r=await handlers(f).lerGoogle(request(),'avaliacoes');assert.equal(r.body.avaliacoes[0].estado,'resposta_preparada');
  f.settings.fetch=({url})=>url.endsWith('/reviews')?{reviews:[{...review,reviewReply:{comment:'Real'}}]}:undefined;
  r=await handlers(f).lerGoogle(request(),'avaliacoes');assert.equal(r.body.avaliacoes[0].estado,'respondida');assert.equal(r.body.avaliacoes[0].rascunhoLocal,null);
  await handlers(f).lerGoogle(request(),'desconectar');assert.ok(f.queries.some(q=>q.action==='delete'&&q.filters.some(([k,v])=>k==='clinica_id'&&v==='tenant-a')));
});
test('SQL pendente fora do runner: reserva única, finalização atômica, service_role e nenhum reclaim por tempo',()=>{
  const sql=fs.readFileSync(new URL('../sql/gbp-pendente/gbp-operacoes-v1.sql',import.meta.url),'utf8');
  assert.match(sql,/primary key \(clinica_id, operacao, chave\)/);assert.match(sql,/where estado in \('pendente','incerto'\)/);
  assert.match(sql,/for update/);assert.match(sql,/enable row level security/);assert.match(sql,/from public,anon,authenticated/);
  assert.match(sql,/insert into public.eventos_dominio/);assert.doesNotMatch(sql,/interval\s*'/i);
});
