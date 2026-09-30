/* eslint-disable @typescript-eslint/no-require-imports -- Isolated security VM, no network. */
// Isolated audit of actual source. No network, real credentials, or database.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const ts = require(root + '/node_modules/typescript');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
function fixture(settings = {}) {
  const queries = [], network = [], clients = [], cache = new Map();
  const tables = { clinica_usuarios: [{usuario_id:'user-a',clinica_id:A,ativo:settings.active !== false,papel:'colaborador'}],
    clinicas: [{id:A,produto:settings.product || 'organizapro'}, {id:B,produto:'organizapro'}], ...settings.tables };
  const sessoes = { 'session-a':'user-a', ...settings.sessions };
  const db = { auth:{ getUser:async t => ({data:{user:sessoes[t]?{id:sessoes[t]}:null},error:null}) },
    from(table) { return query(table); }, rpc(name) { throw Error('Unexpected RPC ' + name); },
    storage:{from(){throw Error('Storage forbidden');},createBucket(){throw Error('Storage forbidden');}} };
  function query(table) {
    const q={table,action:'select',filters:[],single:false};queries.push(q);
    let chain;
    const methods={select(){return chain;},eq(k,v){q.filters.push([k,v]);return chain;},
      in(k,v){q.filters.push([k,v]);return chain;},insert(v){q.action='insert';q.value=v;return chain;},
      upsert(v){q.action='upsert';q.value=v;return chain;},update(v){q.action='update';q.value=v;return chain;},
      delete(){q.action='delete';return chain;},maybeSingle(){q.single=true;return run();},single(){q.single=true;return run();},
      then(a,b){return run().then(a,b);}};
    chain=new Proxy(methods,{get(o,k){return k in o?o[k]:()=>{return chain;};}});
    async function run() {
      if(settings.errorTable===table)return {data:null,error:{message:'LOCAL_DATABASE_ERROR'},count:0};
      const rows=(tables[table]||[]).filter(r=>q.filters.every(([k,v])=>Array.isArray(v)?v.includes(r[k]):r[k]===v));
      if(q.action==='update') { rows.forEach(r=>Object.assign(r,q.value)); }
      if(q.action==='insert'||q.action==='upsert')return {data:q.single?{id:ID,...q.value}:[{id:ID,...q.value}],error:null};
      return {data:q.single?rows[0]||null:rows,error:null,count:rows.length};
    }
    return chain;
  }
  const env={NEXT_PUBLIC_SUPABASE_URL:'https://audit.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-admin',INTERNAL_SERVICE_SECRET:'fixture-internal',CHATBOT_INTERNAL_SECRET:'fixture-chatbot',WEBHOOK_SECRET:'fixture-webhook',CRON_SECRET:'fixture-cron',GOOGLE_BUSINESS_PROFILE_CLIENT_ID:'fixture-client',GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET:'fixture-secret',GOOGLE_BUSINESS_PROFILE_STATE_SECRET:'fixture-state',GOOGLE_BUSINESS_PROFILE_TOKEN_KEY:'fixture-key'};
  function response(body,init={}){return {body,status:init.status||200,headers:new Headers(),cookies:{set(){}}};}
  function load(relative) {
    const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
    const mod={exports:{}};cache.set(file,mod);
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    const req=name=>{if(name==='server-only')return {};if(name==='@supabase/supabase-js')return {createClient:(_url,key)=>{clients.push(key);return db;}};
      if(name==='node:crypto'||name==='crypto')return crypto;
      if(name==='next/server')return {NextRequest:Request,NextResponse:{json:response,redirect:url=>response({redirect:String(url)},{status:307})},after:()=>{throw Error('Background job forbidden');}};
      if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(file),name+'.ts')));
      throw Error('Forbidden module: '+name);};
    vm.runInNewContext(code,{module:mod,exports:mod.exports,require:req,Buffer,URL,URLSearchParams,Headers,AbortController,setTimeout,clearTimeout,process:{env},
      console:{log(){},info(){},warn(){},error(){}},fetch:async(url,init)=>{network.push(String(url));if(settings.fetchStub)return settings.fetchStub(url,init);throw Error('NETWORK FORBIDDEN');}}, {filename:file});
    return mod.exports;
  }
  return {load,queries,network,clients,tables};
}

module.exports = { fixture, A, B };
