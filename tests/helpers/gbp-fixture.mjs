// Executes production TypeScript with an allowlisted loader. No real network/DB.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const ts = require('typescript');
export const parent = 'accounts/A/locations/L';
export const review = { reviewId: 'R', name: `${parent}/reviews/R`, starRating: 'FIVE', comment: 'Exemplo' };
export const env = { NODE_ENV: 'production', GOOGLE_BUSINESS_PROFILE_CLIENT_ID: 'fixture-client',
  GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET: 'fixture-client-secret', GOOGLE_BUSINESS_PROFILE_STATE_SECRET: 'fixture-state-secret',
  GOOGLE_BUSINESS_PROFILE_TOKEN_KEY: 'fixture-encryption-key' };
export class Request {
  constructor(url = 'https://fixture.test/api?clinica_id=tenant-a', options = {}) {
    this.url = url; this.nextUrl = new URL(url); this.headers = new Headers(options.headers);
    this.cookies = { get: key => options.cookies?.[key] ? { value: options.cookies[key] } : undefined };
    this.json = async () => options.body;
  }
}
export function request(body, options = {}) {
  return new Request(options.url, { headers: { Authorization: 'Bearer fixture-session' }, body, ...options });
}
function response(body, options = {}) {
  const values = new Map();
  return { body, status: options.status || 200, headers: new Headers(), cookies: { values, set: (k,v,o) => values.set(k, { value:v, ...o }) } };
}
export function fixture(options = {}) {
  const calls = [], queries = [], logs = [], rows = new Map(), events = [], saved = [];
  const settings = { member:true, product:'organizapro', user:'user-a', ...options };
  const cache = new Map();
  const db = {
    auth: { getUser: async token => ({ data:{ user:token === 'fixture-session' && settings.user ? {id:settings.user} : null }, error:null }) },
    from(table) {
      const q = {table, filters:[], action:'select'}; queries.push(q);
      const chain = {
        select(){ return chain; }, eq(k,v){q.filters.push([k,v]);return chain;}, order(){return chain;},
        delete(){q.action='delete';return chain;}, upsert(value){q.action='upsert';q.value=value;return chain;},
        maybeSingle(){return run();}, then(a,b){return run().then(a,b);},
      };
      async function run() {
        const tenant = q.filters.find(([k])=>k === 'clinica_id')?.[1];
        if (table === 'clinica_usuarios') return {data:settings.member && tenant === 'tenant-a' ? {clinica_id:tenant} : null};
        if (table === 'clinicas') return {data:{produto:settings.product}};
        if (table === 'google_business_profile_connections') {
          if (settings.dbError) return {error:{message:'fixture-sensitive-db'}};
          if(q.action === 'upsert'){saved.push(q.value); return {error:null};}
          if(q.action === 'delete') return {error:null};
          return {data:settings.disconnected ? null : { google_account_name:'accounts/A', google_location_name:'locations/L',
            refresh_token_ciphertext:load('lib/google-business-profile.ts').cifrarRefreshToken('fixture-refresh', env.GOOGLE_BUSINESS_PROFILE_TOKEN_KEY), ...settings.connection }};
        }
        if (table === 'eventos_dominio') return settings.eventsError ? {error:{}} : {data:events.map(e=>({entidade_id:e.p_entidade,payload:e.p_resultado}))};
        throw new Error('Unexpected table '+table);
      }
      return chain;
    },
    async rpc(name,p) {
      queries.push({rpc:name,...p});
      if(settings.rpcError) return {error:{message:'fixture-sensitive-rpc'}};
      const key = [p.p_clinica,p.p_operacao,p.p_chave].join(':');
      const row = rows.get(key);
      if(name === 'gbp_iniciar_operacao') {
        if(row && (row.hash !== p.p_hash || row.resource !== p.p_recurso)) return {data:{estado:'conflito'}};
        if(row?.state === 'sucesso') return {data:{estado:'sucesso',resultado:row.result}};
        if(row && (row.state !== 'falhou' || p.p_operacao === 'oauth')) return {data:{estado:'pendente'}};
        if([...rows.values()].some(r=>r.tenant===p.p_clinica && r.type===p.p_operacao && r.resource===p.p_recurso && ['pendente','incerto'].includes(r.state))) return {data:{estado:'pendente'}};
        const ticket = crypto.randomUUID();
        rows.set(key,{tenant:p.p_clinica,type:p.p_operacao,resource:p.p_recurso,hash:p.p_hash,state:'pendente',ticket});
        return {data:{estado:'adquirido',ticket}};
      }
      if(name !== 'gbp_finalizar_operacao') throw new Error('Unexpected RPC');
      if(settings.finishError) return {error:{}};
      if(!row || row.ticket !== p.p_ticket || row.state !== 'pendente') return {data:false};
      row.state=p.p_estado;row.result=p.p_resultado;
      if(p.p_estado==='sucesso' && p.p_operacao!=='oauth') events.push(p);
      return {data:true};
    },
  };
  async function fetchMock(url, init = {}) {
    const call = {url:String(url),init}; calls.push(call);
    let result = settings.fetch ? await settings.fetch(call, calls.length) : undefined;
    if(result === undefined) {
      const u = new URL(url);
      if(u.hostname === 'oauth2.googleapis.com') result = {access_token:'fixture-access',refresh_token:'fixture-refresh',scope:'https://www.googleapis.com/auth/business.manage'};
      else if(u.pathname === '/v1/accounts') result = {accounts:[{name:'accounts/A'}]};
      else if(u.pathname === '/v1/accounts/A/locations') result = {locations:[{name:'locations/L',title:'Exemplo'}]};
      else if(u.pathname.endsWith('/reviews/R/reply')) result = {comment:'Obrigado'};
      else if(u.pathname.endsWith('/reviews/R')) result = review;
      else if(u.pathname.endsWith('/reviews')) result = {reviews:[review]};
      else if(u.pathname.endsWith('/localPosts')) result = {name:parent+'/localPosts/P'};
      else if(u.pathname.includes(':fetchMultiDailyMetricsTimeSeries')) result = {};
      else throw new Error('Unexpected mock endpoint '+url);
    }
    return {ok:!result.http || result.http<400,status:result.http || 200,json:async()=>result.body ?? result};
  }
  function load(relative) {
    const file = path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)) throw new Error('Outside fixture root');
    if(cache.has(file)) return cache.get(file).exports;
    const loadedModule = {exports:{}};cache.set(file,loadedModule);
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    const localRequire = s => {
      if(s==='server-only')return {};
      if(s==='node:crypto')return crypto;
      if(s==='@supabase/supabase-js')return {createClient:()=>db};
      if(s==='next/server')return {NextRequest:Request,NextResponse:{json:response,redirect:url=>({...response(null),location:String(url)})}};
      if(s.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(file),s+'.ts')));
      throw new Error('Forbidden import '+s);
    };
    vm.runInNewContext(code,{module:loadedModule,exports:loadedModule.exports,require:localRequire,Buffer,URL,URLSearchParams,Headers,AbortController,setTimeout,clearTimeout,
      process:{env:{...env,...settings.env}},console:{error:(...v)=>logs.push(v)},fetch:fetchMock},{filename:file});
    return loadedModule.exports;
  }
  return {load,calls,queries,logs,rows,events,saved,settings,db};
}
