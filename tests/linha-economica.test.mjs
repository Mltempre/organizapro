// Linha Econômica / Prova de Resultado V1 — motor puro. Prova que
// resultado comprovado nunca vira "atribuível" por suposição, que a
// mesma venda nunca é contada em dois estágios da cadeia, que uma cadeia
// só é "completa" com vínculo técnico real, e que "recuperado" é sempre
// um fato verificável (foiRecuperada real), nunca causalidade da IA.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/linha-economica.test.mjs
// (build precisa incluir linha-economica.js e motor-cobranca.js)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { gerarLinhaEconomica } = await import(pathToFileURL(path.join(buildDir, "linha-economica.js")));

const entradaVazia = { oportunidades: [], orcamentos: [], tratamentos: [], cobrancas: [], pedidos: [] };

// ── Honestidade / ausência de evidência ──────────────────────────────────

test("zero dados reais nunca fabrica item nenhum, todos os totais são zero", () => {
  const r = gerarLinhaEconomica(entradaVazia);
  assert.equal(r.totalComprovado, 0);
  assert.equal(r.totalAtribuivel, 0);
  assert.equal(r.totalNaoAtribuivel, 0);
  assert.equal(r.totalRecuperado, 0);
  assert.equal(r.cadeiasCompletas, 0);
  assert.equal(r.cadeiasParciais, 0);
  assert.equal(r.itens.length, 0);
  assert.equal(r.porCanal.length, 0);
});

test("cobrança pendente/em_cobranca/cancelada NUNCA vira resultado comprovado — só 'pago' com valor_pago e pago_em reais conta", () => {
  const r = gerarLinhaEconomica({
    ...entradaVazia,
    cobrancas: [
      { id: "c1", pacienteNome: "Ana", tratamentoOrigemId: null, status: "pendente", valor: 100, valorPago: null, vencimento: "2026-09-01", pagoEm: null, emCobrancaEm: null },
      { id: "c2", pacienteNome: "Bruno", tratamentoOrigemId: null, status: "cancelada", valor: 100, valorPago: null, vencimento: "2026-09-01", pagoEm: null, emCobrancaEm: null },
    ],
  });
  assert.equal(r.totalComprovado, 0);
  assert.equal(r.itens.length, 0);
});

// ── Resultado comprovado sem cadeia (não atribuível) ─────────────────────

test("cobrança paga SEM tratamento_origem_id é comprovada mas NUNCA atribuível — sem vínculo, sem causalidade inventada", () => {
  const r = gerarLinhaEconomica({
    ...entradaVazia,
    cobrancas: [{ id: "c1", pacienteNome: "Carla", tratamentoOrigemId: null, status: "pago", valor: 300, valorPago: 300, vencimento: "2026-09-01", pagoEm: "2026-09-05T10:00:00Z", emCobrancaEm: null }],
  });
  assert.equal(r.totalComprovado, 300);
  assert.equal(r.totalAtribuivel, 0);
  assert.equal(r.totalNaoAtribuivel, 300);
  assert.equal(r.itens[0].atribuivel, false);
  assert.equal(r.itens[0].canalOrigem, null);
});

test("pedido pago NUNCA é atribuível nesta V1 — não existe vínculo técnico real entre pedido e oportunidade hoje", () => {
  const r = gerarLinhaEconomica({
    ...entradaVazia,
    oportunidades: [{ id: "op1", canal: "whatsapp", status: "convertida", orcamentoVinculadoId: "o1" }],
    pedidos: [{ id: "p1", pacienteNome: "Duda", status: "pago", valor: 90, pagamentoConfirmadoEm: "2026-09-10T10:00:00Z" }],
  });
  assert.equal(r.totalComprovado, 90);
  assert.equal(r.totalAtribuivel, 0);
  assert.equal(r.itens[0].atribuivel, false);
  assert.equal(r.itens[0].origem, "pedido");
});

// ── Cadeia completa (atribuível) ──────────────────────────────────────────

test("cadeia completa oportunidade -> orçamento -> tratamento -> cobrança paga é ATRIBUÍVEL, com trilha e canal reais", () => {
  const r = gerarLinhaEconomica({
    oportunidades: [{ id: "op1", canal: "whatsapp", status: "convertida", orcamentoVinculadoId: "orc1" }],
    orcamentos: [{ id: "orc1", status: "aprovado", valor: 800, apresentadoEm: "2026-08-01T10:00:00Z", decididoEm: "2026-08-03T10:00:00Z" }],
    tratamentos: [{ id: "trt1", orcamentoOrigemId: "orc1", status: "concluido" }],
    cobrancas: [{ id: "cob1", pacienteNome: "Elis", tratamentoOrigemId: "trt1", status: "pago", valor: 800, valorPago: 800, vencimento: "2026-09-01", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null }],
    pedidos: [],
  });
  assert.equal(r.totalAtribuivel, 800);
  assert.equal(r.itens[0].atribuivel, true);
  assert.equal(r.itens[0].canalOrigem, "whatsapp");
  assert.equal(r.itens[0].oportunidadeId, "op1");
  assert.equal(r.cadeiasCompletas, 1);
  assert.equal(r.cadeiasParciais, 0);
  assert.deepEqual(r.itens[0].trilha.map(e => e.etapa), ["oportunidade", "orcamento", "tratamento", "cobranca"]);
  assert.equal(r.porCanal.find(g => g.canal === "whatsapp").total, 800);
});

test("cadeia completa registra dias reais entre apresentado_em e decidido_em do orçamento — nunca um tempo médio fabricado", () => {
  const r = gerarLinhaEconomica({
    oportunidades: [{ id: "op1", canal: "site", status: "convertida", orcamentoVinculadoId: "orc1" }],
    orcamentos: [{ id: "orc1", status: "aprovado", valor: 500, apresentadoEm: "2026-08-01T10:00:00Z", decididoEm: "2026-08-06T10:00:00Z" }],
    tratamentos: [{ id: "trt1", orcamentoOrigemId: "orc1", status: "concluido" }],
    cobrancas: [{ id: "cob1", pacienteNome: "Fábio", tratamentoOrigemId: "trt1", status: "pago", valor: 500, valorPago: 500, vencimento: "2026-08-10", pagoEm: "2026-08-10T10:00:00Z", emCobrancaEm: null }],
    pedidos: [],
  });
  const etapaOrcamento = r.itens[0].trilha.find(e => e.etapa === "orcamento");
  assert.equal(etapaOrcamento.diasAteDecisao, 5);
});

// ── Cadeia parcial ─────────────────────────────────────────────────────

test("oportunidade com orçamento vinculado mas SEM tratamento é cadeia PARCIAL — não atribuível ainda, sem pagamento", () => {
  const r = gerarLinhaEconomica({
    oportunidades: [{ id: "op1", canal: "manual", status: "convertida", orcamentoVinculadoId: "orc1" }],
    orcamentos: [{ id: "orc1", status: "aprovado", valor: 400, apresentadoEm: "2026-09-01T10:00:00Z", decididoEm: "2026-09-02T10:00:00Z" }],
    tratamentos: [], cobrancas: [], pedidos: [],
  });
  assert.equal(r.cadeiasCompletas, 0);
  assert.equal(r.cadeiasParciais, 1);
  assert.equal(r.totalComprovado, 0);
});

test("oportunidade -> orçamento -> tratamento SEM cobrança paga é cadeia PARCIAL", () => {
  const r = gerarLinhaEconomica({
    oportunidades: [{ id: "op1", canal: "manual", status: "convertida", orcamentoVinculadoId: "orc1" }],
    orcamentos: [{ id: "orc1", status: "aprovado", valor: 400, apresentadoEm: "2026-09-01T10:00:00Z", decididoEm: "2026-09-02T10:00:00Z" }],
    tratamentos: [{ id: "trt1", orcamentoOrigemId: "orc1", status: "em_andamento" }],
    cobrancas: [], pedidos: [],
  });
  assert.equal(r.cadeiasCompletas, 0);
  assert.equal(r.cadeiasParciais, 1);
});

// ── Anti-duplicação ────────────────────────────────────────────────────

test("anti-duplicação: valor de orçamento e de tratamento NUNCA são somados ao total — só o valor_pago da cobrança (estágio terminal)", () => {
  const r = gerarLinhaEconomica({
    oportunidades: [{ id: "op1", canal: "whatsapp", status: "convertida", orcamentoVinculadoId: "orc1" }],
    orcamentos: [{ id: "orc1", status: "aprovado", valor: 9999, apresentadoEm: "2026-08-01T10:00:00Z", decididoEm: "2026-08-03T10:00:00Z" }], // valor do orçamento MUITO diferente
    tratamentos: [{ id: "trt1", orcamentoOrigemId: "orc1", status: "concluido" }],
    cobrancas: [{ id: "cob1", pacienteNome: "Gustavo", tratamentoOrigemId: "trt1", status: "pago", valor: 800, valorPago: 700, vencimento: "2026-09-01", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null }], // valor_pago é o único que deveria contar
    pedidos: [],
  });
  // Nem 9999 (orçamento), nem 800 (valor nominal da cobrança) — só 700 (valor_pago real)
  assert.equal(r.totalComprovado, 700);
  assert.equal(r.totalAtribuivel, 700);
  assert.equal(r.itens.length, 1); // um único item, nunca duplicado entre orçamento/tratamento/cobrança
});

test("anti-duplicação: duas cobranças pagas vinculadas ao MESMO tratamento (parcelamento real) somam as duas — não é duplicação, são pagamentos distintos", () => {
  const r = gerarLinhaEconomica({
    oportunidades: [{ id: "op1", canal: "whatsapp", status: "convertida", orcamentoVinculadoId: "orc1" }],
    orcamentos: [{ id: "orc1", status: "aprovado", valor: 1000, apresentadoEm: "2026-08-01T10:00:00Z", decididoEm: "2026-08-03T10:00:00Z" }],
    tratamentos: [{ id: "trt1", orcamentoOrigemId: "orc1", status: "concluido" }],
    cobrancas: [
      { id: "cob1", pacienteNome: "Helena", tratamentoOrigemId: "trt1", status: "pago", valor: 500, valorPago: 500, vencimento: "2026-09-01", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null },
      { id: "cob2", pacienteNome: "Helena", tratamentoOrigemId: "trt1", status: "pago", valor: 500, valorPago: 500, vencimento: "2026-10-01", pagoEm: "2026-10-01T10:00:00Z", emCobrancaEm: null },
    ],
    pedidos: [],
  });
  assert.equal(r.totalAtribuivel, 1000);
  assert.equal(r.itens.length, 2);
  assert.equal(r.cadeiasCompletas, 1); // mesma oportunidade, uma cadeia — mas 2 itens de receita
});

// ── Prova de recuperação (fato, nunca causalidade) ───────────────────────

test("cobrança paga DEPOIS do vencimento é 'recuperada' — fato verificável via foiRecuperada real, nunca causalidade da IA", () => {
  const r = gerarLinhaEconomica({
    ...entradaVazia,
    cobrancas: [{ id: "c1", pacienteNome: "Igor", tratamentoOrigemId: null, status: "pago", valor: 200, valorPago: 200, vencimento: "2026-08-01", pagoEm: "2026-08-15T10:00:00Z", emCobrancaEm: null }],
  });
  assert.equal(r.itens[0].recuperada, true);
  assert.equal(r.totalRecuperado, 200);
});

test("cobrança paga NO vencimento (pagamento pontual) NÃO é 'recuperada' — nunca inflaciona a métrica de recuperação", () => {
  const r = gerarLinhaEconomica({
    ...entradaVazia,
    cobrancas: [{ id: "c1", pacienteNome: "Julia", tratamentoOrigemId: null, status: "pago", valor: 200, valorPago: 200, vencimento: "2026-09-10", pagoEm: "2026-09-05T10:00:00Z", emCobrancaEm: null }],
  });
  assert.equal(r.itens[0].recuperada, false);
  assert.equal(r.totalRecuperado, 0);
});

// ── Dados incompletos ──────────────────────────────────────────────────

test("tratamento_origem_id aponta para um tratamento inexistente (dado incompleto) — cobrança fica comprovada, nunca atribuível, nunca quebra", () => {
  const r = gerarLinhaEconomica({
    ...entradaVazia,
    cobrancas: [{ id: "c1", pacienteNome: "Kaio", tratamentoOrigemId: "trt-fantasma", status: "pago", valor: 300, valorPago: 300, vencimento: "2026-09-01", pagoEm: "2026-09-05T10:00:00Z", emCobrancaEm: null }],
  });
  assert.equal(r.totalComprovado, 300);
  assert.equal(r.totalAtribuivel, 0);
});

test("tratamento existe mas orcamento_origem_id é null (dado incompleto) — comprovado, nunca atribuível", () => {
  const r = gerarLinhaEconomica({
    ...entradaVazia,
    tratamentos: [{ id: "trt1", orcamentoOrigemId: null, status: "concluido" }],
    cobrancas: [{ id: "c1", pacienteNome: "Laura", tratamentoOrigemId: "trt1", status: "pago", valor: 300, valorPago: 300, vencimento: "2026-09-01", pagoEm: "2026-09-05T10:00:00Z", emCobrancaEm: null }],
  });
  assert.equal(r.totalAtribuivel, 0);
});

test("orçamento existe mas nenhuma oportunidade aponta pra ele (criado manualmente, não via oportunidade) — comprovado, nunca atribuível", () => {
  const r = gerarLinhaEconomica({
    orcamentos: [{ id: "orc1", status: "aprovado", valor: 400, apresentadoEm: "2026-08-01T10:00:00Z", decididoEm: "2026-08-03T10:00:00Z" }],
    tratamentos: [{ id: "trt1", orcamentoOrigemId: "orc1", status: "concluido" }],
    cobrancas: [{ id: "c1", pacienteNome: "Marcos", tratamentoOrigemId: "trt1", status: "pago", valor: 400, valorPago: 400, vencimento: "2026-09-01", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null }],
    oportunidades: [], pedidos: [],
  });
  assert.equal(r.totalAtribuivel, 0);
  assert.equal(r.totalComprovado, 400);
});

// ── Determinismo ──────────────────────────────────────────────────────

test("idempotência/determinismo: mesma entrada duas vezes produz exatamente o mesmo resultado", () => {
  const entrada = {
    oportunidades: [{ id: "op1", canal: "whatsapp", status: "convertida", orcamentoVinculadoId: "orc1" }],
    orcamentos: [{ id: "orc1", status: "aprovado", valor: 800, apresentadoEm: "2026-08-01T10:00:00Z", decididoEm: "2026-08-03T10:00:00Z" }],
    tratamentos: [{ id: "trt1", orcamentoOrigemId: "orc1", status: "concluido" }],
    cobrancas: [{ id: "cob1", pacienteNome: "Nina", tratamentoOrigemId: "trt1", status: "pago", valor: 800, valorPago: 800, vencimento: "2026-09-01", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null }],
    pedidos: [],
  };
  assert.deepEqual(gerarLinhaEconomica(entrada), gerarLinhaEconomica(entrada));
});

// ── Wiring: a tela nunca consulta o banco direto, sempre pelas APIs canônicas já existentes (isolamento tenant escopado por clinica_id) ──

const pagina = fs.readFileSync(new URL("../app/linha-economica/page.tsx", import.meta.url), "utf8");

test("linha-economica: busca só pelas APIs canônicas já existentes (todas escopadas por clinica_id), nenhuma query direta a supabase.from em tabela de negócio", () => {
  assert.match(pagina, /fetch\('\/api\/oportunidades'/);
  assert.match(pagina, /\/api\/orcamentos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/tratamentos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/cobrancas\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/pedidos\?clinica_id=\$\{cid\}/);
  assert.doesNotMatch(pagina, /supabase\.from\("orcamentos"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("cobrancas"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("tratamentos"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("pedidos"\)/);
  assert.doesNotMatch(pagina, /origem_captacoes/); // tabela ainda não existe em produção — não tentar ler
});

test("linha-economica: toda a decisão é delegada a gerarLinhaEconomica — nenhuma soma calculada na própria tela", () => {
  assert.match(pagina, /gerarLinhaEconomica\(/);
  assert.doesNotMatch(pagina, /\.reduce\(/);
});

test("linha-economica: cid vem sempre de /api/minha-clinica (derivado do token), nunca de query/body do cliente — isolamento tenant por construção", () => {
  const idxCid = pagina.indexOf("const cid");
  assert.ok(idxCid > -1);
  const trecho = pagina.slice(Math.max(0, idxCid - 200), idxCid + 50);
  assert.match(trecho, /\/api\/minha-clinica/);
  // As 4 chamadas escopadas usam a MESMA variável cid derivada acima — nunca um clinica_id vindo de outro lugar
  assert.equal((pagina.match(/clinica_id=\$\{cid\}/g) || []).length, 4);
});
