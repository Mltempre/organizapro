import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture, request, tenant, resource } from './helpers/p1-fixture.mjs';

const path='app/api/fechamento/cobranca/aprovar-envio/route.ts';
const approval=(key='a',competencia='2026-09')=>request({clinica_id:tenant,cliente_id:resource,competencia,idempotency_key:key});
const setup=(options={})=>fixture({fechamento:true,routeInternal:true,...options});
const providerCalls=f=>f.calls.filter(c=>c.url.startsWith('https://api.z-api.io/'));

test('Contador atravessa o adaptador real e duas aprovações enviam uma única vez',async()=>{
 const f=setup(),route=f.load(path);
 const r=await Promise.all([route.POST(approval('a')),route.POST(approval('b'))]);
 assert.equal(r.filter(x=>x.status===200).length,1);assert.equal(providerCalls(f).length,1);
 const body=JSON.parse(f.calls[0].init.body);
 assert.match(body.operacao,new RegExp(`^fechamento:${resource}:2026-09:`));
 assert.equal((await route.POST(approval('c'))).status,409);assert.equal(providerCalls(f).length,1);
});
for(const options of [{member:false},{missingClient:true},{blocked:true},{consentError:true},{noAttempt:true},{resolved:true},{insertError:true},{readError:'fechamento_documentos'},{readError:'fechamento_tipos_documento'},{readError:'fechamento_excecoes_cliente'}]){
 test('Contador bloqueia envio sem condições: '+JSON.stringify(options),async()=>{
  const f=setup(options),r=await f.load(path).POST(approval());assert.ok(r.status>=400);assert.equal(providerCalls(f).length,0);
 });
}
for(const options of [{networkError:true},{httpStatus:500},{finishError:true},{eventError:true}]){
 test('Contador não confirma sucesso nem reenvia resultado incerto: '+JSON.stringify(options),async()=>{
  const f=setup(options),route=f.load(path);assert.ok((await route.POST(approval())).status>=400);
  const count=providerCalls(f).length;assert.equal(count,1);
  assert.equal((await route.POST(approval('nova-chave'))).status,409);assert.equal(providerCalls(f).length,count);
 });
}
test('Contador permite retry somente após rejeição anterior ao efeito',async()=>{
 const f=setup({product:'outro'}),route=f.load(path);
 assert.ok((await route.POST(approval())).status>=400);assert.equal(providerCalls(f).length,0);
 f.settings.product='organizapro';
 assert.equal((await route.POST(approval('retry'))).status,200);assert.equal(providerCalls(f).length,1);
});
test('Contador separa competências sem usar a chave arbitrária do navegador',async()=>{
 const f=setup(),route=f.load(path);
 assert.equal((await route.POST(approval('a','2026-09'))).status,200);
 assert.equal((await route.POST(approval('b','2026-08'))).status,200);assert.equal(providerCalls(f).length,2);
});
test('Migrations finais têm versões únicas e preservam Contador v1/v2 e Ads',()=>{
 const files=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql'));
 const versions=files.map(f=>f.split('_')[0]);assert.equal(new Set(versions).size,versions.length);
 for(const name of ['20260923000001_fechamento_contabil_v1.sql','20260923000002_fechamento_contabil_v2.sql','20260923000003_ads_atribuicao_v1.sql'])assert.ok(files.includes(name));
});
