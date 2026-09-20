import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transicaoPermitida, normalizarTelefone, validarNovaOportunidade } from "../lib/oportunidades-demanda.ts";

const rota = fs.readFileSync(new URL("../app/api/oportunidades/route.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260919000001_oportunidades_demanda_canonica_v1.sql", import.meta.url), "utf8");

test("normaliza telefone sem alterar a proveniência", () => {
  assert.equal(normalizarTelefone("+55 (11) 99999-0000"), "5511999990000");
});

test("aceita apenas transições forward-only", () => {
  assert.equal(transicaoPermitida("sinalizada", "em_contato"), true);
  assert.equal(transicaoPermitida("atendida", "convertida"), true);
  assert.equal(transicaoPermitida("convertida", "sinalizada"), false);
  assert.equal(transicaoPermitida("em_contato", "convertida"), false);
});

test("exige chave de idempotência e telefone válido", () => {
  const base = { canal: "manual", telefone: "11999990000", confianca_classificacao: "alta", expira_em: "2026-10-01", chave_idempotencia: "evt-1" };
  assert.equal(validarNovaOportunidade(base), null);
  assert.match(validarNovaOportunidade({ ...base, chave_idempotencia: "" }), /chave/);
  assert.match(validarNovaOportunidade({ ...base, telefone: "123" }), /telefone/);
});

test("contrato de autorização nunca aceita tenant vindo do body", () => {
  assert.match(rota, /autorizarUsuarioNaClinica/);
  assert.match(rota, /clinica_id: auth\.clinicaId/);
  assert.match(rota, /\.eq\("clinica_id", auth\.clinicaId\)/);
});

test("contrato SQL protege tenant, transição concorrente e replay", () => {
  assert.match(migration, /WHERE id = p_id AND clinica_id = p_clinica_id FOR UPDATE/);
  assert.match(migration, /jsonb_array_elements\(atual\.jornada\)/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS oportunidades_demanda_clinica_chave_uidx/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION .* TO service_role/);
});