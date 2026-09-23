// AI Memory com Proveniência + Auditoria IA V1 — fecha dois buracos reais
// encontrados na auditoria (nenhum motor novo, nenhuma tabela nova):
//
// 1) Cobrador Digital (cobranca_atrasada) era o único domínio do Smart
//    Commerce com rota de tentativa (POST /api/cobrancas/[id]/tentativa)
//    e SEM instrumentação de Auditoria das Decisões, mesmo "cobrador-
//    digital" já constando no vocabulário conhecido de
//    lib/auditoria-decisoes.ts desde a missão original (nunca usado).
//
// 2) GET /api/memoria filtrava decisões só por paciente_id, mas o único
//    produtor real de auditoria.decisao (follow-up/tentativa) grava
//    cliente_id como TELEFONE normalizado (lib/follow-up-comercial.ts,
//    CasoFollowUp não tem pacienteId) — nenhuma decisão de follow-up
//    jamais aparecia em app/clientes/[id]/page.tsx (Cliente 360). Rastro
//    existia no banco, mas era invisível na única tela que o exibe.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

// ── 1) Cobrador Digital agora instrumentado ──────────────────────────────

test("cobrancas/tentativa: registra auditoria.decisao com o motor 'cobrador-digital' (agora usado de verdade)", () => {
  const codigo = ler("app/api/cobrancas/[id]/tentativa/route.ts");
  assert.match(codigo, /prepararRegistroAuditoria\(\{/);
  assert.match(codigo, /motor:\s*"cobrador-digital"/);
  assert.match(codigo, /tipoDecisao:\s*"cobranca_atrasada"/);
});

test("cobrancas/tentativa: auditoria acontece SOMENTE depois que a elegibilidade real já foi checada", () => {
  const codigo = ler("app/api/cobrancas/[id]/tentativa/route.ts");
  const idxElegibilidade = codigo.indexOf("elegivelParaTentativaCobranca(");
  const idxAuditoria = codigo.indexOf("prepararRegistroAuditoria(");
  assert.ok(idxElegibilidade > -1 && idxAuditoria > -1);
  assert.ok(idxElegibilidade < idxAuditoria, "auditoria deveria vir depois da checagem de elegibilidade");
});

test("cobrancas/tentativa: sinais de auditoria vêm de campos estruturados reais (dias/status), nunca da mensagem preparada", () => {
  const codigo = ler("app/api/cobrancas/[id]/tentativa/route.ts");
  const idxAuditoria = codigo.indexOf("sinaisUtilizados: [");
  const trecho = codigo.slice(idxAuditoria, idxAuditoria + 300);
  assert.match(trecho, /dias_atraso/);
  assert.match(trecho, /cobranca\.status/);
  assert.doesNotMatch(trecho, /mensagem\.texto/);
});

test("cobrancas/tentativa: falha ao gravar auditoria nunca bloqueia a tentativa real (best-effort, mesmo padrão do follow-up)", () => {
  const codigo = ler("app/api/cobrancas/[id]/tentativa/route.ts");
  const idxAuditoria = codigo.indexOf("if (registroAuditoria)");
  const idxTentativaInsert = codigo.indexOf('tipo: "cobranca.tentativa"');
  assert.ok(idxAuditoria > -1 && idxTentativaInsert > -1);
  const trecho = codigo.slice(idxAuditoria, idxTentativaInsert);
  assert.doesNotMatch(trecho, /return NextResponse\.json\(\{ sucesso: false/);
});

test("cobrancas/tentativa: usa paciente_id real quando disponível, telefone normalizado só como fallback — nunca fabrica identidade", () => {
  const codigo = ler("app/api/cobrancas/[id]/tentativa/route.ts");
  assert.match(codigo, /clienteId:\s*cobranca\.paciente_id \|\| \(cobranca\.paciente_telefone/);
});

// ── 2) /api/memoria: decisões keyed por telefone deixam de ficar invisíveis ──

test("/api/memoria GET: quando telefone é informado, casa auditoria.decisao por paciente_id OU telefone normalizado (nunca só paciente_id)", () => {
  const codigo = ler("app/api/memoria/route.ts");
  assert.match(codigo, /normalizarTelefone/);
  assert.match(codigo, /\.or\(`payload->>cliente_id\.eq\.\$\{paciente_id\},payload->>cliente_id\.eq\.\$\{telefoneNormalizado\}`\)/);
});

test("/api/memoria GET: sem telefone informado, continua compatível com o filtro antigo (só paciente_id)", () => {
  const codigo = ler("app/api/memoria/route.ts");
  assert.match(codigo, /decisoesQuery\.eq\("payload->>cliente_id", paciente_id\)/);
});

test("/api/memoria GET: memoria.fato continua filtrado só por paciente_id — POST sempre grava paciente_id real, nenhuma mudança necessária ali", () => {
  const codigo = ler("app/api/memoria/route.ts");
  assert.match(codigo, /\.eq\("payload->cliente->>pacienteId", paciente_id\)/);
});

test("Cliente 360: passa o telefone real do paciente já carregado para /api/memoria (mesmo dado, nenhuma consulta nova)", () => {
  const codigo = ler("app/clientes/[id]/page.tsx");
  assert.match(codigo, /paciente\.telefone \? `&telefone=\$\{encodeURIComponent\(paciente\.telefone\)\}` : ''/);
});

test("segurança: telefone continua passando por autorizarUsuarioNaClinica antes de qualquer consulta — nenhum bypass de tenant introduzido", () => {
  const codigo = ler("app/api/memoria/route.ts");
  const idxAuth = codigo.indexOf("autorizarUsuarioNaClinica(req, clinica_id)");
  const idxOr = codigo.indexOf(".or(`payload->>cliente_id");
  assert.ok(idxAuth > -1 && idxOr > -1);
  assert.ok(idxAuth < idxOr, "autorização de tenant deveria vir antes de qualquer consulta a eventos_dominio");
});
