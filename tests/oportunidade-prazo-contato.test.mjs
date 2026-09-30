// Prazo de primeiro contato (expira_em) — interesse "sinalizada" nunca
// atendido dentro da janela deixa de ser prioridade no Gerente Comercial,
// Follow-up e Receita Perdida. Reproduz o caso real de produção: duas
// oportunidades de WhatsApp com expira_em vencido continuavam como
// "interesse ainda sem orçamento".
//
// Motores vêm do mesmo build CommonJS dos testes de convergência
// (CONVERGENCIA_BUILD_DIR → pasta lib do build).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { statusEfetivoOportunidade } from "../lib/oportunidades-demanda.ts";

const require = createRequire(import.meta.url);
const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { adaptarOportunidadesDemanda } = require(path.join(buildDir, "nucleo-inteligente.js"));
const { gerarFollowUpsComerciais } = require(path.join(buildDir, "follow-up-comercial.js"));
const { agregarReceitaPerdida } = require(path.join(buildDir, "receita-perdida.js"));

const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const AGORA = Date.parse("2026-09-29T20:00:00Z");
const HOJE = "2026-09-29";

// Formato real devolvido pela API (valores dos registros de produção).
const vencida = { id: "op-vencida", canal: "whatsapp", telefone: "5516982205201", nome_informado: "Contato A", status: "sinalizada", confianca_classificacao: "alta", orcamento_vinculado_id: null, ultima_interacao_em: "2026-08-19T17:37:36Z", expira_em: "2026-08-24T17:37:36Z" };
const vigente = { id: "op-vigente", canal: "whatsapp", telefone: "5543900000001", nome_informado: "Contato B", status: "sinalizada", confianca_classificacao: "alta", orcamento_vinculado_id: null, ultima_interacao_em: "2026-09-25T10:00:00Z", expira_em: "2026-09-30T10:00:00Z" };

function comoApi(ops) {
  return ops.map(op => ({ ...op, status_registrado: op.status, status: statusEfetivoOportunidade(op, AGORA) }));
}

test("sinalizada com prazo vencido é expirada; dentro do prazo continua sinalizada", () => {
  assert.equal(statusEfetivoOportunidade(vencida, AGORA), "expirada");
  assert.equal(statusEfetivoOportunidade(vigente, AGORA), "sinalizada");
});

test("só sinalizada expira por prazo — quem já está em contato/agendada não some", () => {
  for (const status of ["em_contato", "agendada", "atendida", "convertida", "perdida"]) {
    assert.equal(statusEfetivoOportunidade({ ...vencida, status }, AGORA), status);
  }
  assert.equal(statusEfetivoOportunidade({ ...vencida, expira_em: null }, AGORA), "sinalizada");
  assert.equal(statusEfetivoOportunidade({ ...vencida, expira_em: "invalido" }, AGORA), "sinalizada");
});

test("Gerente Comercial: prioridade só para a oportunidade vigente", () => {
  const sinais = adaptarOportunidadesDemanda(comoApi([vencida, vigente]));
  assert.deepEqual(sinais.map(s => s.entidadeId), ["op-vigente"]);
});

test("Follow-up: oportunidade vencida não vira oportunidade_parada; vigente parada continua", () => {
  const casos = gerarFollowUpsComerciais({
    hoje: HOJE, agora: new Date(AGORA).toISOString(), entidadesComTentativaHoje: new Set(),
    oportunidadesParadas: comoApi([vencida, { ...vigente, ultima_interacao_em: "2026-09-25T10:00:00Z" }]).map(op => ({ id: op.id, telefone: op.telefone, pacienteNome: op.nome_informado, status: op.status, orcamentoVinculadoId: op.orcamento_vinculado_id, ultimaInteracaoEm: op.ultima_interacao_em })),
    orcamentosParados: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [], recomprasPossiveis: [], cobrancasAtrasadas: [], casosAgendaAutonoma: [],
  }).filter(c => c.tipo === "oportunidade_parada");
  assert.equal(casos.some(c => c.entidadeId === "5516982205201"), false);
  assert.equal(casos.some(c => c.entidadeId === "5543900000001"), true);
});

test("Receita Perdida: oportunidade vencida não conta como aberta", () => {
  const r = agregarReceitaPerdida({
    hoje: HOJE, agora: new Date(AGORA).toISOString(),
    orcamentosParados: [], cobrancasAtrasadas: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [],
    oportunidadesAbertas: comoApi([vencida, vigente]).map(op => ({ id: op.id, pacienteNome: op.nome_informado, status: op.status, orcamentoVinculadoId: op.orcamento_vinculado_id })),
  });
  assert.deepEqual(r.oportunidades.map(o => o.id), ["op-vigente"]);
  assert.equal(r.oportunidadesSemComprovacao, 1);
});

test("fiação: API aplica o status efetivo (inclusive no filtro) e preserva o registrado", () => {
  const rota = ler("../app/api/oportunidades/route.ts");
  assert.match(rota, /status_registrado: op\.status, status: statusEfetivoOportunidade\(op, agoraMs\)/);
  assert.match(rota, /efetivas\.filter\(op => op\.status === status\)/);
  assert.doesNotMatch(rota, /query = query\.eq\("status", status\)/);
});

test("fiação: revalidação do Follow-up no servidor usa o mesmo status efetivo", () => {
  const persist = ler("../lib/follow-up-persistencia.ts");
  assert.match(persist, /expira_em"\)/);
  assert.match(persist, /status: statusEfetivoOportunidade\(data\)/);
});

test("fiação: Gerente, Follow-up e Receita Perdida leem oportunidades pela mesma API", () => {
  for (const p of ["../app/copiloto/page.tsx", "../app/follow-up/page.tsx", "../app/receita-perdida/page.tsx"]) {
    assert.match(ler(p), /\/api\/oportunidades/, p);
    assert.doesNotMatch(ler(p), /from\(['"]oportunidades_demanda/, p);
  }
});
