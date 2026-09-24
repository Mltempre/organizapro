// Production TS loader with a strict import allowlist; never uses live network/DB.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const tenant = '11111111-1111-4111-8111-111111111111';
export const resource = '22222222-2222-4222-8222-222222222222';
export const phone = '5511999990000';
export function request(body, token = 'session', url = 'https://fixture.test/api') {
  return {url, nextUrl:new URL(url), method:'POST', headers:new Headers({authorization:`Bearer ${token}`}), json:async()=>body};
}
export function fixture(options = {}) {
 const settings={member:true,product:'organizapro',...options};
 const rows=new Map(), calls=[], queries=[], logs=[], jobs=[];
 const env={NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-admin',
  INTERNAL_SERVICE_SECRET:'internal',CHATBOT_INTERNAL_SECRET:'chatbot',WEBHOOK_SECRET:'webhook',CRON_SECRET:'cron',OPENAI_API_KEY:'fixture-ai',...settings.env};
 const db={auth:{getUser:async t=>({data:{user:t==='session'?{id:'user'}:null}})},from(table){
  const q={table,filters:[],action:'select',single:false};queries.push(q);
  const chain={select(){return chain;},eq(k,v){q.filters.push([k,v]);return chain;},ilike(k,v){q.filters.push([k,v]);return chain;},
   not(){return chain;},or(){return chain;},gte(){return chain;},lt(){return chain;},order(){return chain;},limit(){return chain;},
   insert(v){q.action='insert';q.value=v;return chain;},update(v){q.action='update';q.value=v;return chain;},upsert(v){q.action='upsert';q.value=v;return chain;},
   delete(){q.action='delete';return chain;},
   maybeSingle(){q.single=true;return run();},single(){q.single=true;return run();},then(a,b){return run().then(a,b);}};
  const get=k=>q.filters.find(f=>f[0]===k)?.[1];
  const matches=r=>q.filters.every(([k,v])=>(k.startsWith('payload->>')?r.payload?.[k.slice(10)]:r[k])===v);
  async function run(){
   if(settings.fechamento){
    if(settings.readError===table && q.action==='select')return {data:null,error:{code:'XX000'}};
    if(table==='pacientes')return {data:settings.missingClient?null:{id:resource,nome:'Fixture',telefone:phone}};
    if(table==='fechamento_tipos_documento')return {data:[{nome:'Extrato',obrigatorio:true,ativo:true}]};
    if(table==='fechamento_excecoes_cliente')return {data:[]};
    if(table==='fechamento_documentos')return {data:settings.resolved?[{cliente_id:resource,tipo_documento:'Extrato',status:'recebido'}]:[]};
    if(table==='eventos_dominio' && q.action==='insert' && settings.eventError && q.value.tipo==='fechamento.cobranca_envio')return {error:{code:'XX000'}};
    if(table==='eventos_dominio' && q.action==='select' && get('chave_idempotencia')?.includes('fechamento.cobranca_tentativa:'))return {data:settings.noAttempt?null:{id:'prepared'}};
   }
   if(table==='clinicas')return {data:{produto:settings.product,nome:'Fixture'}};
   if(table==='clinica_usuarios')return {data:settings.member?(q.single?{clinica_id:tenant}:[{clinica_id:tenant}]):(q.single?null:[])};
   if(table==='clinica_config'){
    const config={clinica_id:tenant,user_id:'user',telefone:phone,zapi_instance:'fixture-instance',zapi_token:'fixture-token',zapi_client_token:'fixture-client',nome_clinica:'Fixture',link_google:'https://fixture.test'};
    return {data:q.single?config:[config]};
   }
   if(table==='orcamentos')return {data:{id:resource,paciente_nome:'Fixture',telefone:phone,procedimento:'Fixture',valor:100,apresentado_em:'2020-01-01T00:00:00Z'}};
   if(table==='cobrancas')return {data:{id:resource,clinica_id:tenant,status:'pendente',vencimento:'2020-01-01',valor:100,descricao:'Fixture',paciente_nome:'Fixture',paciente_telefone:phone}};
   if(table==='agendamentos')return {data:q.single?null:[{id:resource,clinica_id:tenant,paciente_nome:'Fixture',telefone:phone,data:'2026-09-23',hora:'10:00'}],count:1};
   if(table==='chatbot_config')return {data:{ativo:false}};
   if(table==='eventos_dominio'){
    if(q.action==='insert'){
     if(settings.insertError)return {error:{code:'XX000',message:'SENSITIVE_SENTINEL'}};
     if(settings.finishError&&q.value.tipo==='seguranca.operacao_resultado')return {error:{code:'XX000'}};
     const id=q.value.id??crypto.randomUUID();
     if(rows.has(id))return {error:{code:'23505'}};
     rows.set(id,{...q.value,id});return {data:null,error:null};
    }
    // Espelha o trigger real append-only (BEFORE UPDATE/DELETE, inclusive service role).
    if(['update','delete','upsert'].includes(q.action))return {data:null,error:{code:'P0001',message:'eventos_dominio é append-only'}};
    if(get('tipo')==='whatsapp.consentimento')return settings.consentError?{error:{}}:{data:settings.blocked?[{payload:{estado:'bloqueado'},criado_em:new Date().toISOString()}]:[]};
    if(get('chave_idempotencia')?.includes('.tentativa:'))return {data:{id:'prepared'}};
    const result=[...rows.values()].filter(matches);return {data:q.single?result[0]??null:result,error:null};
   }
   if(['whatsapp_logs','chatbot_logs','avaliacoes','pacientes','chatbot_leads','origem_captacoes'].includes(table))return {data:q.single?null:[],error:null};
   throw Error('Unmocked table '+table);
  }return chain;
 }};
 const cache=new Map();
 const response=(body,opts={})=>({body,status:opts.status??200});
 function load(relative){
  let file=path.resolve(settings.sourceRoot??root,relative);if(!fs.existsSync(file)&&file.endsWith('.ts'))file=file.slice(0,-3)+'/index.ts';if(cache.has(file))return cache.get(file).exports;
  const loadedModule={exports:{}};cache.set(file,loadedModule);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  function localRequire(name){
   if(name==='server-only')return {};
   if(name==='node:crypto')return crypto;
   if(name==='@supabase/supabase-js')return {createClient:()=>db};
   if(name==='next/server')return {NextResponse:{json:response},after:job=>jobs.push(job)};
   if(name.startsWith('.'))return load(path.relative(settings.sourceRoot??root,path.resolve(path.dirname(file),name+'.ts')));
   throw Error('Forbidden import '+name);
  }
  async function fetchMock(url,init){
   calls.push({url:String(url),init});
   if(settings.routeInternal && new URL(url).pathname==='/api/whatsapp'){
    const r=await load('app/api/whatsapp/route.ts').POST(request(JSON.parse(init.body),'internal'));
    return {ok:r.status>=200&&r.status<300,status:r.status,json:async()=>r.body};
   }
   if(settings.networkError)throw Error('SENSITIVE_SENTINEL');
   const status=settings.httpStatus??200;
   const body=settings.httpBody??{sucesso:true,choices:[{message:{content:'fixture'}}]};
   return {ok:status>=200&&status<300,status,json:async()=>body,text:async()=>JSON.stringify(body)};
  }
  vm.runInNewContext(code,{module:loadedModule,exports:loadedModule.exports,require:localRequire,Buffer,URL,URLSearchParams,Headers,AbortController,setTimeout,clearTimeout,
   process:{env},fetch:fetchMock,console:Object.fromEntries(['log','warn','error','info'].map(k=>[k,(...args)=>logs.push(args)]))},{filename:file});
  return loadedModule.exports;
 }
 return {load,db,settings,rows,calls,queries,logs,jobs,env};
}
