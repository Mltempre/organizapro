// seguranca.operacao em eventos_dominio append-only: o banco real rejeita
// UPDATE/DELETE por trigger (inclusive service role); o fixture espelha isso.
// Reserva e resultado são INSERTs com PK determinística.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,tenant} from './helpers/p1-fixture.mjs';
const lib='lib/seguranca-operacoes.ts';
const mutacoes=f=>f.queries.filter(q=>q.table==='eventos_dominio'&&['update','delete','upsert'].includes(q.action));
const resultados=f=>[...f.rows.values()].filter(r=>r.tipo==='seguranca.operacao_resultado');

test('reserva é INSERT pendente com ID determinístico original',async()=>{
 const f=fixture(),h=f.load(lib),g=f.load('lib/whatsapp-governado.ts');
 const r=await h.reservarOperacao(f.db,tenant,'op','body');
 assert.equal(r.id,g.entidadeIdDeterministico('seguranca.p1',JSON.stringify([tenant,'op'])));
 const row=f.rows.get(r.id);
 assert.equal(row.tipo,'seguranca.operacao');assert.equal(row.payload.estado,'pendente');assert.equal(row.payload.ticket,r.ticket);
 assert.equal(row.chave_idempotencia,`seguranca:${r.id}`);assert.equal(mutacoes(f).length,0);
});
for(const estado of ['sucesso','incerto','rejeitado'])test(`finalização ${estado} é novo evento correlacionado; reserva fica imutável`,async()=>{
 const f=fixture(),h=f.load(lib),g=f.load('lib/whatsapp-governado.ts');
 const r=await h.reservarOperacao(f.db,tenant,'op','body');
 assert.equal(await h.finalizarOperacao(f.db,r,estado),true);
 const [res]=resultados(f);
 assert.equal(res.id,g.entidadeIdDeterministico('seguranca.p1.resultado',JSON.stringify([tenant,r.id])));
 assert.equal(res.id,h.idResultadoOperacao(tenant,r.id));
 assert.equal(res.entidade_id,r.id);assert.equal(res.clinica_id,tenant);assert.equal(res.chave_idempotencia,`seguranca-resultado:${r.id}`);
 assert.deepEqual(JSON.parse(JSON.stringify(res.payload)),{estado,ticket:r.ticket,hash:r.hash});
 assert.equal(f.rows.get(r.id).payload.estado,'pendente');assert.equal(mutacoes(f).length,0);
});
test('finalização é idempotente para a mesma reserva/estado',async()=>{
 const f=fixture(),h=f.load(lib);const r=await h.reservarOperacao(f.db,tenant,'op','body');
 assert.equal(await h.finalizarOperacao(f.db,r,'sucesso'),true);
 assert.equal(await h.finalizarOperacao(f.db,r,'sucesso'),true);
 assert.equal(resultados(f).length,1);
});
test('conflito incompatível (outro estado ou outro ticket) é recusado e não sobrescreve',async()=>{
 const f=fixture(),h=f.load(lib);const r=await h.reservarOperacao(f.db,tenant,'op','body');
 assert.equal(await h.finalizarOperacao(f.db,r,'sucesso'),true);
 assert.equal(await h.finalizarOperacao(f.db,r,'incerto'),false);
 assert.equal(await h.finalizarOperacao(f.db,{...r,ticket:'outro-ticket'},'sucesso'),false);
 assert.equal(resultados(f).length,1);assert.equal(resultados(f)[0].payload.estado,'sucesso');
});
test('falha ao gravar o resultado retorna false e mantém a operação bloqueada',async()=>{
 const f=fixture({finishError:true}),h=f.load(lib);const r=await h.reservarOperacao(f.db,tenant,'op','body',true);
 assert.equal(await h.finalizarOperacao(f.db,r,'sucesso'),false);
 assert.equal(await h.reservarOperacao(f.db,tenant,'op','body',true),null);
});
test('duplicidade de reserva continua bloqueada: pendente, sucesso e incerto',async()=>{
 for(const estado of [null,'sucesso','incerto']){
  const f=fixture(),h=f.load(lib);const r=await h.reservarOperacao(f.db,tenant,'op','body',true);
  if(estado)await h.finalizarOperacao(f.db,r,estado);
  assert.equal(await h.reservarOperacao(f.db,tenant,'op','body'),null);
  assert.equal(await h.reservarOperacao(f.db,tenant,'op','body',true),null);
 }
});
test('rejeição comprovada abre nova tentativa por INSERT; original e resultado preservados',async()=>{
 const f=fixture(),h=f.load(lib);const r0=await h.reservarOperacao(f.db,tenant,'op','body',true);
 await h.finalizarOperacao(f.db,r0,'rejeitado');
 assert.equal(await h.reservarOperacao(f.db,tenant,'op','outro-conteudo',true),null);
 const r1=await h.reservarOperacao(f.db,tenant,'op','body',true);
 assert.ok(r1);assert.notEqual(r1.id,r0.id);
 assert.equal(f.rows.get(r0.id).payload.estado,'pendente');
 assert.equal(f.rows.get(h.idResultadoOperacao(tenant,r0.id)).payload.estado,'rejeitado');
 assert.equal(await h.finalizarOperacao(f.db,r1,'sucesso'),true);
 assert.equal(await h.reservarOperacao(f.db,tenant,'op','body',true),null);
 assert.equal(mutacoes(f).length,0);
});
test('fluxo completo nunca emite UPDATE/DELETE em eventos_dominio',async()=>{
 const f=fixture(),h=f.load(lib);
 const r=await h.reservarOperacao(f.db,tenant,'a','x',true);await h.finalizarOperacao(f.db,r,'rejeitado');
 const r2=await h.reservarOperacao(f.db,tenant,'a','x',true);await h.finalizarOperacao(f.db,r2,'incerto');
 await h.reservarOperacao(f.db,tenant,'a','x',true);await h.finalizarOperacao(f.db,r2,'incerto');
 assert.equal(mutacoes(f).length,0);
});
test('o código de produção não contém UPDATE/DELETE em eventos_dominio',async()=>{
 const fs=await import('node:fs');const src=fs.readFileSync(new URL('../'+lib,import.meta.url),'utf8');
 assert.doesNotMatch(src,/from\("eventos_dominio"\)[^;]*\.(update|delete|upsert)\s*\(/);
 assert.match(src,/from\("eventos_dominio"\)/);
});
