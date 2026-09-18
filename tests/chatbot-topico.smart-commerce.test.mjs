// ── Testes reais (node:test) · lib/chatbot-topico.ts ────────────────────────
// Roda contra o JS REAL compilado (não uma reimplementação) — ver
// README-TESTES no mesmo diretório para como (re)gerar o build.
//
// Cobre: classificarTopico (mesma regra extraída de
// app/api/chatbot/message/route.ts, sem alteração de comportamento) e
// classificarConversasChatbot (organização pura dos candidatos a
// interesse_sem_compra/demanda_nao_atendida — nunca decide conversão, isso
// é responsabilidade de quem chama, a partir de `agendamentos` real).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BUILD = process.env.SMART_COMMERCE_BUILD_DIR;
if (!BUILD) {
  throw new Error(
    "Defina SMART_COMMERCE_BUILD_DIR apontando para o diretorio com o build " +
    "commonjs de lib/chatbot-topico.ts (ver README-TESTES.md)."
  );
}

const { classificarTopico, classificarConversasChatbot } = require(`${BUILD}/chatbot-topico.js`);

// ── classificarTopico: mesma regra de app/api/chatbot/message/route.ts ─────

test("classificarTopico: mensagem de agendamento vira 'agendar'", () => {
  assert.equal(classificarTopico("Quero marcar uma consulta"), "agendar");
});

test("classificarTopico: mensagem sem padrao reconhecido vira 'default'", () => {
  assert.equal(classificarTopico("blablabla xyz 123"), "default");
});

test("classificarTopico: pedido de humano vira 'humano'", () => {
  assert.equal(classificarTopico("quero falar com um atendente"), "humano");
});

test("classificarTopico: pergunta de horario vira 'horario', nunca 'agendar'", () => {
  assert.equal(classificarTopico("que horas voces abrem?"), "horario");
});

// ── classificarConversasChatbot: interesse ──────────────────────────────────

function log(overrides = {}) {
  return {
    id: "log1", telefone: "11999990000", nomePaciente: "Ana",
    mensagemPaciente: "Quero marcar uma consulta", processadoPor: "regras",
    data: "2026-09-15",
    ...overrides,
  };
}

test("interesse: mensagem com intencao de agendar entra em 'interesse', independente de quem respondeu", () => {
  const { interesse, semResolucao } = classificarConversasChatbot([
    log({ processadoPor: "ia_universal:agendamento" }),
  ]);
  assert.equal(interesse.length, 1);
  assert.equal(interesse[0].telefone, "11999990000");
  assert.equal(semResolucao.length, 0);
});

test("interesse: dedup por telefone mantem so a conversa mais recente (primeira da lista)", () => {
  const { interesse } = classificarConversasChatbot([
    log({ id: "log-recente", data: "2026-09-17" }),
    log({ id: "log-antigo",  data: "2026-09-01" }),
  ]);
  assert.equal(interesse.length, 1);
  assert.equal(interesse[0].id, "log-recente");
});

// ── classificarConversasChatbot: semResolucao ───────────────────────────────

test("semResolucao: so entra quando processadoPor='regras' E topico e 'default'/'humano'", () => {
  const { semResolucao } = classificarConversasChatbot([
    log({ mensagemPaciente: "blablabla xyz", processadoPor: "regras" }),
  ]);
  assert.equal(semResolucao.length, 1);
});

test("semResolucao: NAO entra quando treinamento/ia_universal ja resolveu, mesmo com texto nao reconhecido", () => {
  const { semResolucao } = classificarConversasChatbot([
    log({ mensagemPaciente: "blablabla xyz", processadoPor: "treinamento" }),
  ]);
  assert.equal(semResolucao.length, 0);
});

test("semResolucao: mensagem reconhecida (ex.: horario) processada por regras NAO conta como demanda nao atendida", () => {
  const { semResolucao } = classificarConversasChatbot([
    log({ mensagemPaciente: "que horas voces abrem?", processadoPor: "regras" }),
  ]);
  assert.equal(semResolucao.length, 0);
});

test("classificarConversasChatbot: ignora log sem telefone ou sem mensagem", () => {
  const { interesse, semResolucao } = classificarConversasChatbot([
    log({ telefone: "" }),
    log({ mensagemPaciente: "" }),
  ]);
  assert.equal(interesse.length, 0);
  assert.equal(semResolucao.length, 0);
});
