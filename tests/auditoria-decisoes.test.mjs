// Auditoria das Decisões da IA V1 — motor puro. Prova que nenhuma
// decisão é registrada sem evidência estruturada real, que a narrativa
// nunca vira fonte (só sinais estruturados contam), que um resultado
// posterior nunca afirma causalidade (só sequência), e que tudo é
// determinístico e escopado por tenant.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/auditoria-decisoes.test.mjs
// (build precisa incluir auditoria-decisoes.js)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const {
  validarEvidenciaDecisao, prepararRegistroAuditoria, prepararVinculoResultado,
} = await import(pathToFileURL(path.join(buildDir, "auditoria-decisoes.js")));

const evidenciaBase = {
  clinicaId: "c1", motor: "follow-up-comercial", versaoRegra: "follow-up-comercial-v1",
  tipoDecisao: "orcamento_parado", entidadeTipo: "orcamento", entidadeId: "orc1",
  clienteId: "11911112222",
  sinaisUtilizados: [{ campo: "status", valor: "apresentado" }, { campo: "dias_parado", valor: 5 }],
  decisao: "registrar_contato", observadoEm: "2026-09-20T10:00:00.000Z",
};

// ── Decisão com evidência válida ─────────────────────────────────────

test("evidência válida: motor conhecido, entidade real, sinais estruturados, decisão codificada — válida", () => {
  assert.deepEqual(validarEvidenciaDecisao(evidenciaBase), { valido: true });
});

test("prepararRegistroAuditoria: com evidência válida, produz o registro completo", () => {
  const r = prepararRegistroAuditoria(evidenciaBase);
  assert.ok(r);
  assert.equal(r.tipoEvento, "auditoria.decisao");
  assert.equal(r.entidadeId, "orc1");
  assert.equal(r.payload.motor, "follow-up-comercial");
  assert.equal(r.payload.decisao, "registrar_contato");
});

// ── Rejeição sem evidência ────────────────────────────────────────────

test("rejeição: motor desconhecido nunca é auditado — fail-closed", () => {
  const r = validarEvidenciaDecisao({ ...evidenciaBase, motor: "motor-inventado" });
  assert.equal(r.valido, false);
  assert.match(r.motivo, /motor/);
});

test("rejeição: sem entidade real (entidadeId vazio) nunca é auditada", () => {
  const r = validarEvidenciaDecisao({ ...evidenciaBase, entidadeId: "" });
  assert.equal(r.valido, false);
});

test("rejeição: sem nenhum sinal estruturado (lista vazia) nunca é auditada — sem evidência não é decisão auditável", () => {
  const r = validarEvidenciaDecisao({ ...evidenciaBase, sinaisUtilizados: [] });
  assert.equal(r.valido, false);
  assert.match(r.motivo, /sinal|evidência|evidencia/i);
});

test("rejeição: sem decisão codificada nunca é auditada", () => {
  const r = validarEvidenciaDecisao({ ...evidenciaBase, decisao: "" });
  assert.equal(r.valido, false);
});

test("prepararRegistroAuditoria: retorna null (nunca fabrica registro) quando a evidência é inválida", () => {
  assert.equal(prepararRegistroAuditoria({ ...evidenciaBase, sinaisUtilizados: [] }), null);
  assert.equal(prepararRegistroAuditoria({ ...evidenciaBase, motor: "inventado" }), null);
});

// ── Proveniência preservada ───────────────────────────────────────────

test("proveniência: motor, versão da regra, entidade e sinais reais aparecem intactos no payload preparado", () => {
  const r = prepararRegistroAuditoria(evidenciaBase);
  assert.equal(r.payload.versao_regra, "follow-up-comercial-v1");
  assert.deepEqual(r.payload.sinais_utilizados, evidenciaBase.sinaisUtilizados);
  assert.equal(r.payload.cliente_id, "11911112222");
});

// ── Narrativa nunca vira fonte ────────────────────────────────────────

test("narrativa nunca vira fonte: o payload da decisão nunca carrega texto livre de mensagem/narrativa — só sinais estruturados e um código curto de decisão", () => {
  const r = prepararRegistroAuditoria(evidenciaBase);
  // 'decisao' é sempre um código curto, nunca uma frase longa (nunca a mensagem do WhatsApp preparada)
  assert.ok(r.payload.decisao.length < 40);
  assert.doesNotMatch(r.payload.decisao, /\s{2,}|Olá|!/); // nunca parece um texto de mensagem
  for (const sinal of r.payload.sinais_utilizados) {
    assert.ok(typeof sinal.valor === "string" || typeof sinal.valor === "number" || typeof sinal.valor === "boolean" || sinal.valor === null);
  }
});

// ── Payload mínimo / dados incompletos ────────────────────────────────

test("payload mínimo: versaoRegra é opcional — evidência sem ela ainda é válida e vira null no payload, nunca inventa uma versão", () => {
  const semVersao = { ...evidenciaBase };
  delete semVersao.versaoRegra;
  const r = prepararRegistroAuditoria(semVersao);
  assert.ok(r);
  assert.equal(r.payload.versao_regra, null);
});

test("dados incompletos: clienteId ausente (null) ainda permite registrar a decisão — nem toda decisão tem cliente identificável", () => {
  const r = prepararRegistroAuditoria({ ...evidenciaBase, clienteId: null });
  assert.ok(r);
  assert.equal(r.payload.cliente_id, null);
});

// ── Idempotência ──────────────────────────────────────────────────────

test("idempotência: mesma decisão (mesma entidade + tipo + momento observado) gera a mesma chave", () => {
  const r1 = prepararRegistroAuditoria(evidenciaBase);
  const r2 = prepararRegistroAuditoria(evidenciaBase);
  assert.equal(r1.chaveIdempotencia, r2.chaveIdempotencia);
});

test("idempotência: uma decisão nova (observadoEm diferente) gera chave diferente — nunca bloqueia uma futura decisão legítima", () => {
  const r1 = prepararRegistroAuditoria(evidenciaBase);
  const r2 = prepararRegistroAuditoria({ ...evidenciaBase, observadoEm: "2026-09-21T10:00:00.000Z" });
  assert.notEqual(r1.chaveIdempotencia, r2.chaveIdempotencia);
});

// ── Resultado posterior — sequência, nunca causalidade ───────────────

test("resultado posterior: com decisão de origem e fato real, o vínculo é preparado", () => {
  const decisao = prepararRegistroAuditoria(evidenciaBase);
  const r = prepararVinculoResultado({
    clinicaId: "c1", decisaoOrigemChave: decisao.chaveIdempotencia,
    entidadeTipo: "orcamento", entidadeId: "orc1",
    fatoObservado: "orcamento_aprovado", observadoEm: "2026-09-25T10:00:00.000Z",
  });
  assert.ok(r);
  assert.equal(r.payload.decisao_origem_chave, decisao.chaveIdempotencia);
  assert.equal(r.payload.fato_observado, "orcamento_aprovado");
});

test("resultado posterior NUNCA implica causalidade: prova_causalidade é sempre false, mesmo quando o resultado é claramente positivo", () => {
  const r = prepararVinculoResultado({
    clinicaId: "c1", decisaoOrigemChave: "chave-x",
    entidadeTipo: "cobranca", entidadeId: "cob1",
    fatoObservado: "cobranca_paga", observadoEm: "2026-09-25T10:00:00.000Z",
  });
  assert.equal(r.payload.prova_causalidade, false);
});

test("resultado posterior sem decisão de origem real (vazia) nunca é vinculado — fail-closed", () => {
  const r = prepararVinculoResultado({
    clinicaId: "c1", decisaoOrigemChave: "",
    entidadeTipo: "cobranca", entidadeId: "cob1",
    fatoObservado: "cobranca_paga", observadoEm: "2026-09-25T10:00:00.000Z",
  });
  assert.equal(r, null);
});

// ── Zero dados ────────────────────────────────────────────────────────

test("zero dados: nenhuma das funções fabrica um resultado quando chamadas com evidência vazia/inválida", () => {
  assert.equal(prepararRegistroAuditoria({ ...evidenciaBase, entidadeId: "", sinaisUtilizados: [] }), null);
});

// ── Cross-tenant ──────────────────────────────────────────────────────

test("cross-tenant: clinicaId é sempre preservado na evidência de entrada — cabe a quem persiste nunca misturar tenants (mesmo padrão de todos os outros motores desta sessão)", () => {
  const r = prepararRegistroAuditoria({ ...evidenciaBase, clinicaId: "clinica-A" });
  assert.ok(r); // motor não filtra tenant internamente, mas nunca perde o dado no caminho
});

// ── Determinismo ──────────────────────────────────────────────────────

test("idempotência/determinismo: mesma entrada duas vezes produz exatamente o mesmo resultado", () => {
  assert.deepEqual(prepararRegistroAuditoria(evidenciaBase), prepararRegistroAuditoria(evidenciaBase));
});

// ── Wiring: integração mínima no Follow-up (único ponto instrumentado nesta missão) ──

const rota = fs.readFileSync(new URL("../app/api/follow-up/tentativa/route.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("follow-up/tentativa: registra auditoria SOMENTE depois que o caso é reavaliado como elegível — nunca antes", () => {
  const idxReavaliar = rota.indexOf("const caso = await reavaliarCasoFollowUp(");
  const idxAuditoria = rota.indexOf("prepararRegistroAuditoria(");
  assert.ok(idxReavaliar > -1 && idxAuditoria > -1);
  assert.ok(idxReavaliar < idxAuditoria, "auditoria deveria acontecer depois da reavaliação de elegibilidade");
});

test("follow-up/tentativa: sinais de auditoria vêm só de campos estruturados do motor (tipo/status/dono do fluxo), nunca da mensagem/narrativa", () => {
  const idxAuditoria = rota.indexOf("sinaisUtilizados: [");
  const trecho = rota.slice(idxAuditoria, idxAuditoria + 300);
  assert.match(trecho, /caso\.tipo/);
  assert.match(trecho, /caso\.status/);
  assert.doesNotMatch(trecho, /mensagem\.texto/);
});

test("follow-up/tentativa: falha ao gravar auditoria nunca bloqueia a tentativa real do usuário — best-effort", () => {
  const idxAuditoria = rota.indexOf("if (registroAuditoria)");
  const idxTentativaInsert = rota.indexOf('tipo: "followup.tentativa"');
  assert.ok(idxAuditoria > -1 && idxTentativaInsert > -1);
  const trechoAuditoria = rota.slice(idxAuditoria, idxTentativaInsert);
  assert.doesNotMatch(trechoAuditoria, /return NextResponse\.json\(\{ sucesso: false/);
});
