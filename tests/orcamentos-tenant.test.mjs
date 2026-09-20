// Guarda estática de isolamento de tenant para as rotas de orçamentos —
// não substitui um teste de RLS contra um Supabase real (isso continua
// pendente, ver tests/orcamentos-rls.pendente.test.mjs), mas prova
// automaticamente, a cada execução, que o CÓDIGO nunca perdeu um filtro de
// clinica_id nas escritas/leituras reais — a classe de regressão mais
// comum e mais barata de pegar sem precisar de um ambiente de teste.

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
const rotaListaCria = readFileSync(path.join(root, "app/api/orcamentos/route.ts"), "utf8").replace(/\r\n/g, "\n");
const rotaTransicao = readFileSync(path.join(root, "app/api/orcamentos/[id]/transicao/route.ts"), "utf8").replace(/\r\n/g, "\n");

test("GET /api/orcamentos: autoriza antes de qualquer leitura, e a leitura é filtrada por clinica_id", () => {
  const idxAuth = rotaListaCria.indexOf("export async function GET");
  const trechoGet = rotaListaCria.slice(idxAuth);
  assert.match(trechoGet, /autorizarUsuarioNaClinica\(req, clinica_id\)/);
  assert.match(trechoGet, /\.from\("orcamentos"\)\.select\("\*"\)\.eq\("clinica_id", clinica_id\)/);
});

test("POST /api/orcamentos: autoriza antes de qualquer escrita, e o insert usa a clinica_id já autorizada", () => {
  const idxAuth = rotaListaCria.indexOf("export async function POST");
  const idxAutorizacao = rotaListaCria.indexOf("autorizarUsuarioNaClinica(req, clinica_id)", idxAuth);
  const idxInsertOrcamento = rotaListaCria.indexOf('.from("orcamentos")\n    .insert(', idxAuth);
  assert.ok(idxAutorizacao > idxAuth, "autorização não encontrada dentro de POST");
  assert.ok(idxInsertOrcamento > idxAutorizacao, "insert em orcamentos acontece antes da autorização");
  // O insert usa a variável `clinica_id` (a mesma checada por autorizarUsuarioNaClinica),
  // nunca um segundo campo não validado do body.
  const trechoInsert = rotaListaCria.slice(idxInsertOrcamento, idxInsertOrcamento + 300);
  assert.match(trechoInsert, /clinica_id,/);
});

test("POST /api/orcamentos: consulta e insert de eventos_dominio (idempotência) também filtram por clinica_id", () => {
  const ocorrenciasEventosDominio = [...rotaListaCria.matchAll(/\.from\("eventos_dominio"\)/g)];
  assert.ok(ocorrenciasEventosDominio.length >= 2, "esperava pelo menos consulta + insert em eventos_dominio");
  assert.match(rotaListaCria, /\.from\("eventos_dominio"\)\s*\.select\("entidade_id"\)\s*\.eq\("clinica_id", clinica_id\)/);
});

test("POST /api/orcamentos/[id]/transicao: autoriza antes de buscar o orçamento", () => {
  const idxAuth = rotaTransicao.indexOf("autorizarUsuarioNaClinica(req, clinica_id)");
  const idxSelect = rotaTransicao.indexOf('.from("orcamentos")\n    .select("*")');
  assert.ok(idxAuth > 0 && idxSelect > idxAuth, "SELECT do orçamento acontece antes (ou sem) autorização");
});

test("transição: SELECT do orçamento é escopado por id E clinica_id (nunca só por id)", () => {
  assert.match(
    rotaTransicao,
    /\.from\("orcamentos"\)\s*\.select\("\*"\)\s*\.eq\("id", id\)\s*\.eq\("clinica_id", clinica_id\)/
  );
});

test("transição: UPDATE do orçamento também é escopado por clinica_id (defesa em profundidade)", () => {
  const idxUpdate = rotaTransicao.indexOf(".update({ ...resultado");
  const trechoUpdate = rotaTransicao.slice(idxUpdate, idxUpdate + 250);
  assert.match(trechoUpdate, /\.eq\("clinica_id", clinica_id\)/);
});

test("transição: evento de auditoria também grava a clinica_id autorizada, nunca uma segunda fonte", () => {
  const idxEvento = rotaTransicao.indexOf(".from(\"eventos_dominio\").insert(");
  const trechoEvento = rotaTransicao.slice(idxEvento, idxEvento + 200);
  assert.match(trechoEvento, /clinica_id,/);
});
