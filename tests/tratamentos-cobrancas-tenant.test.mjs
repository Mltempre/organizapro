// Guarda estática de isolamento de tenant para as rotas de tratamentos e
// cobranças — mesmo papel de tests/orcamentos-tenant.test.mjs: prova
// automática de que o código nunca perde um filtro de clinica_id.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Normaliza CRLF->LF: git pode reescrever line endings no checkout
// (core.autocrlf) dependendo do worktree — os padrões abaixo usam \n
// literal e não podem depender de como o Windows fez o checkout.
const normalizar = (s) => s.replace(/\r\n/g, "\n");
const rotasTratamento = {
  lista: normalizar(readFileSync(path.join(root, "app/api/tratamentos/route.ts"), "utf8")),
  transicao: normalizar(readFileSync(path.join(root, "app/api/tratamentos/[id]/transicao/route.ts"), "utf8")),
};
const rotasCobranca = {
  lista: normalizar(readFileSync(path.join(root, "app/api/cobrancas/route.ts"), "utf8")),
  transicao: normalizar(readFileSync(path.join(root, "app/api/cobrancas/[id]/transicao/route.ts"), "utf8")),
};

for (const [nome, rotas, entidade] of [["tratamentos", rotasTratamento, "tratamento"], ["cobrancas", rotasCobranca, "cobranca"]]) {
  test(`GET /api/${nome}: leitura filtrada por clinica_id`, () => {
    assert.match(rotas.lista, new RegExp(`\\.from\\("${nome}"\\)\\.select\\("\\*"\\)\\.eq\\("clinica_id", clinica_id\\)`));
  });

  test(`POST /api/${nome}: autoriza antes do insert, e o insert usa a clinica_id autorizada`, () => {
    const idxAuth = rotas.lista.indexOf("export async function POST");
    const idxAutorizacao = rotas.lista.indexOf("autorizarUsuarioNaClinica(req, clinica_id)", idxAuth);
    const idxInsert = rotas.lista.indexOf(`.from("${nome}")\n    .insert(`, idxAuth);
    assert.ok(idxAutorizacao > idxAuth, `autorização não encontrada em POST /api/${nome}`);
    assert.ok(idxInsert > idxAutorizacao, `insert em ${nome} acontece antes da autorização`);
  });

  test(`transição /api/${nome}: SELECT escopado por id E clinica_id`, () => {
    assert.match(
      rotas.transicao,
      new RegExp(`\\.from\\("${nome}"\\)\\s*\\.select\\("\\*"\\)\\s*\\.eq\\("id", id\\)\\s*\\.eq\\("clinica_id", clinica_id\\)`)
    );
  });

  test(`transição /api/${nome}: UPDATE também escopado por clinica_id (defesa em profundidade)`, () => {
    const idxUpdate = rotas.transicao.indexOf(".update({ ...resultado");
    const trecho = rotas.transicao.slice(idxUpdate, idxUpdate + 250);
    assert.match(trecho, /\.eq\("clinica_id", clinica_id\)/);
  });

  test(`/api/${nome}: eventos_dominio (idempotência/auditoria) sempre filtra/grava por clinica_id`, () => {
    assert.match(rotas.lista, /\.from\("eventos_dominio"\)\s*\.select\("entidade_id"\)\s*\.eq\("clinica_id", clinica_id\)/);
    const idxEvento = rotas.transicao.indexOf('.from("eventos_dominio").insert(');
    assert.match(rotas.transicao.slice(idxEvento, idxEvento + 200), /clinica_id,/);
  });
}

test("tratamentos: criação com orcamento_origem_id valida que o orçamento pertence à mesma clínica antes de aceitar o vínculo", () => {
  assert.match(
    rotasTratamento.lista,
    /\.from\("orcamentos"\)\s*\.select\("id, valor"\)\s*\.eq\("id", orcamento_origem_id\)\s*\.eq\("clinica_id", clinica_id\)/
  );
});

test("cobrancas: criação com tratamento_origem_id valida que o tratamento pertence à mesma clínica antes de aceitar o vínculo", () => {
  assert.match(
    rotasCobranca.lista,
    /\.from\("tratamentos"\)\s*\.select\("id, valor_estimado"\)\s*\.eq\("id", tratamento_origem_id\)\s*\.eq\("clinica_id", clinica_id\)/
  );
});
