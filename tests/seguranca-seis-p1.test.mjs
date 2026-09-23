import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,request,tenant,resource,phone} from './helpers/p1-fixture.mjs';
const webhook='app/api/webhook/zapi/route.ts', wa='app/api/whatsapp/route.ts', ia='app/api/ia/route.ts';
const event={instanceId:'fixture-instance',messageId:'fixture-message',phone,text:{message:'Olá'},token:'SENSITIVE_SENTINEL'};
const send={clinica_id:tenant,telefone:phone,mensagem:'SENSITIVE_SENTINEL',operacao:'fixture-send'};
const approve='app/api/cobrancas/[id]/aprovar-envio/route.ts';
const approval=(key='click')=>request({clinica_id:tenant,idempotency_key:key});
const params={params:Promise.resolve({id:resource})};

test('P1-1: observe-only nunca ignora segredo ausente/incorreto',async()=>{
 for(const secret of ['', 'configured']){const f=fixture({env:{WEBHOOK_AUTH_OBSERVE_ONLY:'true',WEBHOOK_SECRET:secret}});
 const r=await f.load(webhook).POST(request(event));assert.ok([401,503].includes(r.status));assert.equal(f.queries.length,0);assert.equal(f.jobs.length,0);}
});
test('P1-1: webhook legítimo preserva encaminhamento e dedup',async()=>{
 const f=fixture(), route=f.load(webhook);
 assert.equal((await route.POST(request(event,'x','https://fixture.test/api?token=webhook'))).status,200);
 await route.POST(request(event,'x','https://fixture.test/api?token=webhook'));assert.equal(f.jobs.length,1);
});
for(const [route,body,token] of [[wa,send,'internal'],['app/api/chatbot/message/route.ts',send,'chatbot'],[webhook,event,'session']]){
 test('P1-2: produto alheio bloqueado em '+route,async()=>{const f=fixture({product:'outro'});
 const r=await f.load(route).POST(request(body,token,'https://fixture.test/api?token=webhook'));assert.equal(r.status,403);assert.equal(f.calls.length,0);assert.equal(f.jobs.length,0);
 assert.equal(f.queries.filter(q=>q.table==='agendamentos'||q.table==='chatbot_leads').length,0);});
}
for(const name of ['lembretes','avaliacoes'])test('P1-2: cron '+name+' não processa outro produto',async()=>{
 const f=fixture({product:'outro'});await f.load('app/api/cron/'+name+'/route.ts').GET(request(null,'cron'));
 assert.equal(f.calls.length,0);assert.equal(f.queries.filter(q=>q.table==='agendamentos').length,0);
});
test('P1-3: IA exige vínculo e produto, ignorando tenant do corpo',async()=>{
 for(const settings of [{member:false},{product:'outro'}]){const f=fixture(settings);const r=await f.load(ia).POST(request({prompt:'ok',clinica_id:tenant}));assert.equal(r.status,403);assert.equal(f.calls.length,0);}
});
test('P1-3: IA rejeita limite e tamanho excessivos',async()=>{
 for(const body of [{prompt:'ok',max_tokens:90000},{prompt:'x'.repeat(20001)},{prompt:17}]){const f=fixture();assert.equal((await f.load(ia).POST(request(body))).status,400);assert.equal(f.calls.length,0);}
});
test('P1-3: IA mantém prompt/modelo e aplica cota durável por usuário',async()=>{
 const f=fixture(),route=f.load(ia);for(let n=0;n<20;n++)assert.equal((await route.POST(request({prompt:'fixture'}))).status,200);
 assert.equal((await route.POST(request({prompt:'fixture'}))).status,429);assert.equal(f.calls.length,20);
 const body=JSON.parse(f.calls[0].init.body);assert.equal(body.model,'gpt-4o-mini');assert.equal(body.max_tokens,700);assert.equal(body.messages[1].content,'fixture');
});
test('P1-3: indisponibilidade da cota impede provedor',async()=>{const f=fixture({insertError:true});assert.equal((await f.load(ia).POST(request({prompt:'ok'}))).status,429);assert.equal(f.calls.length,0);});
test('P1-4: membro não pode enviar mensagem arbitrária pelo adaptador',async()=>{const f=fixture();assert.equal((await f.load(wa).POST(request(send))).status,403);assert.equal(f.calls.length,0);});
test('P1-4: opt-out e erro de leitura bloqueiam até serviço interno',async()=>{
 for(const settings of [{blocked:true},{consentError:true}]){const f=fixture(settings);assert.equal((await f.load(wa).POST(request(send,'internal'))).status,409);assert.equal(f.calls.length,0);}
});
test('P1-4: teste fixo só para telefone salvo e respeita consentimento',async()=>{
 const f=fixture();const body={...send,mensagem:'✅ Teste OrganizaPro: integração Z-API funcionando corretamente!'};
 assert.equal((await f.load(wa).POST(request({...body,telefone:'5511888880000'}))).status,403);
 assert.equal((await f.load(wa).POST(request(body))).status,200);assert.equal(f.calls.length,1);
});
test('P1-5: duas aprovações concorrentes, inclusive chaves diferentes, enviam uma vez',async()=>{
 const f=fixture(),route=f.load(approve);const r=await Promise.all([route.POST(approval('a'),params),route.POST(approval('b'),params)]);
 assert.equal(f.calls.length,1);assert.equal(r.filter(x=>x.status===200).length,1);
});
test('P1-5: erro de reserva impede envio aprovado',async()=>{const f=fixture({insertError:true});await f.load(approve).POST(approval(),params);assert.equal(f.calls.length,0);});
test('P1-5: webhook concorrente executa uma vez; falha no INSERT executa zero',async()=>{
 for(const insertError of [false,true]){const f=fixture({insertError}),route=f.load(webhook);
 await Promise.all([route.POST(request(event,'x','https://fixture.test/?token=webhook')),route.POST(request(event,'x','https://fixture.test/?token=webhook'))]);assert.equal(f.jobs.length,insertError?0:1);}
});
test('P1-5: webhook sem ID não produz efeitos externos',async()=>{const f=fixture();await f.load(webhook).POST(request({...event,messageId:undefined},'x','https://fixture.test/?token=webhook'));assert.equal(f.jobs.length,0);assert.equal(f.calls.length,0);});
test('P1-5: reserva serializa workers, erro na finalização conserva bloqueio',async()=>{
 const f=fixture(),h=f.load('lib/seguranca-operacoes.ts');const r=await Promise.all([h.reservarOperacao(f.db,tenant,'op','body',true),h.reservarOperacao(f.db,tenant,'op','body',true)]);
 assert.equal(r.filter(Boolean).length,1);f.settings.finishError=true;assert.equal(await h.finalizarOperacao(f.db,r.find(Boolean),'sucesso'),false);
 assert.equal(await h.reservarOperacao(f.db,tenant,'op','body',true),null);
});
test('P1-5: rejeição comprovada permite um retry; incerto/sucesso/hash diferente bloqueiam',async()=>{
 const f=fixture(),h=f.load('lib/seguranca-operacoes.ts');const r=await h.reservarOperacao(f.db,tenant,'op','body',true);
 assert.equal(await h.finalizarOperacao(f.db,r,'rejeitado'),true);assert.equal(await h.reservarOperacao(f.db,tenant,'op','changed',true),null);
 const retries=await Promise.all([h.reservarOperacao(f.db,tenant,'op','body',true),h.reservarOperacao(f.db,tenant,'op','body',true)]);assert.equal(retries.filter(Boolean).length,1);
 await h.finalizarOperacao(f.db,retries.find(Boolean),'incerto');assert.equal(await h.reservarOperacao(f.db,tenant,'op','body',true),null);
});
test('P1-5: adaptador central evita duplicidade e bloqueia timeout',async()=>{
 for(const networkError of [false,true]){const f=fixture({networkError}),route=f.load(wa);
 await Promise.all([route.POST(request(send,'internal')),route.POST(request(send,'internal'))]);await route.POST(request(send,'internal'));assert.equal(f.calls.length,1);}
});
test('P1-5: isolamento da reserva por tenant',async()=>{const f=fixture(),h=f.load('lib/seguranca-operacoes.ts');assert.ok(await h.reservarOperacao(f.db,tenant,'key','body'));assert.ok(await h.reservarOperacao(f.db,'other','key','body'));});
test('P1-6: payload, prompt e erro externo não vazam no console ou diagnóstico persistido',async()=>{
 const f=fixture();await f.load(webhook).POST(request({...event,fromMe:true},'x','https://fixture.test/?token=webhook'));
 await f.load(ia).POST(request({prompt:'SENSITIVE_SENTINEL'}));await f.load(wa).POST(request(send,'internal'));
 assert.ok(!JSON.stringify(f.logs).includes('SENSITIVE_SENTINEL'));
 assert.ok(!JSON.stringify(f.queries.filter(q=>q.table.endsWith('_logs'))).includes('SENSITIVE_SENTINEL'));
 const e=fixture({networkError:true});await e.load(ia).POST(request({prompt:'SENSITIVE_SENTINEL'}));assert.ok(!JSON.stringify(e.logs).includes('SENSITIVE_SENTINEL'));
});

test('P1-5: follow-up concorrente também reserva antes do adaptador',async()=>{
 const f=fixture(),route=f.load('app/api/follow-up/aprovar-envio/route.ts');
 const body={clinica_id:tenant,tipo:'orcamento_parado',entidade_id:resource,idempotency_key:'a'};
 const results=await Promise.all([route.POST(request(body)),route.POST(request({...body,idempotency_key:'b'}))]);
 assert.equal(f.calls.length,1);assert.equal(results.filter(r=>r.status===200).length,1);
});
for(const name of ['lembretes','avaliacoes'])test('P1-5: cron '+name+' concorrente chega uma vez ao provedor simulado',async()=>{
 const f=fixture({routeInternal:true}),route=f.load('app/api/cron/'+name+'/route.ts');
 await Promise.all([route.GET(request(null,'cron')),route.GET(request(null,'cron'))]);
 assert.equal(f.calls.filter(c=>new URL(c.url).hostname==='api.z-api.io').length,1);
});
test('P1-5: aprovação permite retry após recusa comprovada anterior ao efeito',async()=>{
 const f=fixture({httpStatus:409,httpBody:{nao_enviado:true}}),route=f.load(approve);
 assert.equal((await route.POST(approval('a'),params)).status,502);
 f.settings.httpStatus=200;f.settings.httpBody={sucesso:true};
 assert.equal((await route.POST(approval('b'),params)).status,200);assert.equal(f.calls.length,2);
});
test('P1-5: aprovação não permite retry com chave nova após timeout',async()=>{
 const f=fixture({networkError:true}),route=f.load(approve);await route.POST(approval('a'),params);
 await route.POST(approval('b'),params);assert.equal(f.calls.length,1);
});
test('P1-5: confirmação SIM/NAO preserva classificação e tem reserva antes de efeitos',async()=>{
 for(const message of ['SIM','NÃO','NAO']){const f=fixture(),route=f.load(webhook),e={...event,text:{message}};
 await Promise.all([route.POST(request(e,'x','https://fixture.test/?token=webhook')),route.POST(request(e,'x','https://fixture.test/?token=webhook'))]);
 assert.equal(f.calls.filter(c=>new URL(c.url).pathname==='/api/whatsapp').length,1);}
});
test('P1-6: logs de chatbot omitem telefone/mensagem mesmo em caminho autorizado',async()=>{
 const f=fixture();await f.load('app/api/chatbot/message/route.ts').POST(request(send,'chatbot'));
 assert.ok(!JSON.stringify(f.logs).includes('SENSITIVE_SENTINEL'));assert.ok(!JSON.stringify(f.logs).includes(phone));
});
