// Contador IA · Fechamento Inteligente — continuação: fluxo operacional
// completo (recebimento -> identificação -> baixa -> cobrança só do que
// falta -> exceções por cliente). Prova o ciclo exigido:
// DOCUMENTO CHEGA -> CLASSIFICADO/VALIDADO OU REVISÃO -> PENDÊNCIA
// CORRETA RESOLVIDA -> PRONTIDÃO MUDA -> SÓ O QUE FALTA CONTINUA
// COBRÁVEL -> COMPLETO = PRONTO.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/fechamento-contabil-fluxo.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const {
  calcularFechamentoCliente, pendenciasCobraveis, gerarMensagemCobrancaFechamento, nomesEfetivos,
} = await import(pathToFileURL(path.join(buildDir, "fechamento-contabil.js")));
const { classificarArquivo } = await import(pathToFileURL(path.join(buildDir, "fechamento-identificacao.js")));

const cliente = { id: "cli-1", nome: "Empresa ABC" };
const tiposPadrao = [
  { nome: "Extrato bancário", obrigatorio: true, ativo: true },
  { nome: "Notas fiscais", obrigatorio: true, ativo: true },
  { nome: "Folha", obrigatorio: true, ativo: true },
  { nome: "Comprovantes", obrigatorio: true, ativo: true },
];
const nomesConhecidos = tiposPadrao.map((t) => t.nome);

// ── 1) Identificação: tipo + competência corretos -> confiança alta ─────

test("identificação: nome de arquivo com tipo e competência corretos -> confiança alta, nunca precisa de revisão", () => {
  const r = classificarArquivo({ nomeArquivo: "extrato-bancario-2026-09.pdf", competenciaAlvo: "2026-09" }, nomesConhecidos);
  assert.equal(r.tipoDocumentoSugerido, "Extrato bancário");
  assert.equal(r.confianca, "alta");
  assert.equal(r.necessitaRevisao, false);
});

test("identificação: tipo reconhecido sem nenhuma competência no nome -> ainda confiança alta (nada contradiz o contexto do upload)", () => {
  const r = classificarArquivo({ nomeArquivo: "comprovante_pagamento.pdf", competenciaAlvo: "2026-09" }, nomesConhecidos);
  assert.equal(r.tipoDocumentoSugerido, "Comprovantes");
  assert.equal(r.confianca, "alta");
});

// ── 2) Competência errada no nome NUNCA resolve automaticamente ─────────

test("identificação: nome indica competência DIFERENTE da competência alvo -> revisão necessária, nunca baixa automática", () => {
  const r = classificarArquivo({ nomeArquivo: "folha-2026-08.pdf", competenciaAlvo: "2026-09" }, nomesConhecidos);
  assert.equal(r.tipoDocumentoSugerido, "Folha");
  assert.equal(r.competenciaDetectada, "2026-08");
  assert.equal(r.necessitaRevisao, true);
  assert.notEqual(r.confianca, "alta");
});

// ── 3) Documento incerto (tipo não reconhecido/ambíguo) vai para revisão ─

test("identificação: nome sem nenhum tipo reconhecido -> revisão necessária, nunca inventa um tipo", () => {
  const r = classificarArquivo({ nomeArquivo: "arquivo_qualquer_123.pdf", competenciaAlvo: "2026-09" }, nomesConhecidos);
  assert.equal(r.tipoDocumentoSugerido, null);
  assert.equal(r.necessitaRevisao, true);
});

test("identificação: nome que casa com MAIS DE UM tipo conhecido -> ambíguo, revisão necessária, nunca escolhe arbitrariamente", () => {
  const r = classificarArquivo({ nomeArquivo: "extrato-notas-fiscais.pdf", competenciaAlvo: "2026-09" }, nomesConhecidos);
  assert.equal(r.tipoDocumentoSugerido, null);
  assert.equal(r.necessitaRevisao, true);
});

test("identificação nunca inventa dado: sem NENHUM tipo conhecido configurado, tudo vira revisão — jamais sugere um tipo fora da lista", () => {
  const r = classificarArquivo({ nomeArquivo: "extrato-bancario-2026-09.pdf", competenciaAlvo: "2026-09" }, []);
  assert.equal(r.tipoDocumentoSugerido, null);
  assert.equal(r.necessitaRevisao, true);
});

test("identificação é determinística: mesma entrada duas vezes produz exatamente o mesmo resultado", () => {
  const entrada = { nomeArquivo: "folha-set-2026.pdf", competenciaAlvo: "2026-09" };
  assert.deepEqual(classificarArquivo(entrada, nomesConhecidos), classificarArquivo(entrada, nomesConhecidos));
});

// ── 4) Pendências cobráveis nunca incluem item resolvido ou em revisão ──

test("cobrança: pendenciasCobraveis nunca inclui item 'recebido' — documento resolvido nunca é cobrado de novo", () => {
  const checklist = [
    { tipoDocumento: "Extrato bancário", status: "recebido", atualizadoEm: null },
    { tipoDocumento: "Folha", status: "pendente", atualizadoEm: null },
  ];
  assert.deepEqual(pendenciasCobraveis(checklist), ["Folha"]);
});

test("cobrança: pendenciasCobraveis nunca inclui item 'revisao_necessaria' — quem precisa agir ali é o contador, não o cliente", () => {
  const checklist = [
    { tipoDocumento: "Extrato bancário", status: "revisao_necessaria", atualizadoEm: null },
    { tipoDocumento: "Folha", status: "pendente", atualizadoEm: null },
  ];
  assert.deepEqual(pendenciasCobraveis(checklist), ["Folha"]);
});

test("cobrança: item 'invalido' continua cobrável (cliente precisa reenviar)", () => {
  const checklist = [{ tipoDocumento: "Comprovantes", status: "invalido", atualizadoEm: null }];
  assert.deepEqual(pendenciasCobraveis(checklist), ["Comprovantes"]);
});

test("mensagem de cobrança cita SOMENTE o que falta, nunca reafirma item já recebido", () => {
  const msg = gerarMensagemCobrancaFechamento("Empresa ABC", "2026-09", ["Comprovantes"]);
  assert.match(msg, /Comprovantes/);
  assert.doesNotMatch(msg, /Extrato bancário|Notas fiscais|Folha/);
});

// ── 5) Cliente completo (tudo recebido) fica PRONTO ──────────────────────

test("cliente com todos os itens recebidos fica PRONTO, 100%, nenhuma pendência cobrável", () => {
  const documentos = tiposPadrao.map((t) => ({ clienteId: "cli-1", tipoDocumento: t.nome, status: "recebido" }));
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.equal(r.status, "pronto");
  assert.equal(r.percentual, 100);
  assert.deepEqual(pendenciasCobraveis(r.checklist), []);
});

// ── Precedência de status com revisão necessária ─────────────────────────

test("um item em revisão (sem nenhum inválido) -> cliente fica REVISÃO NECESSÁRIA, nunca PENDENTE nem PRONTO", () => {
  const documentos = [
    { clienteId: "cli-1", tipoDocumento: "Extrato bancário", status: "recebido" },
    { clienteId: "cli-1", tipoDocumento: "Notas fiscais", status: "revisao_necessaria" },
    { clienteId: "cli-1", tipoDocumento: "Folha", status: "recebido" },
    { clienteId: "cli-1", tipoDocumento: "Comprovantes", status: "recebido" },
  ];
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.equal(r.status, "revisao_necessaria");
  assert.deepEqual(r.emRevisao, ["Notas fiscais"]);
});

test("inválido sempre vence revisão necessária na precedência — bloqueado é o estado mais severo", () => {
  const documentos = [
    { clienteId: "cli-1", tipoDocumento: "Extrato bancário", status: "invalido" },
    { clienteId: "cli-1", tipoDocumento: "Notas fiscais", status: "revisao_necessaria" },
  ];
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.equal(r.status, "bloqueado");
});

test("próxima ação é sempre concreta e nunca genérica quando há algo a fazer", () => {
  const documentos = [{ clienteId: "cli-1", tipoDocumento: "Extrato bancário", status: "recebido" }];
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.match(r.proximaAcao, /Cobrar:.*Notas fiscais/);
});

test("última atualização reflete o item mais recente do checklist, nunca a data de hoje fabricada", () => {
  const documentos = [
    { clienteId: "cli-1", tipoDocumento: "Extrato bancário", status: "recebido", atualizadoEm: "2026-09-10T10:00:00.000Z" },
    { clienteId: "cli-1", tipoDocumento: "Folha", status: "recebido", atualizadoEm: "2026-09-15T10:00:00.000Z" },
  ];
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.equal(r.ultimaAtualizacao, "2026-09-15T10:00:00.000Z");
});

// ── 7) Override por cliente: padrão da clínica + exceções pontuais ──────

test("override: cliente sem exceção usa exatamente o padrão da clínica", () => {
  assert.deepEqual(nomesEfetivos("cli-1", tiposPadrao, []).sort(), tiposPadrao.map((t) => t.nome).sort());
});

test("override: exceção incluido:false remove um tipo padrão SÓ deste cliente — outros clientes continuam exigindo", () => {
  const excecoes = [{ clienteId: "cli-1", tipoDocumento: "Folha", incluido: false }];
  const nomesA = nomesEfetivos("cli-1", tiposPadrao, excecoes);
  const nomesB = nomesEfetivos("cli-2", tiposPadrao, excecoes);
  assert.ok(!nomesA.includes("Folha"));
  assert.ok(nomesB.includes("Folha"));
});

test("override: exceção incluido:true adiciona um tipo extra só para este cliente, mesmo que não seja padrão da clínica", () => {
  const tiposSemExtra = tiposPadrao; // "Contrato social" nunca é padrão da clínica
  const excecoes = [{ clienteId: "cli-1", tipoDocumento: "Contrato social", incluido: true }];
  const nomes = nomesEfetivos("cli-1", tiposSemExtra, excecoes);
  assert.ok(nomes.includes("Contrato social"));
});

test("override reflete no cálculo de prontidão: cliente sem 'Folha' fica PRONTO com só os outros 3 recebidos", () => {
  const excecoes = [{ clienteId: "cli-1", tipoDocumento: "Folha", incluido: false }];
  const documentos = [
    { clienteId: "cli-1", tipoDocumento: "Extrato bancário", status: "recebido" },
    { clienteId: "cli-1", tipoDocumento: "Notas fiscais", status: "recebido" },
    { clienteId: "cli-1", tipoDocumento: "Comprovantes", status: "recebido" },
  ];
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos, excecoes);
  assert.equal(r.status, "pronto");
  assert.equal(r.checklist.length, 3);
});

// ── Wiring real: upload/identificação/baixa automática ───────────────────

test("wiring: upload só dá baixa automática (recebido) quando a identificação NÃO precisa de revisão", () => {
  const codigo = ler("app/api/fechamento/documento/upload/route.ts");
  assert.match(codigo, /classificacao\.confianca === "alta" && !classificacao\.necessitaRevisao/);
  assert.match(codigo, /status: autoConfirmado \? "recebido" : "revisao_necessaria"/);
});

test("wiring: upload nunca usa um tipo fora do checklist efetivo do cliente (nomesEfetivos alimenta o classificador)", () => {
  const codigo = ler("app/api/fechamento/documento/upload/route.ts");
  assert.match(codigo, /nomesEfetivos\(cliente_id, tipos, excecoes\)/);
  assert.match(codigo, /classificarArquivo\(\{ nomeArquivo: file\.name, competenciaAlvo: competencia \}, tiposConhecidos\)/);
});

test("wiring: bucket de documentos é privado — nunca public:true (documento contábil não pode ter URL pública)", () => {
  const codigo = ler("app/api/fechamento/documento/upload/route.ts");
  assert.match(codigo, /createBucket\(BUCKET,\s*\{\s*public:\s*false/);
});

test("wiring: upload exige autorização E confere que o cliente pertence à mesma clínica antes de qualquer upload real", () => {
  const codigo = ler("app/api/fechamento/documento/upload/route.ts");
  const idxAuth = codigo.indexOf("autorizarUsuarioNaClinica(req, clinica_id)");
  const idxCliente = codigo.indexOf('.from("pacientes")');
  const idxUpload = codigo.indexOf(".storage.from(BUCKET).upload(");
  assert.ok(idxAuth > -1 && idxCliente > -1 && idxUpload > -1);
  assert.ok(idxAuth < idxCliente && idxCliente < idxUpload);
});

test("wiring: confirmar rejeita um arquivo que não está mais 'pendente_confirmacao' — nunca confirma duas vezes (idempotência)", () => {
  const codigo = ler("app/api/fechamento/documento/confirmar/route.ts");
  assert.match(codigo, /classificacao_status !== "pendente_confirmacao"/);
  assert.match(codigo, /status.*409|409.*status/s);
});

test("wiring: arquivo GET assinado sempre reconfirma clinica_id antes de gerar a URL — nunca serve outro tenant", () => {
  const codigo = ler("app/api/fechamento/documento/arquivo/[id]/route.ts");
  const idxAuth = codigo.indexOf("autorizarUsuarioNaClinica(req, clinica_id)");
  const idxSigned = codigo.indexOf("createSignedUrl(");
  assert.ok(idxAuth > -1 && idxSigned > -1 && idxAuth < idxSigned);
});

// ── Wiring: cobrança reaproveita 100% o WhatsApp Governado existente ─────

test("wiring: cobrança de fechamento reaproveita lib/whatsapp-governado.ts (consentimento/idempotência) — nenhum motor de envio novo", () => {
  const codigo = ler("app/api/fechamento/cobranca/aprovar-envio/route.ts");
  assert.match(codigo, /from ".*whatsapp-governado"/);
  assert.match(codigo, /podeAprovarEnvio\(/);
  assert.match(codigo, /estadoConsentimentoAtual\(/);
});

test("wiring: cobrança de fechamento envia pelo MESMO adaptador real (POST /api/whatsapp) — nunca um segundo cliente Z-API", () => {
  const codigo = ler("app/api/fechamento/cobranca/aprovar-envio/route.ts");
  assert.match(codigo, /\/api\/whatsapp/);
});

test("wiring: aprovar-envio SEMPRE recalcula a prontidão fresca antes de decidir — nunca cobra o que já foi resolvido desde a tentativa", () => {
  const codigo = ler("app/api/fechamento/cobranca/aprovar-envio/route.ts");
  const idx = codigo.indexOf("pendencias.length === 0");
  assert.ok(idx > -1);
  assert.match(codigo.slice(0, idx), /calcularFechamentoCliente\(/);
});

test("wiring: tentativa de cobrança rejeita cliente sem nenhuma pendência cobrável (já pronto)", () => {
  const codigo = ler("app/api/fechamento/cobranca/tentativa/route.ts");
  assert.match(codigo, /pendencias\.length === 0/);
});

test("wiring: cobrança de fechamento registra Auditoria das Decisões com o motor 'fechamento-contabil' (motor conhecido reaproveitado, não um novo sistema de auditoria)", () => {
  const codigo = ler("app/api/fechamento/cobranca/tentativa/route.ts");
  assert.match(codigo, /motor:\s*"fechamento-contabil"/);
  const auditoria = ler("lib/auditoria-decisoes.ts");
  assert.match(auditoria, /"fechamento-contabil"/);
});

test("wiring: idempotência de tentativa de cobrança é por dia (mesmo cliente/competência não gera duas tentativas no mesmo dia)", () => {
  const codigo = ler("app/api/fechamento/cobranca/tentativa/route.ts");
  assert.match(codigo, /fechamento\.cobranca_tentativa:\$\{competencia\}:\$\{hoje\}/);
});

// ── Isolamento de tenant nas novas rotas ─────────────────────────────────

test("wiring: todas as novas rotas de fechamento exigem autorizarUsuarioNaClinica", () => {
  for (const arquivo of [
    "app/api/fechamento/documento/upload/route.ts",
    "app/api/fechamento/documento/confirmar/route.ts",
    "app/api/fechamento/documento/arquivo/route.ts",
    "app/api/fechamento/documento/arquivo/[id]/route.ts",
    "app/api/fechamento/excecoes/route.ts",
    "app/api/fechamento/cobranca/tentativa/route.ts",
    "app/api/fechamento/cobranca/aprovar-envio/route.ts",
  ]) {
    const codigo = ler(arquivo);
    assert.match(codigo, /autorizarUsuarioNaClinica\(/, `${arquivo} deveria autorizar antes de qualquer consulta`);
  }
});

test("wiring: exceções sempre confirmam que o cliente pertence à clínica antes de gravar", () => {
  const codigo = ler("app/api/fechamento/excecoes/route.ts");
  const trechoPost = codigo.slice(codigo.indexOf("export async function POST"));
  const idxCliente = trechoPost.indexOf('.from("pacientes")');
  const idxUpsert = trechoPost.indexOf('.from("fechamento_excecoes_cliente")');
  assert.ok(idxCliente > -1 && idxUpsert > -1 && idxCliente < idxUpsert);
});

test("Contador IA (fluxo v2) continua sem depender do motor comercial — nenhum import de nucleo-inteligente/ia-comercial/gerente-comercial/oportunidades-clientes", () => {
  for (const arquivo of [
    "lib/fechamento-identificacao.ts",
    "app/api/fechamento/documento/upload/route.ts",
    "app/api/fechamento/cobranca/tentativa/route.ts",
    "app/api/fechamento/cobranca/aprovar-envio/route.ts",
  ]) {
    const codigo = ler(arquivo);
    assert.doesNotMatch(codigo, /^import[^\n]*(nucleo-inteligente|ia-comercial|gerente-comercial|oportunidades-clientes)/m, `${arquivo} não deveria depender do motor comercial`);
  }
});
