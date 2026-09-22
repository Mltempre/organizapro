// P1.1 — Fechar a Casa do OrganizaPro: causa raiz do vínculo negócio/
// usuário. Motor puro que decide SE um usuário pode se auto-provisionar
// via POST /api/minha-clinica/provisionar — nunca decide por fallback
// inseguro (um vínculo existente inativo ou de outro produto NUNCA é
// reaproveitado/reativado automaticamente).
//
// CONVERGENCIA_BUILD_DIR=<tmp> node --test tests/onboarding-negocio.test.mjs
// (build precisa incluir onboarding-negocio.js)

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { decidirProvisionamento } = await import(pathToFileURL(path.join(buildDir, "onboarding-negocio.js")));

test("sem nenhum vínculo existente e nome válido: pode criar", () => {
  assert.deepEqual(decidirProvisionamento(null, "Barbearia do João"), { acao: "criar" });
});

test("sem vínculo e nome vazio/ausente: bloqueado, nunca fabrica um nome", () => {
  assert.equal(decidirProvisionamento(null, "").acao, "bloqueado");
  assert.equal(decidirProvisionamento(null, undefined).acao, "bloqueado");
  assert.equal(decidirProvisionamento(null, "  ").acao, "bloqueado");
  assert.equal(decidirProvisionamento(null, "A").acao, "bloqueado"); // menor que 2 caracteres
});

test("sem vínculo e nome absurdamente longo: bloqueado", () => {
  assert.equal(decidirProvisionamento(null, "x".repeat(121)).acao, "bloqueado");
});

test("já vinculado e ativo ao organizapro: reaproveita o existente (idempotente), nunca cria um segundo negócio", () => {
  const r = decidirProvisionamento({ ativo: true, produtoClinica: "organizapro" }, "Nome novo ignorado");
  assert.deepEqual(r, { acao: "reaproveitar_existente" });
});

test("vínculo existente mas INATIVO: bloqueado — nunca reativa sozinho (fail-closed)", () => {
  const r = decidirProvisionamento({ ativo: false, produtoClinica: "organizapro" }, "Qualquer nome");
  assert.equal(r.acao, "bloqueado");
});

test("vínculo existente mas de OUTRO produto (clinicaflow): bloqueado — nunca reatribui produto sozinho", () => {
  const r = decidirProvisionamento({ ativo: true, produtoClinica: "clinicaflow" }, "Qualquer nome");
  assert.equal(r.acao, "bloqueado");
});

test("vínculo existente com produto nulo (dado incompleto): bloqueado, nunca assume organizapro por omissão", () => {
  const r = decidirProvisionamento({ ativo: true, produtoClinica: null }, "Qualquer nome");
  assert.equal(r.acao, "bloqueado");
});
