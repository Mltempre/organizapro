// ── PENDENTE DE GATE — prova de isolamento tenant contra Supabase real ──────
//
// public.orcamentos e public.eventos_dominio JÁ EXISTEM em Production com
// RLS habilitada e ZERO policies (confirmado no dump de schema real —
// schema-producao-organizapro-20260919.sql) — ou seja, acesso só é possível
// via service role, nunca via chave anon/authenticated diretamente. Isso já
// é, por si só, a proteção mais forte possível (nenhuma linha visível fora
// do backend), e é EXATAMENTE por isso que app/api/orcamentos/route.ts e
// app/api/orcamentos/[id]/transicao/route.ts usam o client admin
// (service role) e reimplementam o controle de tenant na aplicação
// (autorizarUsuarioNaClinica + .eq("clinica_id", ...) em toda query — ver
// tests/orcamentos-tenant.test.mjs para a prova estática disso).
//
// O que ESTE arquivo cobriria, se rodado contra um Supabase de TESTE real
// (nunca produção), é a ponta a ponta via HTTP das próprias rotas — prova
// que o comportamENTO real da API corresponde ao que o código estático
// promete. Por isso todos os casos usam `test.skip(...)` — o runner do
// Node reporta "skipped", nunca "passed". Ninguém deve ler um "passed"
// aqui como prova de isolamento; a prova estática de tests/orcamentos-
// tenant.test.mjs é o que roda de verdade hoje.
//
// Como ativar (quando autorizado):
//   1. Ter um projeto Supabase de TESTE real (nunca produção) com as
//      tabelas orcamentos/eventos_dominio/clinicas/clinica_usuarios já
//      existentes (mesmo schema do dump real).
//   2. Criar dois tenants fixture (CLINICA_A_ID, CLINICA_B_ID, ambos com
//      clinicas.produto = 'organizapro'), um usuário autenticado vinculado
//      só à CLINICA_A_ID via clinica_usuarios, e rodar o app Next.js local
//      apontando para esse projeto de teste.
//   3. Preencher as variáveis de ambiente abaixo.
//   4. Trocar cada `test.skip` por `test`.
//   5. Só reportar PASS depois de ver o resultado real — nunca antes.

import { test } from "node:test";
import assert from "node:assert/strict";

const AMBIENTE_DE_TESTE_PRONTO = false; // vira true só quando os passos acima existirem

const APP_URL              = process.env.ORCAMENTOS_TEST_APP_URL;
const CLINICA_A_ID         = process.env.SUPABASE_TEST_CLINICA_A_ID;
const CLINICA_B_ID         = process.env.SUPABASE_TEST_CLINICA_B_ID;
const USUARIO_A_TOKEN      = process.env.SUPABASE_TEST_USUARIO_A_TOKEN;

const REF_PRODUCTION = "rxuedvrvujwlprsaprgn";
function abortarSeForProduction(url) {
  if (url && url.includes(REF_PRODUCTION)) {
    throw new Error("ABORTADO: aponta para o project ref de PRODUCTION. Nunca rodar isto contra produção.");
  }
}

function skipOuFalhaSeAmbienteIncompleto() {
  if (!AMBIENTE_DE_TESTE_PRONTO) return true;
  abortarSeForProduction(APP_URL);
  const faltando = [
    ["ORCAMENTOS_TEST_APP_URL", APP_URL],
    ["SUPABASE_TEST_CLINICA_A_ID", CLINICA_A_ID],
    ["SUPABASE_TEST_CLINICA_B_ID", CLINICA_B_ID],
    ["SUPABASE_TEST_USUARIO_A_TOKEN", USUARIO_A_TOKEN],
  ].filter(([, v]) => !v).map(([nome]) => nome);
  if (faltando.length > 0) {
    throw new Error(`Ambiente marcado como pronto mas faltam variáveis: ${faltando.join(", ")}`);
  }
  return false;
}

test.skip("usuário A não consegue LISTAR orçamentos de CLINICA_B via GET /api/orcamentos?clinica_id=B", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

test.skip("usuário A não consegue CRIAR orçamento em CLINICA_B via POST /api/orcamentos", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

test.skip("usuário A não consegue TRANSICIONAR um orçamento real de CLINICA_B (nem informando o id certo)", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

test.skip("usuário A opera normalmente (listar/criar/transicionar) dentro da própria CLINICA_A", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

test.skip("requisição sem Authorization é sempre 401 nas 3 rotas (GET/POST/transicao)", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});
