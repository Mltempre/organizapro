// "OrganizaPro trabalhando" (Bloco G da Casa) — motor puro.
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/organizapro-trabalhando.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const ot = await import(pathToFileURL(path.join(buildDir, "organizapro-trabalhando.js")));

test("calcularAtividadeRecente: lista vazia real nunca fabrica item nenhum", () => {
  assert.deepEqual(ot.calcularAtividadeRecente([]), []);
});

test("calcularAtividadeRecente: só conta o tipo/resultado real — nunca mistura tipos diferentes", () => {
  const eventos = [
    { tipo: "cobranca.tentativa", resultado: null },
    { tipo: "cobranca.tentativa", resultado: null },
    { tipo: "followup.tentativa", resultado: null },
  ];
  const itens = ot.calcularAtividadeRecente(eventos);
  const cobranca = itens.find((i) => i.label.includes("cobrança"));
  const followup = itens.find((i) => i.label.includes("follow-up"));
  assert.equal(cobranca.quantidade, 2);
  assert.equal(followup.quantidade, 1);
});

test("calcularAtividadeRecente: eventos com resultadoFiltro só contam quando o resultado bate exatamente (nunca conta 'falhou' como sucesso)", () => {
  const eventos = [
    { tipo: "cobranca.envio", resultado: "sucesso" },
    { tipo: "cobranca.envio", resultado: "falhou" },
    { tipo: "cobranca.envio", resultado: "falhou" },
  ];
  const itens = ot.calcularAtividadeRecente(eventos);
  const enviadas = itens.find((i) => i.label.includes("cobrança") && i.label.includes("enviada"));
  assert.equal(enviadas.quantidade, 1);
});

test("calcularAtividadeRecente: item com quantidade zero nunca aparece na lista (nunca finge atividade)", () => {
  const eventos = [{ tipo: "gbp.resposta_publicada", resultado: "falhou" }];
  const itens = ot.calcularAtividadeRecente(eventos);
  assert.equal(itens.some((i) => i.label.includes("avaliaç")), false);
});

test("calcularAtividadeRecente: singular/plural correto no label", () => {
  const umEvento = ot.calcularAtividadeRecente([{ tipo: "followup.tentativa", resultado: null }]);
  assert.match(umEvento[0].label, /^follow-up comercial preparado$/);
  const doisEventos = ot.calcularAtividadeRecente([
    { tipo: "followup.tentativa", resultado: null },
    { tipo: "followup.tentativa", resultado: null },
  ]);
  assert.match(doisEventos[0].label, /^follow-ups comerciais preparados$/);
});

test("calcularAtividadeRecente: tipos não reconhecidos são ignorados, nunca quebram nem viram item genérico", () => {
  const itens = ot.calcularAtividadeRecente([{ tipo: "algum.tipo.desconhecido", resultado: null }]);
  assert.deepEqual(itens, []);
});

test("TIPOS_ATIVIDADE_RECENTE: só tipos reais já usados em produção por outras missões (nenhum tipo novo inventado)", () => {
  const esperados = ["cobranca.tentativa", "followup.tentativa", "cobranca.envio", "followup.envio", "gbp.resposta_publicada"];
  for (const t of esperados) assert.ok(ot.TIPOS_ATIVIDADE_RECENTE.includes(t), `esperava ${t} na whitelist`);
  assert.equal(ot.TIPOS_ATIVIDADE_RECENTE.length, esperados.length);
});
