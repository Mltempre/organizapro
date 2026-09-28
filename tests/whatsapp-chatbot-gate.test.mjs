// Gate WhatsApp + Chatbot V1 (2026-09-28) — fluxo real ponta a ponta sem envio:
// webhook Z-API → tenant pela instância → chatbot → /api/whatsapp → provider
// simulado. Dois tenants com instâncias e tokens distintos provam isolamento.
//
// node --test tests/whatsapp-chatbot-gate.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, request, tenant as A } from './helpers/p1-fixture.mjs';

const B = '33333333-3333-4333-8333-333333333333';
const SDR = '9b21a735-4bbb-4cbc-8666-7d941be9d35c';
const CLIENTE = '5543999990001';
const CFG = {
  [A]:   { clinica_id: A,   user_id: 'user',  telefone: '5511000000001', zapi_instance: 'inst-A',   zapi_token: 'TOKEN_A_SECRET',   zapi_client_token: 'CLIENT_A_SECRET',   nome_clinica: 'Empresa A' },
  [B]:   { clinica_id: B,   user_id: 'other', telefone: '5511000000002', zapi_instance: 'inst-B',   zapi_token: 'TOKEN_B_SECRET',   zapi_client_token: 'CLIENT_B_SECRET',   nome_clinica: 'Empresa B' },
  [SDR]: { clinica_id: SDR, user_id: 'sdr',   telefone: '5543984128591', zapi_instance: 'inst-SDR', zapi_token: 'TOKEN_SDR_SECRET', zapi_client_token: 'CLIENT_SDR_SECRET', nome_clinica: 'OrganizaPro' },
};

function cenario(o = {}) {
  const f = fixture({
    routeInternal: true, routeChatbot: true, ...o.fixture,
    responder: (q, get) => {
      if (q.table === 'clinica_config' && q.action === 'select') {
        const inst = get('zapi_instance'), cid = get('clinica_id');
        if (inst !== undefined && o.erroInstancia) return { data: null, error: { code: 'XX000' } };
        // Duas linhas com a mesma instância: maybeSingle do PostgREST devolve erro.
        if (inst !== undefined && o.instanciaDuplicada && q.single) return { data: null, error: { code: 'PGRST116' } };
        // eq exato e ilike (padrão escapado) comparados sem diferenciar maiúsculas.
        const alvo = inst?.replace(/\\(.)/g, '$1').toLowerCase();
        const rows = Object.values(CFG)
          .filter(c => (inst === undefined || c.zapi_instance.toLowerCase() === alvo) && (cid === undefined || c.clinica_id === cid))
          .map(c => o.semZapi?.includes(c.clinica_id) ? { ...c, zapi_token: null } : c);
        return { data: q.single ? rows[0] ?? null : rows, error: null };
      }
      if (q.table === 'clinica_usuarios') return { data: get('clinica_id') === A ? { clinica_id: A } : null, error: null };
      if (q.table === 'clinicas') return { data: { produto: 'organizapro', nome: 'Empresa', especialidade: o.especialidade ?? null }, error: null };
      if (q.table === 'chatbot_config') return { data: o.semChatbot ? null : { clinica_id: get('clinica_id'), ativo: true, link_humano: o.link ?? null, nome_clinica: 'Empresa' }, error: null };
      if (q.table === 'chatbot_treinamento' || q.table === 'clinica_servicos') return { data: [], error: null };
      if (q.table === 'chatbot_leads' && q.action === 'select') return { data: o.lead ?? null, error: null };
      if (q.table === 'agendamentos') {
        if (q.action === 'update') return { data: null, error: null };
        return { data: o.agendamento ? [{ id: 'ag-1', clinica_id: get('clinica_id'), paciente_nome: 'Cliente', status: 'agendado', data: '2099-01-01', hora: '10:00', confirmacao_enviada: true, confirmado: null, precisa_reagendar: false }] : [], error: null };
      }
      return undefined;
    },
  });
  return f;
}

const URL_OK = 'https://fixture.test/api/webhook/zapi?token=webhook';
let seq = 0;
const evento = (texto, extra = {}) => ({ instanceId: 'inst-A', messageId: 'msg-' + (++seq), phone: CLIENTE, text: { message: texto }, senderName: 'Cliente', ...extra });
async function receber(f, e, url = URL_OK) {
  const r = await f.load('app/api/webhook/zapi/route.ts').POST(request(e, 'x', url));
  for (const job of f.jobs.splice(0)) await job();
  return r;
}
const zapi = f => f.calls.filter(c => new URL(c.url).hostname === 'api.z-api.io');
const enviado = c => JSON.parse(c.init.body);
const inseridos = (f, tabela) => f.queries.filter(q => q.table === tabela && q.action === 'insert').map(q => q.value);
const updatesAgenda = f => f.queries.filter(q => q.table === 'agendamentos' && q.action === 'update');
const chamadasChatbot = f => f.calls.filter(c => new URL(c.url).pathname === '/api/chatbot/message');

test('fluxo A: mensagem do cliente → chatbot do tenant da instância → 1 resposta pela instância certa + logs sem conteúdo', async () => {
  const f = cenario();
  const r = await receber(f, evento('Olá'));
  assert.equal(r.status, 200);
  const envios = zapi(f);
  assert.equal(envios.length, 1);
  assert.match(envios[0].url, /\/instances\/inst-A\/token\/TOKEN_A_SECRET\/send-text$/);
  assert.equal(envios[0].init.headers['Client-Token'], 'CLIENT_A_SECRET');
  assert.equal(enviado(envios[0]).phone, CLIENTE);
  assert.match(enviado(envios[0]).message, /Bem-vindo\(a\) à Empresa/);
  const wa = inseridos(f, 'whatsapp_logs');
  assert.deepEqual(wa.map(l => [l.clinica_id, l.status, l.mensagem]), [[A, 'enviado', '[conteúdo omitido]']]);
  const cb = inseridos(f, 'chatbot_logs');
  assert.equal(cb.length, 1);
  assert.equal(cb[0].clinica_id, A);
  assert.equal(cb[0].mensagem_paciente, '[conteúdo omitido]');
});

test('webhook sem segredo, com segredo errado ou sem WEBHOOK_SECRET no servidor → bloqueado antes de qualquer consulta', async () => {
  for (const [url, env, status] of [
    ['https://fixture.test/api/webhook/zapi', {}, 401],
    ['https://fixture.test/api/webhook/zapi?token=errado', {}, 401],
    [URL_OK, { WEBHOOK_SECRET: '' }, 503],
  ]) {
    const f = cenario({ fixture: { env } });
    const r = await receber(f, evento('Olá'), url);
    assert.equal(r.status, status);
    assert.equal(f.queries.length, 0);
    assert.equal(f.calls.length, 0);
  }
});

test('/api/whatsapp sem sessão/segredo → 401; /api/chatbot/message sem segredo interno → 401 (503 se ausente no servidor)', async () => {
  const f = cenario();
  const envio = { clinica_id: A, telefone: CLIENTE, mensagem: 'x', operacao: 'op' };
  assert.equal((await f.load('app/api/whatsapp/route.ts').POST(request(envio, 'invalido'))).status, 401);
  assert.equal((await f.load('app/api/chatbot/message/route.ts').POST(request(envio, 'errado'))).status, 401);
  assert.equal(zapi(f).length, 0);
  const g = cenario({ fixture: { env: { CHATBOT_INTERNAL_SECRET: '' } } });
  assert.equal((await g.load('app/api/chatbot/message/route.ts').POST(request(envio, ''))).status, 503);
  assert.equal(g.queries.length, 0);
});

test('multi-tenant: instância B usa só config/credenciais de B; instância desconhecida não responde; clinica_id no payload é ignorado', async () => {
  const f = cenario();
  await receber(f, evento('Olá', { instanceId: 'inst-B' }));
  assert.equal(zapi(f).length, 1);
  assert.match(zapi(f)[0].url, /\/instances\/inst-B\/token\/TOKEN_B_SECRET\//);
  assert.ok(!JSON.stringify(f.calls).includes('TOKEN_A_SECRET'));

  const g = cenario();
  const r = await receber(g, evento('Olá', { instanceId: 'inst-desconhecida' }));
  assert.equal(r.status, 200);
  assert.equal(chamadasChatbot(g).length, 0);
  assert.equal(zapi(g).length, 0);

  const h = cenario();
  await receber(h, evento('Olá', { clinica_id: B }));
  assert.match(zapi(h)[0].url, /\/instances\/inst-A\//);
  assert.equal(JSON.parse(chamadasChatbot(h)[0].init.body).clinica_id, A);
});

test('multi-tenant: membro de A não envia nem lê configuração de B; GET de A nunca devolve tokens', async () => {
  const f = cenario();
  const teste = '✅ Teste OrganizaPro: integração Z-API funcionando corretamente!';
  const r = await f.load('app/api/whatsapp/route.ts').POST(request({ clinica_id: B, telefone: CFG[B].telefone, mensagem: teste }));
  assert.equal(r.status, 403);
  const cfg = f.load('app/api/configuracoes/route.ts');
  const reqB = { ...request(null), nextUrl: new URL('https://fixture.test/api/configuracoes?clinica_id=' + B) };
  assert.equal((await cfg.GET(reqB)).status, 403);
  const reqA = { ...request(null), nextUrl: new URL('https://fixture.test/api/configuracoes?clinica_id=' + A) };
  const rA = await cfg.GET(reqA);
  assert.equal(rA.status, 200);
  assert.equal(rA.body.zapi_configurado, true);
  assert.ok(!JSON.stringify(rA.body).includes('TOKEN_A_SECRET') && !JSON.stringify(rA.body).includes('CLIENT_A_SECRET'));
  assert.equal(zapi(f).length, 0);
});

test('mensagem do próprio número (fromMe / receiveCallbackSentByMe) e de grupo: ignoradas sem consulta nem envio', async () => {
  for (const extra of [{ fromMe: true }, { isGroup: true }]) {
    const f = cenario();
    const r = await receber(f, evento('Olá', extra));
    assert.equal(r.status, 200);
    assert.equal(f.queries.length, 0);
    assert.equal(f.calls.length, 0);
  }
});

test('webhook repetido (mesmo messageId, em sequência ou concorrente) → chatbot responde uma vez', async () => {
  const f = cenario();
  const e = evento('Olá');
  await receber(f, e);
  await receber(f, e);
  await Promise.all([receber(f, e), receber(f, e)]);
  assert.equal(chamadasChatbot(f).length, 1);
  assert.equal(zapi(f).length, 1);
});

test('handoff: pedido de atendente responde uma vez e silencia o bot para o contato (24h); outro contato segue normal', async () => {
  const f = cenario();
  await receber(f, evento('Quero falar com um atendente'));
  assert.equal(zapi(f).length, 1);
  assert.match(enviado(zapi(f)[0]).message, /alguém da nossa equipe continuar seu atendimento/);
  const handoff = f.queries.filter(q => q.table === 'eventos_dominio' && q.action === 'insert' && q.value.tipo === 'chatbot.handoff_humano');
  assert.equal(handoff.length, 1);
  assert.equal(handoff[0].value.clinica_id, A);
  assert.ok(!JSON.stringify(handoff[0].value).includes(CLIENTE), 'handoff não grava telefone em claro');

  await receber(f, evento('oi, alguém aí?'));
  await receber(f, evento('Qual o endereço?'));
  assert.equal(zapi(f).length, 1, 'bot não responde por cima do humano');
  assert.deepEqual(inseridos(f, 'chatbot_logs').map(l => l.processado_por), ['handoff_humano', 'handoff_humano_ativo', 'handoff_humano_ativo']);

  await receber(f, evento('Olá', { phone: '5543999990002' }));
  assert.equal(zapi(f).length, 2);
});

test('handoff com link_humano: responde com o link configurado da empresa', async () => {
  const f = cenario({ link: 'https://wa.me/5511000000001' });
  await receber(f, evento('preciso de atendimento humano'));
  assert.match(enviado(zapi(f)[0]).message, /https:\/\/wa\.me\/5511000000001/);
});

test('SDR: pedido de pessoa durante a qualificação nunca vira dado do lead; "sim" após o convite vira handoff', async () => {
  const f = cenario({ lead: { etapa: 'qualificacao_nome', score: 50 } });
  await receber(f, evento('quero falar com um atendente', { instanceId: 'inst-SDR' }));
  const upsert = f.queries.find(q => q.table === 'chatbot_leads' && q.action === 'upsert');
  assert.equal(upsert.value.etapa, 'concluido');
  assert.equal(upsert.value.nome, undefined);
  assert.match(zapi(f)[0].url, /inst-SDR/);

  const g = cenario({ lead: { etapa: 'concluido', score: 100 } });
  await receber(g, evento('Sim', { instanceId: 'inst-SDR' }));
  assert.equal(zapi(g).length, 1, '"sim" ao convite não fica sem resposta');
  assert.equal(inseridos(g, 'chatbot_logs')[0].processado_por, 'handoff_humano');
  assert.equal(updatesAgenda(g).length, 0);

  const h = cenario({ lead: { etapa: 'inicial', score: 10 } });
  await receber(h, evento('sim', { instanceId: 'inst-SDR' }));
  assert.equal(zapi(h).length, 0, '"sim" solto, sem convite pendente, continua ignorado');
});

test('SIM confirma o agendamento do tenant e responde 1 vez; NÃO marca reagendar', async () => {
  const f = cenario({ agendamento: true });
  await receber(f, evento('SIM'));
  const upd = updatesAgenda(f).map(q => q.value);
  assert.ok(upd.some(v => v.status === 'confirmado' && v.confirmado === true));
  assert.equal(zapi(f).length, 1);
  assert.match(enviado(zapi(f)[0]).message, /está confirmada/);
  assert.match(zapi(f)[0].url, /inst-A/);

  const g = cenario({ agendamento: true });
  await receber(g, evento('Não'));
  assert.ok(updatesAgenda(g).map(q => q.value).some(v => v.status === 'reagendar' && v.precisa_reagendar === true));
  assert.equal(zapi(g).length, 1);
});

test('opt-out "não quero mais receber" / "cancelar inscrição": registra bloqueio e nunca reagenda', async () => {
  for (const texto of ['Não quero mais receber', 'cancelar inscrição', 'PARAR']) {
    const f = cenario({ agendamento: true });
    await receber(f, evento(texto));
    assert.equal(updatesAgenda(f).length, 0, texto);
    const consent = inseridos(f, 'eventos_dominio').filter(v => v.tipo === 'whatsapp.consentimento');
    assert.equal(consent.length, 1, texto);
    assert.equal(consent[0].payload.estado, 'bloqueado');
    assert.equal(zapi(f).length, 0, texto);
  }
});

test('entrada desconhecida → fallback honesto; nunca afirma confirmação que não foi gravada', async () => {
  const f = cenario();
  await receber(f, evento('xyzzy blorg qwe'));
  const msg = enviado(zapi(f)[0]).message;
  assert.match(msg, /Não entendi sua pergunta/);
  assert.doesNotMatch(msg, /R\$/);

  const g = cenario({ agendamento: true });
  await receber(g, evento('quero confirmar minha presença'));
  assert.equal(updatesAgenda(g).length, 0);
  assert.doesNotMatch(enviado(zapi(g)[0]).message, /presença confirmada/i);
});

test('crise (psicologia): acolhe, conecta à equipe e silencia o bot', async () => {
  const f = cenario({ especialidade: 'psicologia' });
  await receber(f, evento('penso em me machucar'));
  assert.match(enviado(zapi(f)[0]).message, /Vou te conectar agora com a equipe/);
  await receber(f, evento('Olá'));
  assert.equal(zapi(f).length, 1);
});

test('erro da Z-API (timeout/5xx): registra erro, não repete e não vaza credencial', async () => {
  for (const settings of [{ networkError: true }, { httpStatus: 500, httpBody: { error: 'SENSITIVE_SENTINEL' } }]) {
    const f = cenario({ fixture: settings });
    const e = evento('Olá');
    await receber(f, e);
    await receber(f, e);
    assert.equal(zapi(f).length, 1);
    assert.equal(inseridos(f, 'whatsapp_logs')[0].status, 'erro');
    const tudo = JSON.stringify([f.logs, f.queries.filter(q => q.table.endsWith('_logs'))]);
    for (const s of ['TOKEN_A_SECRET', 'CLIENT_A_SECRET', 'SENSITIVE_SENTINEL']) assert.ok(!tudo.includes(s), s);
  }
});

test('ausência de configuração: sem Z-API do tenant → nada enviado; sem chatbot_config → silêncio', async () => {
  const f = cenario({ semZapi: [A] });
  await receber(f, evento('Olá'));
  assert.equal(zapi(f).length, 0);
  assert.equal(inseridos(f, 'whatsapp_logs').length, 0);

  const g = cenario({ semChatbot: true });
  await receber(g, evento('Olá'));
  assert.equal(chamadasChatbot(g).length, 1);
  assert.equal(g.calls.filter(c => new URL(c.url).pathname === '/api/whatsapp').length, 0);
});

test('anti-loop: auto-respondedor recebe no máximo 15 respostas por hora; excedente fica registrado', async () => {
  const f = cenario();
  for (let n = 0; n < 17; n++) await receber(f, evento('Olá'));
  assert.equal(zapi(f).length, 15);
  assert.equal(inseridos(f, 'chatbot_logs').filter(l => l.processado_por === 'limite_por_contato').length, 2);
});

test('segredos: tokens Z-API e segredos de rota nunca aparecem em console, respostas HTTP ou logs persistidos', async () => {
  const f = cenario({ fixture: { env: { WEBHOOK_SECRET: 'WEBHOOK_SECRET_VALUE' } } });
  const respostas = [];
  for (const texto of ['Olá', 'SIM', 'quero falar com um atendente']) {
    const r = await receber(f, evento(texto), 'https://fixture.test/api/webhook/zapi?token=WEBHOOK_SECRET_VALUE');
    respostas.push(r.body);
  }
  const tudo = JSON.stringify([f.logs, respostas, f.queries.filter(q => q.action === 'insert')]);
  for (const s of ['TOKEN_A_SECRET', 'CLIENT_A_SECRET', 'WEBHOOK_SECRET_VALUE']) assert.ok(!tudo.includes(s), s);
});

// ── Residuais (2026-09-28): @lid, mídia, instância duplicada ─────────────────

test('telefoneConfiavelZapi: só número real; @lid, grupo, canal e LID sem sufixo → null (nunca telefone falso)', () => {
  const { telefoneConfiavelZapi: t } = cenario().load('lib/whatsapp-governado.ts');
  assert.equal(t('5544999999999', ['81896604192873@lid']), '5544999999999');
  assert.equal(t('5544999999999@c.us'), '5544999999999');
  assert.equal(t('5544999999999@s.whatsapp.net'), '5544999999999');
  assert.equal(t('+55 (44) 99999-9999'), '5544999999999');
  for (const [phone, lids] of [
    ['81896604192873@lid', []], ['81896604192873@LID', []], ['81896604192873', ['81896604192873@lid']],
    ['120363012345678@g.us', []], ['120363012345678@newsletter', []], ['status@broadcast', []],
    ['123', []], ['1234567890123456', []], ['abc5544999999999', []], ['', []], [null, []], [5544999999999, []],
  ]) assert.equal(t(phone, lids), null, String(phone));
});

test('@lid: sem telefone confiável não responde, não busca agendamento, não grava contato; log sanitizado no tenant', async () => {
  for (const extra of [
    { phone: '81896604192873@lid', senderLid: '81896604192873@lid' },
    { phone: '81896604192873', senderLid: '81896604192873@lid' },
    { phone: '81896604192873', chatLid: '81896604192873@lid' },
  ]) {
    for (const texto of ['Olá', 'SIM', 'quero falar com um atendente', 'parar']) {
      const f = cenario({ agendamento: true });
      const r = await receber(f, evento(texto, extra));
      assert.equal(r.status, 200);
      assert.equal(r.body.ignorado, 'contato_sem_telefone');
      assert.equal(chamadasChatbot(f).length, 0);
      assert.equal(f.calls.length, 0);
      assert.equal(f.queries.filter(q => ['agendamentos', 'chatbot_leads', 'eventos_dominio'].includes(q.table)).length, 0);
      const log = inseridos(f, 'whatsapp_logs');
      assert.deepEqual(log.map(l => [l.clinica_id, l.telefone, l.mensagem, l.resposta.tipo]), [[A, null, '[conteúdo omitido]', 'contato_sem_telefone_confiavel']]);
      assert.ok(!JSON.stringify([f.logs, f.queries]).includes('81896604192873'), 'LID não vai para log nem consulta');
    }
  }
});

test('@lid: instância desconhecida registra sem tenant; phone real com senderLid segue o fluxo normal', async () => {
  const f = cenario();
  await receber(f, evento('Olá', { phone: '81896604192873@lid', instanceId: 'inst-desconhecida' }));
  assert.equal(inseridos(f, 'whatsapp_logs')[0].clinica_id, null);
  assert.equal(f.calls.length, 0);

  const g = cenario();
  await receber(g, evento('Olá', { senderLid: '81896604192873@lid' }));
  assert.equal(zapi(g).length, 1);
  assert.equal(enviado(zapi(g)[0]).phone, CLIENTE);
});

test('áudio, imagem, figurinha e documento: sem erro, sem resposta inventada, sem consulta, sem loop', async () => {
  for (const midia of [
    { audio: { ptt: true, seconds: 10, audioUrl: 'https://midia.test/SENSITIVE_SENTINEL.ogg', mimeType: 'audio/ogg; codecs=opus' } },
    { image: { mimeType: 'image/jpeg', imageUrl: 'https://midia.test/SENSITIVE_SENTINEL.jpg', caption: 'SENSITIVE_SENTINEL', width: 600, height: 315 } },
    { sticker: { stickerUrl: 'https://midia.test/SENSITIVE_SENTINEL.webp', mimeType: 'image/webp' } },
    { document: { documentUrl: 'https://midia.test/SENSITIVE_SENTINEL.pdf', fileName: 'SENSITIVE_SENTINEL.pdf' } },
  ]) {
    const f = cenario();
    const e = { ...evento('x'), text: undefined, ...midia };
    for (let n = 0; n < 3; n++) {
      const r = await receber(f, { ...e, messageId: 'midia-' + (++seq) });
      assert.equal(r.status, 200);
      assert.equal(r.body.ignorado, 'sem_dados');
    }
    assert.equal(f.queries.length, 0);
    assert.equal(f.calls.length, 0);
    assert.ok(!JSON.stringify([f.logs]).includes('SENSITIVE_SENTINEL'));
  }
});

test('instância duplicada ou leitura com erro no webhook: fail-closed, nenhuma resposta', async () => {
  for (const o of [{ instanciaDuplicada: true }, { erroInstancia: true }]) {
    for (const texto of ['Olá', 'SIM']) {
      const f = cenario({ ...o, agendamento: true });
      await receber(f, evento(texto));
      assert.equal(chamadasChatbot(f).length, 0, texto);
      assert.equal(zapi(f).length, 0, texto);
      assert.equal(updatesAgenda(f).length, 0, texto);
    }
  }
});

test('configurações: instância Z-API de outro negócio é recusada (409) sem gravar; re-salvar a própria continua ok', async () => {
  const salvar = async (f, zapi_instance) => f.load('app/api/configuracoes/route.ts').PUT(request({ clinica_id: A, nome_clinica: 'Empresa A', zapi_instance }));
  for (const valor of ['inst-B', ' INST-b ']) {
    const f = cenario();
    const r = await salvar(f, valor);
    assert.equal(r.status, 409, valor);
    assert.ok(!JSON.stringify(r.body).includes(B));
    assert.equal(f.queries.filter(q => q.table === 'clinica_config' && ['update', 'insert', 'upsert'].includes(q.action)).length, 0);
  }
  const g = cenario();
  assert.equal((await salvar(g, ' inst-A ')).status, 200);
  const upd = g.queries.find(q => q.table === 'clinica_config' && q.action === 'update');
  assert.equal(upd.value.zapi_instance, 'inst-A', 'grava sem espaços nas bordas');
  const h = cenario({ erroInstancia: true });
  assert.equal((await salvar(h, 'inst-nova')).status, 503);
  assert.equal(h.queries.filter(q => q.action === 'update' || q.action === 'insert').length, 0);
  const k = cenario();
  assert.equal((await salvar(k, '')).status, 200, 'limpar instância não consulta conflito');
});

test('SQL pendente de unicidade: fora das migrations automáticas, pré-check que aborta sem alterar, índice parcial normalizado', async () => {
  const fs = await import('node:fs');
  const arq = new URL('../sql/saneamento-pendente/fix-clinica-config-zapi-instance-unica-v1.sql', import.meta.url);
  assert.ok(!fs.existsSync(new URL('../supabase/migrations/fix-clinica-config-zapi-instance-unica-v1.sql', import.meta.url)));
  const sql = fs.readFileSync(arq, 'utf8').replace(/\r\n/g, '\n');
  const ativo = sql.replace(/--.*$/gm, '');
  assert.match(ativo, /raise exception 'ABORTADO:/);
  assert.ok(ativo.indexOf('raise exception') < ativo.indexOf('create unique index'));
  assert.match(ativo, /create unique index if not exists clinica_config_zapi_instance_unica_uidx\s+on public\.clinica_config \(lower\(btrim\(zapi_instance\)\)\)\s+where zapi_instance is not null and btrim\(zapi_instance\) <> ''/);
  assert.doesNotMatch(ativo, /\b(update|delete|truncate|drop|alter)\b/i, 'nunca altera ou apaga dados/estrutura existente');
  assert.match(sql, /COMPARTILHADA com o ClínicaFlow/);
});

test('crons sem CRON_SECRET correto → 401 antes de qualquer consulta ou envio', async () => {
  for (const nome of ['lembretes', 'avaliacoes']) {
    for (const token of ['errado', '']) {
      const f = cenario();
      const r = await f.load(`app/api/cron/${nome}/route.ts`).GET(request(null, token));
      assert.equal(r.status, 401);
      assert.equal(f.queries.length, 0);
      assert.equal(f.calls.length, 0);
    }
  }
});
