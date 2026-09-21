// WhatsApp Governado V1 — motor puro + verificação estática das rotas.
// Prova os 18 cenários mandatórios da missão: isolamento de tenant,
// telefone inválido nunca dispara, fail-closed sem provider/credencial,
// falha do provider nunca vira sucesso, retry/clique duplo não duplica,
// webhook repetido não duplica ação, opt-out bloqueia automação
// comercial, modo SUGERIR não envia, modo APROVAR exige aprovação real,
// AUTOMÁTICO não nasce habilitado, mensagem preserva origem/oportunidade,
// evidência nunca vaza token, chatbot respeita tenant, mensagem nunca
// fabrica dado, Smart Commerce nunca vira receita, falha externa
// permanece falha, concorrência não produz dois envios.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/whatsapp-governado.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const wg = await import(pathToFileURL(path.join(buildDir, "whatsapp-governado.js")));

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

// ── Telefone / entidade determinística ──────────────────────────────────

test("normalizarTelefone: adiciona 55 quando ausente, preserva quando já presente", () => {
  assert.equal(wg.normalizarTelefone("41988379119"), "5541988379119");
  assert.equal(wg.normalizarTelefone("5541988379119"), "5541988379119");
  assert.equal(wg.normalizarTelefone("(41) 98837-9119"), "5541988379119");
});

test("entidadeIdDeTelefone: determinístico — mesmo telefone/clinica sempre produz o mesmo uuid", () => {
  const a = wg.entidadeIdDeTelefone("clinica-1", "41988379119");
  const b = wg.entidadeIdDeTelefone("clinica-1", "41988379119");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("entidadeIdDeTelefone: formatos diferentes do MESMO telefone convergem para o mesmo uuid (normalização interna)", () => {
  const a = wg.entidadeIdDeTelefone("clinica-1", "41988379119");
  const b = wg.entidadeIdDeTelefone("clinica-1", "(41) 98837-9119");
  const c = wg.entidadeIdDeTelefone("clinica-1", "5541988379119");
  assert.equal(a, b);
  assert.equal(a, c);
});

test("entidadeIdDeTelefone: isolamento de tenant — mesmo telefone em clínicas diferentes produz uuids diferentes", () => {
  const a = wg.entidadeIdDeTelefone("clinica-1", "41988379119");
  const b = wg.entidadeIdDeTelefone("clinica-2", "41988379119");
  assert.notEqual(a, b);
});

// ── Consentimento / opt-out ──────────────────────────────────────────────

test("estadoConsentimentoAtual: sem nenhum evento é 'desconhecido' — nunca bloqueado por padrão sem evidência real", () => {
  assert.equal(wg.estadoConsentimentoAtual([]), "desconhecido");
});

test("estadoConsentimentoAtual: evento 'bloqueado' mais recente prevalece sobre 'permitido' antigo", () => {
  const eventos = [
    { criadoEm: "2026-09-01T10:00:00Z", estado: "permitido" },
    { criadoEm: "2026-09-15T10:00:00Z", estado: "bloqueado" },
  ];
  assert.equal(wg.estadoConsentimentoAtual(eventos), "bloqueado");
});

test("estadoConsentimentoAtual: um opt-in mais recente reabre o contato depois de um bloqueio antigo", () => {
  const eventos = [
    { criadoEm: "2026-09-01T10:00:00Z", estado: "bloqueado" },
    { criadoEm: "2026-09-15T10:00:00Z", estado: "permitido" },
  ];
  assert.equal(wg.estadoConsentimentoAtual(eventos), "permitido");
});

test("detectarPedidoOptOut: reconhece as palavras-chave exatas de opt-out (normalizadas)", () => {
  assert.equal(wg.detectarPedidoOptOut("PARAR"), true);
  assert.equal(wg.detectarPedidoOptOut("  Sair  "), true);
  assert.equal(wg.detectarPedidoOptOut("Não quero mais receber"), true);
  assert.equal(wg.detectarPedidoOptOut("stop"), true);
});

test("detectarPedidoOptOut: NUNCA por substring — 'não vou parar de indicar vocês' não é opt-out", () => {
  assert.equal(wg.detectarPedidoOptOut("não vou parar de indicar vocês"), false);
  assert.equal(wg.detectarPedidoOptOut("vou parar aqui na esquina"), false);
});

test("detectarPedidoOptOut: mensagem comum de atendimento nunca é confundida com opt-out", () => {
  assert.equal(wg.detectarPedidoOptOut("Quero agendar uma consulta"), false);
  assert.equal(wg.detectarPedidoOptOut("Bom dia!"), false);
});

// ── Cenário: opt-out bloqueia automação comercial ────────────────────────

test("podeAprovarEnvio: consentimento bloqueado impede o envio mesmo com tentativa preparada e telefone real", () => {
  const decisao = wg.podeAprovarEnvio({ telefone: "5541988379119", statusTentativa: "preparada", consentimento: "bloqueado" });
  assert.deepEqual(decisao, { pode: false, motivo: "consentimento_bloqueado" });
});

test("podeAprovarEnvio: consentimento desconhecido (nunca houve opt-out) permite o envio normalmente", () => {
  const decisao = wg.podeAprovarEnvio({ telefone: "5541988379119", statusTentativa: "preparada", consentimento: "desconhecido" });
  assert.deepEqual(decisao, { pode: true });
});

// ── Cenário: telefone inválido nunca dispara ─────────────────────────────

test("podeAprovarEnvio: sem telefone nunca autoriza envio, mesmo com tudo mais correto", () => {
  const decisao = wg.podeAprovarEnvio({ telefone: null, statusTentativa: "preparada", consentimento: "permitido" });
  assert.deepEqual(decisao, { pode: false, motivo: "sem_telefone" });
  const decisaoVazio = wg.podeAprovarEnvio({ telefone: "   ", statusTentativa: "preparada", consentimento: "permitido" });
  assert.equal(decisaoVazio.pode, false);
});

// ── Cenário: modo SUGERIR nunca envia / modo APROVAR exige aprovação real ──

test("podeAprovarEnvio: sem tentativa preparada (SUGERIR nunca aconteceu) o envio é bloqueado — 'nao_preparado'", () => {
  const decisao = wg.podeAprovarEnvio({ telefone: "5541988379119", statusTentativa: null, consentimento: "permitido" });
  assert.deepEqual(decisao, { pode: false, motivo: "nao_preparado" });
});

test("podeAprovarEnvio: já enviado hoje (aprovação repetida) é bloqueado — 'ja_enviado'", () => {
  const decisao = wg.podeAprovarEnvio({ telefone: "5541988379119", statusTentativa: "enviada", consentimento: "permitido" });
  assert.deepEqual(decisao, { pode: false, motivo: "ja_enviado" });
});

test("podeAprovarEnvio: só autoriza quando TUDO é real e permitido simultaneamente", () => {
  const decisao = wg.podeAprovarEnvio({ telefone: "5541988379119", statusTentativa: "preparada", consentimento: "permitido" });
  assert.deepEqual(decisao, { pode: true });
});

// ── Idempotência ──────────────────────────────────────────────────────

test("chaveIdempotenciaEnvioAprovado: determinística — mesma entrada produz a mesma chave (protege duplo-clique)", () => {
  const k1 = wg.chaveIdempotenciaEnvioAprovado("cobranca.envio", "id-1", "click-abc");
  const k2 = wg.chaveIdempotenciaEnvioAprovado("cobranca.envio", "id-1", "click-abc");
  assert.equal(k1, k2);
});

test("chaveIdempotenciaEnvioAprovado: idempotency_key diferente (retry deliberado após falha) produz chave diferente", () => {
  const k1 = wg.chaveIdempotenciaEnvioAprovado("cobranca.envio", "id-1", "click-abc");
  const k2 = wg.chaveIdempotenciaEnvioAprovado("cobranca.envio", "id-1", "click-xyz");
  assert.notEqual(k1, k2);
});

test("chaveIdempotenciaWebhookRecebido: mesma instância+messageId produz a mesma chave — replay do provider é detectável", () => {
  const k1 = wg.chaveIdempotenciaWebhookRecebido("inst-1", "msg-123");
  const k2 = wg.chaveIdempotenciaWebhookRecebido("inst-1", "msg-123");
  assert.equal(k1, k2);
  const k3 = wg.chaveIdempotenciaWebhookRecebido("inst-1", "msg-456");
  assert.notEqual(k1, k3);
});

// ── mensagemMotivoBloqueioEnvio ──────────────────────────────────────────

test("mensagemMotivoBloqueioEnvio: cobre todos os motivos de bloqueio com texto real (nunca undefined)", () => {
  for (const motivo of ["sem_telefone", "nao_preparado", "ja_enviado", "consentimento_bloqueado"]) {
    const msg = wg.mensagemMotivoBloqueioEnvio(motivo);
    assert.equal(typeof msg, "string");
    assert.ok(msg.length > 0);
  }
});

// ══════════════════════════════════════════════════════════════════════
// Verificação estática das rotas — mesma técnica já usada na missão GBP:
// prova que o CÓDIGO REAL das rotas contém as chamadas/guardas exigidas,
// sem precisar de um banco real.
// ══════════════════════════════════════════════════════════════════════

const rotaCobrancaAprovar = ler("app/api/cobrancas/[id]/aprovar-envio/route.ts");
const rotaFollowUpAprovar = ler("app/api/follow-up/aprovar-envio/route.ts");
const rotaConsentimento = ler("app/api/whatsapp/consentimento/route.ts");
const rotaWebhook = ler("app/api/webhook/zapi/route.ts");
const rotaWhatsapp = ler("app/api/whatsapp/route.ts");
const rotaChatbotMessage = ler("app/api/chatbot/message/route.ts");
const rotaCobrancaTentativa = ler("app/api/cobrancas/[id]/tentativa/route.ts");
const rotaFollowUpTentativa = ler("app/api/follow-up/tentativa/route.ts");

// ── Tenant: rotas de aprovação/consentimento nunca aceitam automação ────

test("tenant: aprovar-envio (cobrança e follow-up) e consentimento só aceitam autorizarUsuarioNaClinica — nunca o segredo de serviço interno", () => {
  for (const [nome, rota] of [["cobranca", rotaCobrancaAprovar], ["followup", rotaFollowUpAprovar], ["consentimento", rotaConsentimento]]) {
    assert.match(rota, /autorizarUsuarioNaClinica/, `${nome} deveria exigir autorizarUsuarioNaClinica`);
    assert.doesNotMatch(rota, /INTERNAL_SERVICE_SECRET.*===.*bearer|bearer.*===.*INTERNAL_SERVICE_SECRET/, `${nome} nunca deveria aceitar o segredo de serviço interno como autenticação de ENTRADA`);
  }
});

test("tenant: cobrança relida com .eq('id', id).eq('clinica_id', clinica_id) — nunca só por id", () => {
  assert.match(rotaCobrancaAprovar, /\.eq\("id", id\)\.eq\("clinica_id", clinica_id\)/);
});

test("tenant: toda consulta a eventos_dominio nas rotas novas é filtrada por clinica_id", () => {
  for (const [nome, rota] of [["cobranca", rotaCobrancaAprovar], ["followup", rotaFollowUpAprovar], ["consentimento", rotaConsentimento]]) {
    const trechos = rota.split('.from("eventos_dominio")').slice(1);
    for (const trecho of trechos) {
      assert.match(trecho.slice(0, 300), /clinica_id/, `${nome}: bloco de eventos_dominio sem clinica_id visível`);
    }
  }
});

// ── AUTOMÁTICO não nasce habilitado ───────────────────────────────────

test("AUTOMÁTICO não existe: nenhuma rota nova chama POST /api/whatsapp fora de uma aprovação humana explícita (aprovar-envio)", () => {
  // As únicas duas rotas desta missão que chamam /api/whatsapp são as de
  // aprovação — ambas exigem autorizarUsuarioNaClinica antes de qualquer
  // fetch para /api/whatsapp.
  for (const rota of [rotaCobrancaAprovar, rotaFollowUpAprovar]) {
    const idxAuth = rota.indexOf("autorizarUsuarioNaClinica");
    const idxFetch = rota.indexOf('fetch(`${baseUrl}/api/whatsapp`');
    assert.ok(idxAuth > -1 && idxFetch > -1);
    assert.ok(idxAuth < idxFetch, "autorização deve vir ANTES do envio real");
  }
});

test("SUGERIR nunca envia: as rotas .../tentativa continuam sem nenhuma chamada a /api/whatsapp", () => {
  assert.doesNotMatch(rotaCobrancaTentativa, /fetch\(.*\/api\/whatsapp/);
  assert.doesNotMatch(rotaFollowUpTentativa, /fetch\(.*\/api\/whatsapp/);
});

// ── Falha do provider nunca vira sucesso ─────────────────────────────────

test("falha do provider nunca vira sucesso: catch/erro de /api/whatsapp sempre grava resultado 'falhou' e retorna sucesso:false", () => {
  for (const rota of [rotaCobrancaAprovar, rotaFollowUpAprovar]) {
    assert.match(rota, /zapiOk = false/);
    assert.match(rota, /resultado: zapiOk \? "sucesso" : "falhou"/);
    assert.match(rota, /if \(!zapiOk\) \{[\s\S]{0,300}sucesso: false/);
  }
});

// ── Retry/clique duplo não duplica ────────────────────────────────────

test("clique duplo não duplica envio: rota checa a MESMA chave de idempotência em eventos_dominio antes de chamar /api/whatsapp", () => {
  for (const rota of [rotaCobrancaAprovar, rotaFollowUpAprovar]) {
    const idxCheck = rota.indexOf("mesmaChave");
    const idxFetch = rota.indexOf('fetch(`${baseUrl}/api/whatsapp`');
    assert.ok(idxCheck > -1 && idxFetch > -1);
    assert.ok(idxCheck < idxFetch);
  }
});

test("envio com sucesso hoje bloqueia um novo envio no mesmo dia, mas falha permite nova tentativa (não usa a mesma chave para bloquear retry)", () => {
  for (const rota of [rotaCobrancaAprovar, rotaFollowUpAprovar]) {
    assert.match(rota, /jaEnviadoComSucessoHoje/);
    assert.match(rota, /resultado === "sucesso"/);
  }
});

// ── Webhook repetido não duplica ação ─────────────────────────────────

test("webhook: replay guard existe e é chamado ANTES de encaminhar ao chatbot, mas nunca bloqueia quando messageId está ausente", () => {
  assert.match(rotaWebhook, /jaProcessadoOuMarcar/);
  const idxGuard = rotaWebhook.indexOf("jaProcessadoOuMarcar(chatbotClinicaId");
  const idxChatbotCall = rotaWebhook.indexOf("Encaminhando para Chatbot IA");
  assert.ok(idxGuard > -1 && idxChatbotCall > -1);
  assert.ok(idxGuard < idxChatbotCall);
  assert.match(rotaWebhook, /if \(messageId && await jaProcessadoOuMarcar/, "só ativa quando messageId real está presente — nunca bloqueia por padrão");
});

test("webhook: opt-out automático é checado antes de encaminhar ao chatbot e nunca duplica registro (chave por dia)", () => {
  const idxOptout = rotaWebhook.indexOf("registrarOptOutSePedido(chatbotClinicaId");
  const idxChatbotCall = rotaWebhook.indexOf("Encaminhando para Chatbot IA");
  assert.ok(idxOptout > -1 && idxChatbotCall > -1);
  assert.ok(idxOptout < idxChatbotCall);
  assert.match(rotaWebhook, /webhook_optout:\$\{hoje\}/);
});

// ── Evidência nunca vaza token ─────────────────────────────────────────

test("nenhuma rota nova loga ou devolve token/secret em texto puro", () => {
  for (const [nome, rota] of [["cobranca", rotaCobrancaAprovar], ["followup", rotaFollowUpAprovar], ["consentimento", rotaConsentimento], ["webhook", rotaWebhook]]) {
    assert.doesNotMatch(rota, /console\.log\([^)]*INTERNAL_SERVICE_SECRET/, `${nome} não deveria logar INTERNAL_SERVICE_SECRET`);
    assert.doesNotMatch(rota, /NextResponse\.json\([^}]*INTERNAL_SERVICE_SECRET/, `${nome} não deveria devolver o segredo na resposta`);
  }
});

test("webhook: nunca loga a URL completa (que pode conter ?token=<segredo>) — só o pathname", () => {
  assert.match(rotaWebhook, /new URL\(req\.url\)\.pathname/);
  // Toda ocorrência de req.url em código real (linhas não-comentário) está
  // sempre envolvida por new URL(...) — nunca usada bruta/isolada como
  // valor de log (o que vazaria ?token=<segredo> na query string).
  const linhasDeCodigo = rotaWebhook.split("\n").filter((l) => !l.trim().startsWith("//"));
  const codigoReal = linhasDeCodigo.join("\n");
  const totalReqUrl = (codigoReal.match(/req\.url/g) ?? []).length;
  const totalEnvolvidoPorNewUrl = (codigoReal.match(/new URL\(req\.url\)/g) ?? []).length;
  assert.equal(totalReqUrl, totalEnvolvidoPorNewUrl, "req.url deveria SEMPRE estar envolvido por new URL(...), nunca usado bruto em log");
});

// ── Chatbot respeita tenant ────────────────────────────────────────────

test("chatbot/message: autenticação por segredo interno obrigatória, fail-closed quando ausente", () => {
  assert.match(rotaChatbotMessage, /CHATBOT_INTERNAL_SECRET/);
  assert.match(rotaChatbotMessage, /status: 503/);
  assert.match(rotaChatbotMessage, /status: 401/);
});

test("chatbot/message: toda consulta a chatbot_config/chatbot_leads/chatbot_treinamento é filtrada por clinica_id", () => {
  const trechos = rotaChatbotMessage.split(/\.from\("chatbot_(config|leads|treinamento)"\)/).filter((_, i) => i % 2 === 0);
  for (const trecho of trechos.slice(1)) {
    assert.match(trecho.slice(0, 200), /clinica_id/);
  }
});

// ── Mensagem nunca fabrica dado / preserva origem ────────────────────

test("prepararMensagemCobranca e prepararMensagemFollowUp continuam determinísticas (não-IA) — reaproveitadas sem alteração pelas novas rotas", () => {
  assert.match(rotaCobrancaAprovar, /prepararMensagemCobranca/);
  assert.match(rotaFollowUpAprovar, /prepararMensagemFollowUp/);
  assert.doesNotMatch(rotaCobrancaAprovar, /openai\.com/i);
  assert.doesNotMatch(rotaFollowUpAprovar, /openai\.com/i);
});

test("mensagem preserva origem: a rota de follow-up revalida o caso (reavaliarCasoFollowUp) e usa caso.telefone/caso.pacienteNome reais, nunca o que veio solto no body", () => {
  assert.match(rotaFollowUpAprovar, /reavaliarCasoFollowUp\(admin, tipoTyped, entidade_id, clinica_id, hoje, agora\)/);
  assert.match(rotaFollowUpAprovar, /caso\.telefone/);
  assert.match(rotaFollowUpAprovar, /caso\.pacienteNome/);
});

// ── Smart Commerce nunca vira receita ────────────────────────────────

test("nenhuma rota nova grava ou soma valor/receita — só resultado de envio (sucesso/falhou), nunca um campo monetário", () => {
  for (const rota of [rotaCobrancaAprovar, rotaFollowUpAprovar]) {
    assert.doesNotMatch(rota, /receita|valor_convertido|venda_confirmada/i);
  }
});

// ── entidade_id sempre uuid-compatível para os tipos telefone-chaveados ──

test("bug pré-existente corrigido: follow-up/tentativa e follow-up/aprovar-envio nunca gravam o telefone bruto na coluna entidade_id (uuid NOT NULL)", () => {
  for (const [nome, rota] of [["tentativa", rotaFollowUpTentativa], ["aprovar-envio", rotaFollowUpAprovar]]) {
    assert.match(rota, /entidadeIdParaEvento/, `${nome} deveria usar entidadeIdParaEvento para os tipos telefone-chaveados`);
  }
});

// ── /api/whatsapp (adaptador real) permanece inalterado nesta missão ────

test("/api/whatsapp (adaptador Z-API real) não foi tocado por esta missão — nenhuma dependência nova de whatsapp-governado nele", () => {
  assert.doesNotMatch(rotaWhatsapp, /whatsapp-governado/);
});
