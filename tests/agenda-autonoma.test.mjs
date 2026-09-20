// Agenda Autônoma de Receita V1 — extração mínima e pura. Prova que os 3
// sinais já existentes (cancelamento_sem_reagendamento, confirmacao_
// pendente, sem_proximo_compromisso) continuam com a MESMA regra real já
// usada em app/dashboard/page.tsx, que casos resolvidos por dado real
// somem sozinhos (nunca precisam de um "fechamento" fabricado), e que a
// tela nova nunca escreve fora do escopo de tenant.
//
// Sem imports internos em lib/agenda-autonoma.ts — roda direto contra o
// TS via type-stripping nativo do Node, mesmo padrão de
// tests/oportunidades-demanda.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  cancelamentosSemReagendamento,
  precisaConfirmacao,
  semProximoCompromisso,
  gerarCasosAgendaAutonoma,
} from "../lib/agenda-autonoma.ts";

const HOJE = "2026-09-20";

// ── 1-2. Cancelamento elegível / já reagendado ───────────────────────────

test("cancelamento elegível: telefone sem nenhum reagendamento futuro aparece como caso aberto", () => {
  const r = cancelamentosSemReagendamento(
    [{ id: "c1", nome: "Ana", telefone: "11999990001", data: "2026-09-10" }],
    new Set()
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "c1");
});

test("cancelamento já reagendado (telefone com compromisso futuro real) NUNCA aparece como caso aberto", () => {
  const r = cancelamentosSemReagendamento(
    [{ id: "c1", nome: "Ana", telefone: "11999990001", data: "2026-09-10" }],
    new Set(["11999990001"])
  );
  assert.equal(r.length, 0);
});

test("cancelamento sem telefone nunca vira caso (nada a contatar, nunca inferido)", () => {
  const r = cancelamentosSemReagendamento(
    [{ id: "c1", nome: "Ana", telefone: "", data: "2026-09-10" }],
    new Set()
  );
  assert.equal(r.length, 0);
});

// ── 3-4. Confirmação pendente / resolvida ────────────────────────────────

test("confirmação pendente: status 'agendado' precisa de confirmação", () => {
  assert.equal(precisaConfirmacao("agendado"), true);
});

test("confirmação resolvida: qualquer status diferente de 'agendado' deixa de exigir ação", () => {
  assert.equal(precisaConfirmacao("confirmado"), false);
  assert.equal(precisaConfirmacao("cancelado"), false);
  assert.equal(precisaConfirmacao("concluido"), false);
  assert.equal(precisaConfirmacao("faltou"), false);
});

// ── 5. Sem próximo compromisso — regra canônica ──────────────────────────

test("sem próximo compromisso: null é sempre elegível (fato, nunca inferido)", () => {
  assert.equal(semProximoCompromisso(null, HOJE), true);
});

test("sem próximo compromisso: data passada é elegível", () => {
  assert.equal(semProximoCompromisso("2026-09-01", HOJE), true);
});

test("sem próximo compromisso: data futura NÃO é elegível", () => {
  assert.equal(semProximoCompromisso("2026-12-01", HOJE), false);
});

test("sem próximo compromisso: hoje mesmo NÃO é elegível (só estritamente antes de hoje)", () => {
  assert.equal(semProximoCompromisso(HOJE, HOJE), false);
});

// ── 6. Idempotência ───────────────────────────────────────────────────────

test("idempotência: mesmo telefone cancelado duas vezes na entrada gera só UM caso (o primeiro da lista, mais recente por convenção de ordenação de quem chama)", () => {
  const r = cancelamentosSemReagendamento(
    [
      { id: "c-recente", nome: "Ana", telefone: "11999990001", data: "2026-09-15" },
      { id: "c-antigo", nome: "Ana", telefone: "11999990001", data: "2026-09-01" },
    ],
    new Set()
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "c-recente");
});

test("idempotência: chamar gerarCasosAgendaAutonoma duas vezes com a mesma entrada produz exatamente o mesmo resultado, nunca duplicado", () => {
  const entrada = {
    hoje: HOJE,
    cancelamentosRecentes: [{ id: "c1", nome: "Ana", telefone: "11999990001", data: "2026-09-10" }],
    telefonesComReagendamentoFuturo: new Set(),
    agendaHoje: [{ id: "a1", nome: "Bruno", telefone: "11999990002", status: "agendado" }],
    clientesAtivos: [{ id: "p1", nome: "Carla", telefone: "11999990003", whatsapp: null, proximaConsulta: null }],
  };
  const r1 = gerarCasosAgendaAutonoma(entrada);
  const r2 = gerarCasosAgendaAutonoma(entrada);
  assert.deepEqual(r1, r2);
  assert.equal(r1.length, 3);
});

// ── 9. Ausência de dado nunca vira dado inventado ────────────────────────

test("honestidade: entrada real vazia nunca fabrica nenhum caso", () => {
  const r = gerarCasosAgendaAutonoma({
    hoje: HOJE, cancelamentosRecentes: [], telefonesComReagendamentoFuturo: new Set(), agendaHoje: [], clientesAtivos: [],
  });
  assert.equal(r.length, 0);
});

// ── 10. Caso resolvido não permanece pendente ────────────────────────────

test("caso resolvido por dado real (reagendamento aconteceu) some da lista, nunca precisa de um fechamento manual fabricado", () => {
  const entradaAberta = {
    hoje: HOJE,
    cancelamentosRecentes: [{ id: "c1", nome: "Ana", telefone: "11999990001", data: "2026-09-10" }],
    telefonesComReagendamentoFuturo: new Set(),
    agendaHoje: [], clientesAtivos: [],
  };
  assert.equal(gerarCasosAgendaAutonoma(entradaAberta).length, 1);

  const entradaResolvida = { ...entradaAberta, telefonesComReagendamentoFuturo: new Set(["11999990001"]) };
  assert.equal(gerarCasosAgendaAutonoma(entradaResolvida).length, 0);
});

// ── Cada categoria com origem/evidência rastreável e destino correto ────

test("cada caso tem tipo, motivo e destino corretos, nunca misturado entre categorias", () => {
  const r = gerarCasosAgendaAutonoma({
    hoje: HOJE,
    cancelamentosRecentes: [{ id: "c1", nome: "Ana", telefone: "11999990001", data: "2026-09-10" }],
    telefonesComReagendamentoFuturo: new Set(),
    agendaHoje: [{ id: "a1", nome: "Bruno", telefone: "11999990002", status: "agendado" }],
    clientesAtivos: [{ id: "p1", nome: "Carla", telefone: "11999990003", whatsapp: null, proximaConsulta: null }],
  });
  const porTipo = Object.fromEntries(r.map(c => [c.tipo, c]));
  assert.equal(porTipo.cancelamento_sem_reagendamento.destino, "/agendamentos");
  assert.equal(porTipo.confirmacao_pendente.destino, "/agendamentos");
  assert.equal(porTipo.sem_proximo_compromisso.destino, "/agendamentos");
  assert.match(porTipo.cancelamento_sem_reagendamento.motivo, /cancelou/i);
  assert.match(porTipo.confirmacao_pendente.motivo, /confirmad[oa]/i);
  assert.match(porTipo.sem_proximo_compromisso.motivo, /próximo compromisso/i);
});

// ── 7-8. Wiring: tenant isolation na tela nova ───────────────────────────

const pagina = fs.readFileSync(new URL("../app/agenda-autonoma/page.tsx", import.meta.url), "utf8");

test("agenda-autonoma: toda consulta a agendamentos/pacientes é escopada por clinica_id, nunca lida de outro tenant", () => {
  const consultas = pagina.match(/\.from\('(agendamentos|pacientes)'\)[\s\S]{0,200}?\.eq\('clinica_id', cid\)/g) || [];
  // Pelo menos as 3 consultas de leitura + a busca de reagendamento futuro.
  assert.ok(consultas.length >= 3, `esperado >=3 consultas escopadas por clinica_id, achou ${consultas.length}`);
});

test("agenda-autonoma: a única mutação (confirmar) nunca confia em clinica_id de fora do vínculo autenticado, e guarda contra reprocessamento", () => {
  assert.match(pagina, /\.update\(\{ status: 'confirmado', confirmado: true \}\)/);
  assert.match(pagina, /\.eq\('id', caso\.id\)/);
  assert.match(pagina, /\.eq\('clinica_id', clinicaId\)/);
  assert.match(pagina, /\.eq\('status', 'agendado'\)/);
  assert.doesNotMatch(pagina, /clinicaId\s*=\s*(req|body|searchParams)/);
});

test("agenda-autonoma: nenhuma ação de reagendamento é fabricada — cancelamento e sem-próximo-compromisso só navegam para /agendamentos (ação assistida real)", () => {
  assert.match(pagina, /router\.push\(caso\.destino\)/);
  assert.doesNotMatch(pagina, /status:\s*['"]reagendar['"]/);
});
