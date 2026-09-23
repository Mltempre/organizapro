// Contador IA · Fechamento Inteligente V1 — motor puro (prontidão de
// fechamento por cliente/competência) + wiring das rotas reais.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/fechamento-contabil.test.mjs
// (build precisa incluir fechamento-contabil.js)

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
  calcularFechamentoCliente, gerarResumoFechamento, competenciaValida,
} = await import(pathToFileURL(path.join(buildDir, "fechamento-contabil.js")));

const cliente = { id: "cli-1", nome: "Empresa ABC" };

const tiposPadrao = [
  { nome: "Extrato bancário", obrigatorio: true, ativo: true },
  { nome: "Notas fiscais", obrigatorio: true, ativo: true },
  { nome: "Folha", obrigatorio: true, ativo: true },
  { nome: "Comprovantes", obrigatorio: true, ativo: true },
];

// ── Checklist e prontidão ─────────────────────────────────────────────

test("zero documentos registrados: tudo pendente, 0%, status PENDENTE — nunca fabrica um 'recebido'", () => {
  const r = calcularFechamentoCliente(cliente, tiposPadrao, []);
  assert.equal(r.percentual, 0);
  assert.equal(r.status, "pendente");
  assert.deepEqual(r.faltando.sort(), ["Comprovantes", "Extrato bancário", "Folha", "Notas fiscais"]);
});

test("exemplo da missão: 3 de 4 recebidos, 1 pendente -> 75%, PENDENTE, falta só 'Comprovantes'", () => {
  const documentos = [
    { clienteId: "cli-1", tipoDocumento: "Extrato bancário", status: "recebido" },
    { clienteId: "cli-1", tipoDocumento: "Notas fiscais", status: "recebido" },
    { clienteId: "cli-1", tipoDocumento: "Folha", status: "recebido" },
  ];
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.equal(r.percentual, 75);
  assert.equal(r.status, "pendente");
  assert.deepEqual(r.faltando, ["Comprovantes"]);
});

test("todos os obrigatórios recebidos -> 100%, PRONTO", () => {
  const documentos = tiposPadrao.map((t) => ({ clienteId: "cli-1", tipoDocumento: t.nome, status: "recebido" }));
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.equal(r.percentual, 100);
  assert.equal(r.status, "pronto");
  assert.deepEqual(r.faltando, []);
});

test("um documento inválido -> BLOQUEADO, mesmo com os outros todos recebidos (inválido nunca vira 'quase pronto')", () => {
  const documentos = [
    { clienteId: "cli-1", tipoDocumento: "Extrato bancário", status: "recebido" },
    { clienteId: "cli-1", tipoDocumento: "Notas fiscais", status: "recebido" },
    { clienteId: "cli-1", tipoDocumento: "Folha", status: "recebido" },
    { clienteId: "cli-1", tipoDocumento: "Comprovantes", status: "invalido" },
  ];
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.equal(r.status, "bloqueado");
  assert.deepEqual(r.invalidos, ["Comprovantes"]);
});

test("item já resolvido (recebido) nunca aparece em 'faltando' — impede relembrete de item já resolvido", () => {
  const documentos = [{ clienteId: "cli-1", tipoDocumento: "Extrato bancário", status: "recebido" }];
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.ok(!r.faltando.includes("Extrato bancário"));
});

test("tipo desativado (ativo=false) nunca entra no checklist, mesmo com documento registrado para ele", () => {
  const tipos = [...tiposPadrao, { nome: "Contrato social", obrigatorio: true, ativo: false }];
  const documentos = [{ clienteId: "cli-1", tipoDocumento: "Contrato social", status: "pendente" }];
  const r = calcularFechamentoCliente(cliente, tipos, documentos);
  assert.ok(!r.checklist.some((i) => i.tipoDocumento === "Contrato social"));
});

test("tipo não-obrigatório (obrigatorio=false) nunca entra no cálculo de prontidão", () => {
  const tipos = [...tiposPadrao, { nome: "Extra opcional", obrigatorio: false, ativo: true }];
  const r = calcularFechamentoCliente(cliente, tipos, []);
  assert.equal(r.checklist.length, 4);
});

test("documento de OUTRO cliente nunca conta para este cliente — isolamento por clienteId dentro do motor", () => {
  const documentos = [{ clienteId: "cli-OUTRO", tipoDocumento: "Extrato bancário", status: "recebido" }];
  const r = calcularFechamentoCliente(cliente, tiposPadrao, documentos);
  assert.equal(r.status, "pendente");
  assert.ok(r.faltando.includes("Extrato bancário"));
});

test("zero tipos configurados: 0%, PENDENTE (nunca 'pronto' vazio por acidente) — sinaliza falta de configuração", () => {
  const r = calcularFechamentoCliente(cliente, [], []);
  assert.equal(r.percentual, 0);
  assert.equal(r.status, "pendente");
  assert.deepEqual(r.checklist, []);
});

test("determinismo: mesma entrada duas vezes produz exatamente o mesmo resultado", () => {
  const documentos = [{ clienteId: "cli-1", tipoDocumento: "Extrato bancário", status: "recebido" }];
  assert.deepEqual(
    calcularFechamentoCliente(cliente, tiposPadrao, documentos),
    calcularFechamentoCliente(cliente, tiposPadrao, documentos)
  );
});

// ── Resumo agregado (PRONTOS/PENDENTES/BLOQUEADOS) ────────────────────

test("resumo: conta corretamente pronto/pendente/bloqueado entre vários clientes, ordenado por nome", () => {
  const clientes = [
    { id: "c1", nome: "Empresa XYZ" },
    { id: "c2", nome: "Empresa ABC" },
    { id: "c3", nome: "Empresa DEF" },
  ];
  const documentos = [
    ...tiposPadrao.map((t) => ({ clienteId: "c1", tipoDocumento: t.nome, status: "recebido" })), // XYZ: 100% pronto
    { clienteId: "c2", tipoDocumento: "Extrato bancário", status: "recebido" }, // ABC: parcial pendente
    { clienteId: "c3", tipoDocumento: "Extrato bancário", status: "invalido" }, // DEF: bloqueado
  ];
  const resumo = gerarResumoFechamento("2026-09", clientes, tiposPadrao, documentos);
  assert.equal(resumo.prontos, 1);
  assert.equal(resumo.pendentes, 1);
  assert.equal(resumo.bloqueados, 1);
  assert.deepEqual(resumo.clientes.map((c) => c.nome), ["Empresa ABC", "Empresa DEF", "Empresa XYZ"]);
});

test("resumo: competência vazia de clientes produz zeros reais, nunca fabricados", () => {
  const resumo = gerarResumoFechamento("2026-09", [], tiposPadrao, []);
  assert.equal(resumo.prontos, 0);
  assert.equal(resumo.pendentes, 0);
  assert.equal(resumo.bloqueados, 0);
  assert.deepEqual(resumo.clientes, []);
});

// ── Competência ──────────────────────────────────────────────────────

test("competenciaValida: aceita só AAAA-MM — nunca uma data completa nem formato ambíguo", () => {
  assert.equal(competenciaValida("2026-09"), true);
  assert.equal(competenciaValida("2026-9"), false);
  assert.equal(competenciaValida("2026-09-01"), false);
  assert.equal(competenciaValida("setembro/2026"), false);
  assert.equal(competenciaValida(""), false);
});

// ── Wiring real: rotas usam o motor, nunca recalculam localmente ──────

test("wiring: GET /api/fechamento delega 100% do cálculo a gerarResumoFechamento — nenhuma soma local", () => {
  const codigo = ler("app/api/fechamento/route.ts");
  assert.match(codigo, /gerarResumoFechamento\(/);
  assert.doesNotMatch(codigo, /prontos\s*[:=]\s*\d/);
});

test("wiring: toda rota de fechamento exige autorizarUsuarioNaClinica antes de qualquer consulta a documento/cliente", () => {
  for (const arquivo of [
    "app/api/fechamento/route.ts",
    "app/api/fechamento/tipos/route.ts",
    "app/api/fechamento/tipos/[id]/route.ts",
    "app/api/fechamento/documento/route.ts",
  ]) {
    const codigo = ler(arquivo);
    assert.match(codigo, /autorizarUsuarioNaClinica\(/, `${arquivo} deveria autorizar antes de qualquer consulta`);
  }
});

test("wiring: POST /api/fechamento/documento relê o cliente pelo MESMO tenant antes de gravar — nunca confia em cliente_id sozinho", () => {
  const codigo = ler("app/api/fechamento/documento/route.ts");
  const idxAuth = codigo.indexOf("autorizarUsuarioNaClinica(req, clinica_id)");
  const idxRelerCliente = codigo.indexOf('.from("pacientes")');
  const idxUpsert = codigo.indexOf('.from("fechamento_documentos")');
  assert.ok(idxAuth > -1 && idxRelerCliente > -1 && idxUpsert > -1);
  assert.ok(idxAuth < idxRelerCliente && idxRelerCliente < idxUpsert, "ordem deveria ser: autoriza -> relê cliente do tenant -> grava");
});

test("wiring: baixa de documento é upsert por chave natural (clinica_id,cliente_id,competencia,tipo_documento) — nunca duplica linha para o mesmo item", () => {
  const codigo = ler("app/api/fechamento/documento/route.ts");
  assert.match(codigo, /onConflict:\s*"clinica_id,cliente_id,competencia,tipo_documento"/);
});

test("wiring: PATCH /api/fechamento/tipos/[id] reafirma clinica_id no update — nunca só filtra por id", () => {
  const codigo = ler("app/api/fechamento/tipos/[id]/route.ts");
  const idxUpdate = codigo.indexOf(".update(patch)");
  const trecho = codigo.slice(idxUpdate, idxUpdate + 200);
  assert.match(trecho, /\.eq\("clinica_id", clinica_id\)/);
});

test("wiring: nenhuma rota de fechamento consulta pacientes/documentos sem filtrar por clinica_id", () => {
  for (const arquivo of [
    "app/api/fechamento/route.ts",
    "app/api/fechamento/documento/route.ts",
  ]) {
    const codigo = ler(arquivo);
    const chamadas = codigo.match(/\.from\("(pacientes|fechamento_documentos|fechamento_tipos_documento)"\)[\s\S]{0,400}?(?=\.from\(|$)/g) ?? [];
    for (const trecho of chamadas) {
      assert.match(trecho, /clinica_id/, `consulta em ${arquivo} deveria filtrar por clinica_id: ${trecho.slice(0, 60)}...`);
    }
  }
});

test("wiring: a tela não calcula prontidão localmente — sempre usa resumo.percentual/resumo.status vindos da API", () => {
  const codigo = ler("app/fechamento-contabil/page.tsx");
  assert.doesNotMatch(codigo, /Math\.round/);
  assert.match(codigo, /c\.percentual/);
  assert.match(codigo, /c\.status/);
});

test("wiring: item de navegação real em Inteligência (AdminShellFrame) — nunca 'existe no código' sem estar no menu", () => {
  const codigo = ler("app/components/AdminShellFrame.tsx");
  assert.match(codigo, /h: "\/fechamento-contabil"/);
});

test("wiring: migration está preparada mas não marca execução — mesmo padrão 'PROPOSTA — NÃO EXECUTAR' já usado em outras migrations locais", () => {
  const codigo = ler("supabase/migrations/20260923000001_fechamento_contabil_v1.sql");
  assert.match(codigo, /PROPOSTA — NÃO EXECUTAR/);
  assert.match(codigo, /enable row level security/);
});

test("Contador IA não cria outro Radar/Central/Diretor/Gerente Comercial: nenhum import de nucleo-inteligente/ia-comercial/gerente-comercial", () => {
  for (const arquivo of [
    "lib/fechamento-contabil.ts",
    "app/api/fechamento/route.ts",
    "app/fechamento-contabil/page.tsx",
  ]) {
    const codigo = ler(arquivo);
    assert.doesNotMatch(codigo, /^import[^\n]*(nucleo-inteligente|ia-comercial|gerente-comercial|oportunidades-clientes)/m, `${arquivo} não deveria depender do motor comercial — domínio deliberadamente separado`);
  }
});
