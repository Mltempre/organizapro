// ── PENDENTE DE GATE — testes de integração/RLS de origem_captacoes ────────
//
// A migration em docs/atribuicao-origem-fase1-migration-preparada.md NÃO
// foi executada em nenhum ambiente. Estes testes exigem um Supabase real
// (projeto de TESTE isolado, nunca produção) com a migration aplicada e
// dois tenants fixture já criados. Por isso todos os casos abaixo usam
// `test.skip(...)` — o runner do Node reporta "skipped", nunca "passed".
// NINGUÉM deve ler um "passed" aqui como prova de que o isolamento
// funciona; a única prova válida é rodar isto de verdade contra o
// ambiente de teste, depois que o GO da migration existir.
//
// Como ativar (quando autorizado):
//   1. Aplicar a migration num projeto Supabase de TESTE (nunca produção).
//   2. Criar dois tenants fixture (CLINICA_A_ID, CLINICA_B_ID) e um usuário
//      autenticado vinculado só à CLINICA_A_ID via clinica_usuarios.
//   3. Preencher as variáveis de ambiente abaixo (URL/anon key/service
//      role key do projeto de TESTE, nunca as de produção).
//   4. Trocar cada `test.skip` por `test` e rodar `node --test
//      tests/origem-captacoes-rls.pendente.test.mjs`.
//   5. Só reportar PASS depois de ver o resultado real — nunca antes.

import { test } from "node:test";
import assert from "node:assert/strict";

const AMBIENTE_DE_TESTE_PRONTO = false; // vira true só quando os passos acima existirem

const SUPABASE_URL             = process.env.SUPABASE_TEST_URL;
const SUPABASE_ANON_KEY        = process.env.SUPABASE_TEST_ANON_KEY;
const SUPABASE_SERVICE_ROLE    = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const CLINICA_A_ID             = process.env.SUPABASE_TEST_CLINICA_A_ID;
const CLINICA_B_ID             = process.env.SUPABASE_TEST_CLINICA_B_ID;
const USUARIO_A_EMAIL          = process.env.SUPABASE_TEST_USUARIO_A_EMAIL;
const USUARIO_A_SENHA          = process.env.SUPABASE_TEST_USUARIO_A_SENHA;

function skipOuFalhaSeAmbienteIncompleto() {
  if (!AMBIENTE_DE_TESTE_PRONTO) return true;
  const faltando = [
    ["SUPABASE_TEST_URL", SUPABASE_URL],
    ["SUPABASE_TEST_ANON_KEY", SUPABASE_ANON_KEY],
    ["SUPABASE_TEST_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE],
    ["SUPABASE_TEST_CLINICA_A_ID", CLINICA_A_ID],
    ["SUPABASE_TEST_CLINICA_B_ID", CLINICA_B_ID],
  ].filter(([, v]) => !v).map(([nome]) => nome);
  if (faltando.length > 0) {
    throw new Error(`Ambiente marcado como pronto mas faltam variáveis: ${faltando.join(", ")}`);
  }
  return false;
}

// ── 1. Isolamento de leitura entre tenants ──────────────────────────────

test.skip("tenant A (autenticado, vinculado só a CLINICA_A) NÃO lê origem de CLINICA_B", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  // Roteiro: logar como USUARIO_A, inserir uma linha em origem_captacoes
  // para CLINICA_B via service_role (fixture), depois SELECT como
  // USUARIO_A filtrando por CLINICA_B_ID — esperado: 0 linhas (RLS nega o
  // acesso, nunca um filtro de aplicação que poderia ser esquecido).
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

test.skip("tenant A lê normalmente a própria origem (CLINICA_A)", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

// ── 2. Isolamento de alteração entre tenants ────────────────────────────

test.skip("tenant A (autenticado) NÃO consegue UPDATE em origem de CLINICA_B (nenhuma policy de UPDATE existe para authenticated)", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  // Esperado: erro de RLS/permissão — não existe nenhuma policy de UPDATE
  // para authenticated na migration preparada, então isto deve falhar
  // mesmo para a PRÓPRIA clínica de A, não só para a de B.
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

// ── 3. Usuário autenticado sem vínculo nenhum ───────────────────────────

test.skip("usuário autenticado sem nenhuma linha em clinica_usuarios não lê nenhuma origem (0 linhas, não erro)", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

// ── 4/5. anon sem SELECT/UPDATE/DELETE ──────────────────────────────────

test.skip("anon (chave pública, sem sessão) recebe erro de permissão ao tentar SELECT em origem_captacoes", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  // has_table_privilege('anon', 'origem_captacoes', 'SELECT') deve ser
  // false (ver POSTCHECK da migration) — este teste prova isso na prática,
  // fazendo a chamada real com a chave anon.
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

test.skip("anon recebe erro de permissão ao tentar UPDATE/DELETE em origem_captacoes", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

// ── 6. Browser não escolhe clinica_id arbitrário (o risco da Fase 1) ────

test.skip("anon recebe erro de permissão ao tentar INSERT em origem_captacoes, mesmo informando um clinica_id real de outro tenant", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  // Este é o teste que prova que o risco da Fase 1 foi eliminado, não só
  // documentado: com a Fase 1.1 (sem nenhuma policy de INSERT para anon),
  // uma tentativa de INSERT direto na API REST do Supabase, usando só a
  // chave anon pública, precisa falhar por RLS/permissão — mesmo enviando
  // um clinica_id de CLINICA_B que existe de verdade. Se este teste um dia
  // passar mostrando o INSERT bem-sucedido, é uma regressão de segurança
  // grave, não um "funcionou".
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});

test.skip("service_role consegue inserir e a leitura via authenticated (própria clínica) reflete a linha inserida", async () => {
  if (skipOuFalhaSeAmbienteIncompleto()) return;
  // Prova o caminho real (Fase C/D): só service_role escreve, e quem lê
  // depois é sempre escopado pela própria clínica.
  assert.fail("implementar contra ambiente de teste real antes de reportar PASS");
});
