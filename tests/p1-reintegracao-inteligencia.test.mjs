// P1 IMEDIATO — Reintegrar a Inteligência do OrganizaPro. Prova o único
// código novo desta missão: o adaptador do primeiro elo do Smart Commerce
// ("interesse sem compra", public.oportunidades_demanda) para o Sinal
// Canônico — elegibilidade reaproveita oportunidadeElegivelParaOrcamento;
// prioridade comercial e confiança do classificador permanecem conceitos
// separados.
//
// CONVERGENCIA_BUILD_DIR=<tmp> node --test tests/p1-reintegracao-inteligencia.test.mjs
// (build precisa incluir nucleo-inteligente.js e oportunidades-demanda.js)

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { adaptarOportunidadesDemanda, organizarSinaisCanonicos } = await import(pathToFileURL(path.join(buildDir, "nucleo-inteligente.js")));

const BASE = { id: "op1", canal: "whatsapp", telefone: "11911112222", nome_informado: "Ana", confianca_classificacao: "alta", orcamento_vinculado_id: null };

test("oportunidade aberta e sem orçamento vinculado vira Sinal Canônico", () => {
  const r = adaptarOportunidadesDemanda([{ ...BASE, status: "sinalizada" }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "demanda-op1");
  assert.equal(r[0].especialista, "comercial");
  assert.equal(r[0].tipo, "interesse_sem_orcamento");
  assert.equal(r[0].prioridade, "media");
  assert.equal(r[0].confianca, "alta");
  assert.equal(r[0].dados.status, "sinalizada"); // preserva o estado operacional real
  assert.equal(r[0].contexto.telefone, "11911112222");
  assert.equal(r[0].entidadeTipo, "oportunidade");
  assert.equal(r[0].entidadeId, "op1");
  assert.equal(r[0].destino, "/oportunidades");
  assert.equal(r[0].chaveDedup, "demanda:op1");
});

test("oportunidade com orçamento já vinculado nunca vira sinal (mesmo predicado real de elegibilidade)", () => {
  const r = adaptarOportunidadesDemanda([{ ...BASE, status: "em_contato", orcamento_vinculado_id: "orc-1" }]);
  assert.deepEqual(r, []);
});

test("oportunidade em status terminal (convertida/perdida/expirada) nunca vira sinal", () => {
  for (const status of ["convertida", "perdida", "expirada"]) {
    const r = adaptarOportunidadesDemanda([{ ...BASE, status }]);
    assert.deepEqual(r, [], `status ${status} deveria ser excluído`);
  }
});

test("sem nome informado, título usa 'Contato' — nunca fabrica um nome", () => {
  const r = adaptarOportunidadesDemanda([{ ...BASE, status: "sinalizada", nome_informado: null }]);
  assert.match(r[0].titulo, /^Contato —/);
  assert.equal(r[0].contexto.nome, "Contato");
});

test("chaveDedup do primeiro elo (demanda:*) nunca colide com as chaves de cliente (cliente-*) ou de recomendação agregada (rec:*)", () => {
  const sinalDemanda = adaptarOportunidadesDemanda([{ ...BASE, status: "sinalizada" }])[0];
  const sinalCliente = { id: "cliente-x", especialista: "comercial", tipo: "orcamento_parado", prioridade: "alta", titulo: "t", motivo: "m", evidencia: "e", acaoSugerida: "a", chaveDedup: "cliente-x", criadoEm: null };
  const organizados = organizarSinaisCanonicos([sinalDemanda, sinalCliente]);
  assert.equal(organizados.length, 2, "nenhum dos dois sinais deveria ser removido por deduplicação");
});

test("confiança alta não promove interesse sem orçamento para prioridade comercial alta", () => {
  const interesse = adaptarOportunidadesDemanda([{ ...BASE, status: "sinalizada", confianca_classificacao: "alta" }])[0];
  const prioridadeAlta = { id: "cliente-x", especialista: "comercial", tipo: "orcamento_parado", prioridade: "alta", titulo: "t", motivo: "m", evidencia: "e", acaoSugerida: "a", chaveDedup: "cliente-x", criadoEm: null };
  const baixaOutra = { id: "cliente-y", especialista: "comercial", tipo: "sem_proximo_compromisso", prioridade: "baixa", titulo: "t", motivo: "m", evidencia: "e", acaoSugerida: "a", chaveDedup: "cliente-y", criadoEm: null };
  const organizados = organizarSinaisCanonicos([baixaOutra, interesse, prioridadeAlta]);
  assert.equal(organizados[0].id, prioridadeAlta.id);
  assert.equal(organizados[1].id, interesse.id);
});
