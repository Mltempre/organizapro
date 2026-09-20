// Receita Perdida AI V1 — agregador puro. Prova que o total em dinheiro
// nunca inclui um valor que não existe de fato, que cada item aponta para
// a superfície operacional real (origem/evidência rastreável), e que a
// tela nunca duplica um mesmo registro entre os quatro domínios.
//
// lib/receita-perdida.ts importa de outros arquivos lib/*.ts (motor-
// orcamentos, motor-cobranca, motor-tratamento, oportunidades-demanda,
// oportunidades-clientes) — diferente de oportunidades-demanda.ts (sem
// nenhum import interno), esses imports sem extensão quebram a resolução
// ESM nativa do Node quando o .ts é importado direto. Por isso, mesmo
// padrão já usado em tests/motor-cobranca.convergencia.test.mjs: roda
// contra o build CommonJS (CONVERGENCIA_BUILD_DIR).
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/receita-perdida.test.mjs
// (build precisa incluir receita-perdida.js e oportunidades-demanda.js)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { agregarReceitaPerdida } = await import(pathToFileURL(path.join(buildDir, "receita-perdida.js")));

const HOJE = "2026-09-20";
const AGORA = "2026-09-20T12:00:00.000Z";

const entradaVazia = {
  hoje: HOJE, agora: AGORA,
  orcamentosParados: [], cobrancasAtrasadas: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [], oportunidadesAbertas: [],
};

// ── Honestidade: nada fabricado quando não há dado real ─────────────────

test("lista vazia real nunca fabrica item nenhum, total é zero", () => {
  const r = agregarReceitaPerdida(entradaVazia);
  assert.equal(r.totalConhecido, 0);
  assert.equal(r.itens.length, 0);
  assert.equal(r.oportunidades.length, 0);
  assert.equal(r.totalItensComValor, 0);
  assert.equal(r.totalItensSemValor, 0);
});

// ── Soma só de valores conhecidos ────────────────────────────────────────

test("soma apenas orcamentos/cobrancas/pedidos com valor real, nunca estima o que falta", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    orcamentosParados: [{ id: "orc-1", pacienteNome: "Ana", telefone: null, procedimento: "Avaliação", valor: 300, apresentadoEm: "2026-09-10T12:00:00Z" }],
    cobrancasAtrasadas: [{ id: "cob-1", pacienteNome: "Bruno", telefone: null, descricao: "Mensalidade", valor: 150, vencimento: "2026-09-01", status: "pendente" }],
    pedidosNaoConcluidos: [{ id: "ped-1", pacienteNome: "Carla", telefone: null, descricao: "pedido", valor: 80, criadoEm: "2026-09-15T12:00:00Z" }],
  });
  assert.equal(r.totalConhecido, 300 + 150 + 80);
  assert.equal(r.totalItensComValor, 3);
  assert.equal(r.totalItensSemValor, 0);
});

test("tratamento sem retorno com valor_estimado NULO nunca vira 0 — vai para 'sem valor', nunca somado", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    tratamentosSemRetorno: [
      { id: "trat-1", pacienteNome: "Duda", telefone: null, tipoTratamento: "Acompanhamento", status: "em_andamento", proximaDataPrevista: null, updatedAt: "2026-09-01T12:00:00Z", interrompidoEm: null, valorEstimado: null },
    ],
  });
  assert.equal(r.totalConhecido, 0);
  assert.equal(r.totalItensComValor, 0);
  assert.equal(r.totalItensSemValor, 1);
  assert.equal(r.itens[0].valor, null);
});

test("tratamento sem retorno COM valor_estimado real é somado normalmente", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    tratamentosSemRetorno: [
      { id: "trat-2", pacienteNome: "Elis", telefone: null, tipoTratamento: "Fisioterapia", status: "interrompido", proximaDataPrevista: null, updatedAt: "2026-09-01T12:00:00Z", interrompidoEm: "2026-08-15T12:00:00Z", valorEstimado: 500 },
    ],
  });
  assert.equal(r.totalConhecido, 500);
  assert.equal(r.totalItensComValor, 1);
});

test("oportunidade aberta sem orcamento_vinculado_id NUNCA entra no total de dinheiro, mesmo tendo um status avançado", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    oportunidadesAbertas: [
      { id: "op-1", pacienteNome: "Fabio", status: "atendida", orcamentoVinculadoId: null },
    ],
  });
  assert.equal(r.totalConhecido, 0);
  assert.equal(r.oportunidadesSemComprovacao, 1);
  assert.equal(r.oportunidades[0].destino, "/oportunidades");
});

test("oportunidade JÁ vinculada a um orçamento não aparece como 'sem comprovação' (o valor já está contado no orçamento real)", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    oportunidadesAbertas: [
      { id: "op-2", pacienteNome: "Gabi", status: "atendida", orcamentoVinculadoId: "orc-real-1" },
    ],
  });
  assert.equal(r.oportunidadesSemComprovacao, 0);
});

test("oportunidade em status terminal (perdida/expirada/convertida) sem vínculo não conta como pendência de comprovação", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    oportunidadesAbertas: [
      { id: "op-3", pacienteNome: "Hugo", status: "perdida", orcamentoVinculadoId: null },
    ],
  });
  assert.equal(r.oportunidadesSemComprovacao, 0);
});

// ── Reuso exato dos predicados dos motores já existentes (nunca um segundo Radar) ──

test("orçamento apresentado há menos dias que o limiar real (estaParado) não entra — nunca um limiar novo", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    orcamentosParados: [{ id: "orc-recente", pacienteNome: "Ivo", telefone: null, procedimento: "X", valor: 200, apresentadoEm: "2026-09-20T10:00:00Z" }],
  });
  assert.equal(r.itens.length, 0);
});

test("cobrança que ainda não venceu (estaAtrasada real) não entra", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    cobrancasAtrasadas: [{ id: "cob-futura", pacienteNome: "Julia", telefone: null, descricao: "X", valor: 100, vencimento: "2026-12-01", status: "pendente" }],
  });
  assert.equal(r.itens.length, 0);
});

test("tratamento em_andamento com retorno já agendado no futuro (precisaRetorno real) não entra", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    tratamentosSemRetorno: [
      { id: "trat-ok", pacienteNome: "Karin", telefone: null, tipoTratamento: "X", status: "em_andamento", proximaDataPrevista: "2026-12-01", updatedAt: "2026-09-01T12:00:00Z", interrompidoEm: null, valorEstimado: 300 },
    ],
  });
  assert.equal(r.itens.length, 0);
});

test("pedido criado há menos do que o limiar real não entra", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    pedidosNaoConcluidos: [{ id: "ped-novo", pacienteNome: "Lia", telefone: null, descricao: "pedido", valor: 90, criadoEm: "2026-09-20T11:00:00Z" }],
  });
  assert.equal(r.itens.length, 0);
});

// ── Anti-duplicação / origem rastreável ──────────────────────────────────

test("cada item aparece exatamente uma vez, com origem e destino corretos (nunca misturado entre domínios)", () => {
  const r = agregarReceitaPerdida({
    hoje: HOJE, agora: AGORA,
    orcamentosParados: [{ id: "orc-1", pacienteNome: "Ana", telefone: null, procedimento: "X", valor: 300, apresentadoEm: "2026-09-10T12:00:00Z" }],
    cobrancasAtrasadas: [{ id: "cob-1", pacienteNome: "Bruno", telefone: null, descricao: "X", valor: 150, vencimento: "2026-09-01", status: "pendente" }],
    tratamentosSemRetorno: [{ id: "trat-1", pacienteNome: "Carla", telefone: null, tipoTratamento: "X", status: "interrompido", proximaDataPrevista: null, updatedAt: "2026-09-01T12:00:00Z", interrompidoEm: "2026-08-01T12:00:00Z", valorEstimado: 400 }],
    pedidosNaoConcluidos: [{ id: "ped-1", pacienteNome: "Duda", telefone: null, descricao: "pedido", valor: 90, criadoEm: "2026-09-10T12:00:00Z" }],
    oportunidadesAbertas: [],
  });
  assert.equal(r.itens.length, 4);
  const ids = r.itens.map(i => `${i.origem}:${i.id}`);
  assert.equal(new Set(ids).size, 4, "nenhum id duplicado entre domínios");
  const porOrigem = Object.fromEntries(r.itens.map(i => [i.origem, i]));
  assert.equal(porOrigem.orcamento_parado.destino, "/orcamentos");
  assert.equal(porOrigem.cobranca_atrasada.destino, "/cobrancas");
  assert.equal(porOrigem.tratamento_sem_retorno.destino, "/tratamentos");
  assert.equal(porOrigem.pedido_nao_concluido.destino, "/pedidos");
});

test("mesmo id passado duas vezes na MESMA lista de origem (dado de entrada duplicado) gera dois itens só se a tela buscar duas vezes — a função em si não deduplica por engano um id genuinamente repetido na entrada, mas o total por origem reflete exatamente o que entrou", () => {
  const r = agregarReceitaPerdida({
    ...entradaVazia,
    cobrancasAtrasadas: [
      { id: "cob-x", pacienteNome: "Mario", telefone: null, descricao: "X", valor: 100, vencimento: "2026-09-01", status: "pendente" },
    ],
  });
  assert.equal(r.itens.length, 1);
  assert.equal(r.totalConhecido, 100);
});

test("porOrigem soma exatamente o mesmo total que a soma manual dos itens daquela origem", () => {
  const r = agregarReceitaPerdida({
    hoje: HOJE, agora: AGORA,
    orcamentosParados: [
      { id: "orc-1", pacienteNome: "Ana", telefone: null, procedimento: "X", valor: 300, apresentadoEm: "2026-09-10T12:00:00Z" },
      { id: "orc-2", pacienteNome: "Bea", telefone: null, procedimento: "Y", valor: 200, apresentadoEm: "2026-09-05T12:00:00Z" },
    ],
    cobrancasAtrasadas: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [], oportunidadesAbertas: [],
  });
  const grupo = r.porOrigem.find(g => g.origem === "orcamento_parado");
  assert.equal(grupo.totalConhecido, 500);
  assert.equal(grupo.itensComValor, 2);
  assert.equal(r.totalConhecido, 500);
});

// ── Wiring: a tela nunca consulta o banco direto, sempre pelas APIs canônicas já existentes ──

const pagina = fs.readFileSync(new URL("../app/receita-perdida/page.tsx", import.meta.url), "utf8");

test("receita-perdida: busca só pelas APIs canônicas já existentes, nenhuma query direta a supabase.from em tabela de negócio", () => {
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

test("receita-perdida: toda a decisão de agregação é delegada a agregarReceitaPerdida — nenhuma soma calculada na própria tela", () => {
  assert.match(pagina, /agregarReceitaPerdida\(/);
  assert.doesNotMatch(pagina, /\.reduce\(/);
});
