// Previsor de Faturamento 30 Dias V1 — motor puro. Prova que o total
// esperado nunca inclui receita em risco, que nenhuma data é inventada
// quando o dado real não existe, que o horizonte de 30 dias é respeitado
// à risca, e que a mesma venda nunca é contada duas vezes ao atravessar
// orçamento -> tratamento -> cobrança.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/previsor-faturamento.test.mjs
// (build precisa incluir previsor-faturamento.js e receita-perdida.js)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { gerarPrevisorFaturamento, calcularHorizonteFim } = await import(pathToFileURL(path.join(buildDir, "previsor-faturamento.js")));

const HOJE = "2026-09-20";
const AGORA = "2026-09-20T12:00:00.000Z";

const entradaVazia = {
  hoje: HOJE, agora: AGORA,
  cobrancasAbertas: [], orcamentosApresentados: [], tratamentos: [], pedidosAbertos: [], oportunidadesAbertas: [],
};

// ── Honestidade ──────────────────────────────────────────────────────────

test("lista vazia real nunca fabrica item nenhum, todos os totais são zero", () => {
  const r = gerarPrevisorFaturamento(entradaVazia);
  assert.equal(r.confirmadoProgramado.total, 0);
  assert.equal(r.emPerspectiva.totalComData, 0);
  assert.equal(r.emPerspectiva.totalSemData, 0);
  assert.equal(r.totalEsperado30Dias, 0);
  assert.equal(r.emRisco.totalConhecido, 0);
});

test("calcularHorizonteFim: hoje + 30 dias corridos, virando mês corretamente", () => {
  assert.equal(calcularHorizonteFim("2026-09-20"), "2026-10-20");
  assert.equal(calcularHorizonteFim("2026-01-15"), "2026-02-14");
});

// ── Confirmado/Programado ────────────────────────────────────────────────

test("cobrança aberta com vencimento dentro dos 30 dias, ainda não atrasada, é confirmado/programado", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    cobrancasAbertas: [{ id: "c1", pacienteNome: "Ana", telefone: null, descricao: "Mensalidade", valor: 300, vencimento: "2026-10-01", status: "pendente", tratamentoOrigemId: null }],
  });
  assert.equal(r.confirmadoProgramado.total, 300);
  assert.equal(r.confirmadoProgramado.itens[0].dataPrevista, "2026-10-01");
  assert.equal(r.confirmadoProgramado.itens[0].origem, "cobranca_a_vencer");
  assert.equal(r.totalEsperado30Dias, 300);
});

test("cobrança já atrasada NUNCA vira confirmado/programado — vai para em risco", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    cobrancasAbertas: [{ id: "c1", pacienteNome: "Bruno", telefone: null, descricao: "Mensalidade", valor: 300, vencimento: "2026-09-01", status: "pendente", tratamentoOrigemId: null }],
  });
  assert.equal(r.confirmadoProgramado.total, 0);
  assert.equal(r.emRisco.totalConhecido, 300);
});

test("cobrança com vencimento além dos 30 dias fica fora do horizonte — não confirmado, não em risco, não inventa data", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    cobrancasAbertas: [{ id: "c1", pacienteNome: "Carla", telefone: null, descricao: "Mensalidade", valor: 300, vencimento: "2026-12-01", status: "pendente", tratamentoOrigemId: null }],
  });
  assert.equal(r.confirmadoProgramado.total, 0);
  assert.equal(r.emPerspectiva.totalComData + r.emPerspectiva.totalSemData, 0);
  assert.equal(r.emRisco.totalConhecido, 0);
  assert.equal(r.totalEsperado30Dias, 0);
});

// ── Em Perspectiva ────────────────────────────────────────────────────────

test("orçamento apresentado fresco (não parado) é perspectiva SEM data prevista — nunca inventa data de fechamento", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    orcamentosApresentados: [{ id: "o1", pacienteNome: "Duda", telefone: null, procedimento: "Avaliação", valor: 500, apresentadoEm: "2026-09-19T12:00:00Z" }],
  });
  assert.equal(r.emPerspectiva.totalSemData, 500);
  assert.equal(r.emPerspectiva.itensSemData[0].dataPrevista, null);
  assert.equal(r.emPerspectiva.itensSemData[0].origem, "orcamento_apresentado");
});

test("orçamento apresentado PARADO nunca vira perspectiva — vai para em risco", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    orcamentosApresentados: [{ id: "o1", pacienteNome: "Elis", telefone: null, procedimento: "Avaliação", valor: 500, apresentadoEm: "2026-09-01T12:00:00Z" }],
  });
  assert.equal(r.emPerspectiva.totalSemData, 0);
  assert.equal(r.emRisco.totalConhecido, 500);
});

test("tratamento em_andamento com próxima data real dentro dos 30 dias é perspectiva COM data", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    tratamentos: [{ id: "t1", pacienteNome: "Fábio", telefone: null, tipoTratamento: "Clareamento", status: "em_andamento", valorEstimado: 800, proximaDataPrevista: "2026-10-05", updatedAt: "2026-09-19T12:00:00Z", interrompidoEm: null }],
  });
  assert.equal(r.emPerspectiva.totalComData, 800);
  assert.equal(r.emPerspectiva.itensComData[0].dataPrevista, "2026-10-05");
});

test("tratamento em_andamento com data real ALÉM dos 30 dias fica fora do horizonte, não inventa nem trunca a data", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    tratamentos: [{ id: "t1", pacienteNome: "Gustavo", telefone: null, tipoTratamento: "Ortodontia", status: "em_andamento", valorEstimado: 800, proximaDataPrevista: "2026-12-25", updatedAt: "2026-09-19T12:00:00Z", interrompidoEm: null }],
  });
  assert.equal(r.emPerspectiva.totalComData, 0);
  assert.equal(r.emPerspectiva.totalSemData, 0);
  assert.equal(r.emRisco.totalConhecido, 0);
});

test("tratamento em_andamento SEM próxima data (precisaRetorno real) nunca vira perspectiva — vai para em risco", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    tratamentos: [{ id: "t1", pacienteNome: "Helena", telefone: null, tipoTratamento: "Limpeza", status: "em_andamento", valorEstimado: 200, proximaDataPrevista: null, updatedAt: "2026-09-15T12:00:00Z", interrompidoEm: null }],
  });
  assert.equal(r.emPerspectiva.totalComData + r.emPerspectiva.totalSemData, 0);
  assert.equal(r.emRisco.totalConhecido, 200);
});

test("tratamento retorno_agendado com data dentro dos 30 dias é perspectiva COM data", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    tratamentos: [{ id: "t1", pacienteNome: "Igor", telefone: null, tipoTratamento: "Retorno", status: "retorno_agendado", valorEstimado: 150, proximaDataPrevista: "2026-09-25", updatedAt: "2026-09-15T12:00:00Z", interrompidoEm: null }],
  });
  assert.equal(r.emPerspectiva.totalComData, 150);
});

test("tratamento interrompido NUNCA vira perspectiva — vai inteiramente para em risco", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    tratamentos: [{ id: "t1", pacienteNome: "Julia", telefone: null, tipoTratamento: "Ortodontia", status: "interrompido", valorEstimado: 400, proximaDataPrevista: null, updatedAt: "2026-09-01T12:00:00Z", interrompidoEm: "2026-09-05T12:00:00Z" }],
  });
  assert.equal(r.emPerspectiva.totalComData + r.emPerspectiva.totalSemData, 0);
  assert.equal(r.emRisco.totalConhecido, 400);
});

test("tratamento sem valor_estimado (dado ausente) nunca vira 0 nem estimativa — simplesmente não entra em nenhum total", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    tratamentos: [{ id: "t1", pacienteNome: "Kaio", telefone: null, tipoTratamento: "Avaliação", status: "em_andamento", valorEstimado: null, proximaDataPrevista: "2026-10-01", updatedAt: "2026-09-19T12:00:00Z", interrompidoEm: null }],
  });
  assert.equal(r.emPerspectiva.totalComData, 0);
  assert.equal(r.emPerspectiva.totalSemData, 0);
});

test("pedido em andamento fresco (não parado) é perspectiva SEM data — pedidos não têm data de pagamento esperado", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    pedidosAbertos: [{ id: "p1", pacienteNome: "Laura", telefone: null, descricao: "pedido", valor: 90, criadoEm: "2026-09-20T10:00:00Z", status: "criado" }],
  });
  assert.equal(r.emPerspectiva.totalSemData, 90);
  assert.equal(r.emPerspectiva.itensSemData[0].dataPrevista, null);
});

test("pedido parado (>= 2 dias) NUNCA vira perspectiva — vai para em risco", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    pedidosAbertos: [{ id: "p1", pacienteNome: "Marcos", telefone: null, descricao: "pedido", valor: 90, criadoEm: "2026-09-17T10:00:00Z", status: "criado" }],
  });
  assert.equal(r.emPerspectiva.totalSemData, 0);
  assert.equal(r.emRisco.totalConhecido, 90);
});

test("oportunidade aberta sem orçamento vinculado é count-only — nunca soma valor a nenhum total", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    oportunidadesAbertas: [{ id: "op1", pacienteNome: "Nina", status: "sinalizada", orcamentoVinculadoId: null }],
  });
  assert.equal(r.emPerspectiva.oportunidadesSemValor, 1);
  assert.equal(r.totalEsperado30Dias, 0);
  assert.equal(r.emRisco.oportunidades.length, 1);
});

// ── Anti-duplicação ────────────────────────────────────────────────────────

test("anti-duplicação: tratamento com cobrança ABERTA já vinculada não conta na perspectiva — só a cobrança conta", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    cobrancasAbertas: [{ id: "c1", pacienteNome: "Otávio", telefone: null, descricao: "Parcela do tratamento", valor: 600, vencimento: "2026-10-01", status: "pendente", tratamentoOrigemId: "t1" }],
    tratamentos: [{ id: "t1", pacienteNome: "Otávio", telefone: null, tipoTratamento: "Implante", status: "em_andamento", valorEstimado: 2000, proximaDataPrevista: "2026-10-10", updatedAt: "2026-09-19T12:00:00Z", interrompidoEm: null }],
  });
  // Só a cobrança (600) conta — o tratamento (2000) NUNCA aparece na perspectiva
  assert.equal(r.confirmadoProgramado.total, 600);
  assert.equal(r.emPerspectiva.totalComData, 0);
  assert.equal(r.emPerspectiva.totalSemData, 0);
  assert.equal(r.totalEsperado30Dias, 600);
});

test("anti-duplicação: tratamento SEM cobrança aberta vinculada conta normalmente na perspectiva", () => {
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    cobrancasAbertas: [{ id: "c1", pacienteNome: "Paula", telefone: null, descricao: "Outra cobrança", valor: 100, vencimento: "2026-10-01", status: "pendente", tratamentoOrigemId: "t-outro" }],
    tratamentos: [{ id: "t1", pacienteNome: "Paula", telefone: null, tipoTratamento: "Implante", status: "em_andamento", valorEstimado: 2000, proximaDataPrevista: "2026-10-10", updatedAt: "2026-09-19T12:00:00Z", interrompidoEm: null }],
  });
  assert.equal(r.emPerspectiva.totalComData, 2000);
  assert.equal(r.confirmadoProgramado.total, 100);
  assert.equal(r.totalEsperado30Dias, 2100);
});

test("orçamento apresentado nunca soma junto com um tratamento derivado dele — regra é por status, não por vínculo explícito (mesmo padrão de Receita Perdida)", () => {
  // Orçamento já 'aprovado' (decidido) simplesmente não é enviado como
  // orcamentosApresentados nesta chamada — só 'apresentado' é considerado.
  // Este teste prova que a lista vazia de orçamentos não afeta o total do
  // tratamento correspondente.
  const r = gerarPrevisorFaturamento({
    ...entradaVazia,
    tratamentos: [{ id: "t1", pacienteNome: "Quintino", telefone: null, tipoTratamento: "Prótese", status: "em_andamento", valorEstimado: 1200, proximaDataPrevista: "2026-10-15", updatedAt: "2026-09-19T12:00:00Z", interrompidoEm: null }],
  });
  assert.equal(r.emPerspectiva.totalComData, 1200);
});

// ── Composição do total ─────────────────────────────────────────────────

test("totalEsperado30Dias é sempre confirmado + perspectiva, NUNCA inclui em risco", () => {
  const r = gerarPrevisorFaturamento({
    hoje: HOJE, agora: AGORA,
    cobrancasAbertas: [
      { id: "c1", pacienteNome: "Rafa", telefone: null, descricao: "x", valor: 100, vencimento: "2026-10-01", status: "pendente", tratamentoOrigemId: null }, // confirmado
      { id: "c2", pacienteNome: "Sara", telefone: null, descricao: "x", valor: 999, vencimento: "2026-09-01", status: "pendente", tratamentoOrigemId: null }, // atrasada -> em risco
    ],
    orcamentosApresentados: [{ id: "o1", pacienteNome: "Tiago", telefone: null, procedimento: "x", valor: 50, apresentadoEm: "2026-09-19T12:00:00Z" }], // perspectiva
    tratamentos: [], pedidosAbertos: [], oportunidadesAbertas: [],
  });
  assert.equal(r.confirmadoProgramado.total, 100);
  assert.equal(r.emPerspectiva.totalSemData, 50);
  assert.equal(r.totalEsperado30Dias, 150); // 100 + 50, NUNCA 999 somado
  assert.equal(r.emRisco.totalConhecido, 999);
});

test("idempotência/determinismo: mesma entrada duas vezes produz exatamente o mesmo resultado", () => {
  const entrada = {
    ...entradaVazia,
    cobrancasAbertas: [{ id: "c1", pacienteNome: "Uga", telefone: null, descricao: "x", valor: 100, vencimento: "2026-10-01", status: "pendente", tratamentoOrigemId: null }],
  };
  assert.deepEqual(gerarPrevisorFaturamento(entrada), gerarPrevisorFaturamento(entrada));
});

// ── Wiring: a tela nunca consulta o banco direto, sempre pelas APIs canônicas já existentes (isolamento tenant escopado por clinica_id) ──

const pagina = fs.readFileSync(new URL("../app/previsor-faturamento/page.tsx", import.meta.url), "utf8");

test("previsor-faturamento: busca só pelas APIs canônicas já existentes (todas escopadas por clinica_id), nenhuma query direta a supabase.from em tabela de negócio", () => {
  assert.match(pagina, /\/api\/orcamentos\?clinica_id=\$\{cid\}&status=apresentado/);
  assert.match(pagina, /\/api\/cobrancas\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/tratamentos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/pedidos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /fetch\('\/api\/oportunidades'/);
  assert.doesNotMatch(pagina, /supabase\.from\("orcamentos"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("cobrancas"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("tratamentos"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("pedidos"\)/);
});

test("previsor-faturamento: toda a decisão é delegada a gerarPrevisorFaturamento — nenhuma soma calculada na própria tela", () => {
  assert.match(pagina, /gerarPrevisorFaturamento\(/);
  assert.doesNotMatch(pagina, /\.reduce\(/);
});

test("previsor-faturamento: cid vem sempre de /api/minha-clinica (derivado do token), nunca de query/body do cliente", () => {
  const idxCid = pagina.indexOf("const cid");
  assert.ok(idxCid > -1);
  const trecho = pagina.slice(Math.max(0, idxCid - 200), idxCid + 50);
  assert.match(trecho, /\/api\/minha-clinica/);
});
