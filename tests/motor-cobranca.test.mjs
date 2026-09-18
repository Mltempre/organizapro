// ── Testes reais (node:test) · lib/motor-cobranca.ts ─────────────────────────
// Roda contra o JS REAL compilado — ver README-TESTES no mesmo diretório.
// Cobre classificação determinística de resposta, próxima ação, mensagens
// e o motor de autonomia (sugerir/aprovar/automático) do Cobrador AI.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BUILD = process.env.SMART_COMMERCE_BUILD_DIR;
if (!BUILD) {
  throw new Error(
    "Defina SMART_COMMERCE_BUILD_DIR apontando para o diretorio com o build " +
    "commonjs de lib/motor-cobranca.ts (ver README-TESTES.md)."
  );
}

const {
  classificarRespostaCliente, tipoProximaAcao, gerarMensagemCobranca, decidirExecucao,
} = require(`${BUILD}/motor-cobranca.js`);

const HOJE = "2026-09-18";

function cobranca(overrides = {}) {
  return {
    id: "c1", clinicaId: "clinica-1", orcamentoId: null,
    valorCentavos: 10000, vencimento: "2026-09-25", status: "a_vencer",
    promessaData: null, ultimaAcaoEm: null, tentativas: 0, clienteOptOut: false,
    ...overrides,
  };
}

const CONFIG = { cooldownDias: 3, limiteTentativas: 5, horarioInicio: 8, horarioFim: 20, janelaLembreteDias: 3 };

// ── classificarRespostaCliente (determinístico, nunca LLM) ───────────────

test("classificarRespostaCliente: reconhece 'ja paguei' como informou_pagamento", () => {
  const r = classificarRespostaCliente("Oi, já paguei ontem!", HOJE);
  assert.equal(r.tipo, "informou_pagamento");
});

test("classificarRespostaCliente: reconhece promessa com data explicita", () => {
  const r = classificarRespostaCliente("Vou pagar dia 22/09", HOJE);
  assert.equal(r.tipo, "prometeu_pagamento");
  assert.equal(r.dataPrometida, "2026-09-22");
});

test("classificarRespostaCliente: promessa sem data explicita nao inventa uma data", () => {
  const r = classificarRespostaCliente("Vou pagar assim que eu receber", HOJE);
  assert.equal(r.tipo, "prometeu_pagamento");
  assert.equal(r.dataPrometida, null);
});

test("classificarRespostaCliente: reconhece contestacao", () => {
  const r = classificarRespostaCliente("Não reconheço essa cobrança", HOJE);
  assert.equal(r.tipo, "contestou");
});

test("classificarRespostaCliente: contestacao tem prioridade sobre pagamento quando ambos os padroes aparecem", () => {
  const r = classificarRespostaCliente("Já paguei antes, isso é engano, não devo isso", HOJE);
  assert.equal(r.tipo, "contestou");
});

test("classificarRespostaCliente: mensagem sem padrao reconhecido vira sem_classificacao (nunca adivinha)", () => {
  const r = classificarRespostaCliente("Bom dia, tudo bem?", HOJE);
  assert.equal(r.tipo, "sem_classificacao");
  assert.equal(r.dataPrometida, null);
});

test("classificarRespostaCliente: data com mes invalido nao e aceita como data prometida", () => {
  const r = classificarRespostaCliente("Vou pagar dia 45/99", HOJE);
  assert.equal(r.tipo, "prometeu_pagamento");
  assert.equal(r.dataPrometida, null);
});

// ── tipoProximaAcao ───────────────────────────────────────────────────────

test("tipoProximaAcao: null quando a_vencer esta fora da janela de lembrete", () => {
  const c = cobranca({ status: "a_vencer", vencimento: "2026-10-10" });
  assert.equal(tipoProximaAcao(c, HOJE), null);
});

test("tipoProximaAcao: lembrete_antecipado dentro da janela de lembrete", () => {
  const c = cobranca({ status: "a_vencer", vencimento: "2026-09-20" });
  assert.equal(tipoProximaAcao(c, HOJE), "lembrete_antecipado");
});

test("tipoProximaAcao: aviso_vencida quando ja esta vencida", () => {
  const c = cobranca({ status: "vencida", vencimento: "2026-09-10" });
  assert.equal(tipoProximaAcao(c, HOJE), "aviso_vencida");
});

test("tipoProximaAcao: cobranca_promessa_expirada quando a promessa passou sem pagamento", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: "2026-09-10" });
  assert.equal(tipoProximaAcao(c, HOJE), "cobranca_promessa_expirada");
});

test("tipoProximaAcao: null quando a promessa ainda esta dentro do prazo (respeita a promessa)", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: "2026-09-22" });
  assert.equal(tipoProximaAcao(c, HOJE), null);
});

test("tipoProximaAcao: null para estados que exigem humano (em_negociacao, aguardando_confirmacao)", () => {
  assert.equal(tipoProximaAcao(cobranca({ status: "em_negociacao" }), HOJE), null);
  assert.equal(tipoProximaAcao(cobranca({ status: "aguardando_confirmacao" }), HOJE), null);
});

// ── gerarMensagemCobranca (determinístico, nunca inventa prazo/desconto) ──

test("gerarMensagemCobranca: lembrete cordial inclui nome, valor e data reais", () => {
  const c = cobranca({ valorCentavos: 15000, vencimento: "2026-09-20" });
  const msg = gerarMensagemCobranca(c, "lembrete_antecipado", "Ana");
  assert.match(msg, /Ana/);
  assert.match(msg, /R\$\s*150,00/);
  assert.match(msg, /20\/09\/2026/);
});

test("gerarMensagemCobranca: aviso de vencida e objetivo, nao ameacador", () => {
  const c = cobranca();
  const msg = gerarMensagemCobranca(c, "aviso_vencida", "Bruno");
  assert.match(msg, /Bruno/);
  assert.doesNotMatch(msg, /processo|negativado|SPC|Serasa/i);
});

test("gerarMensagemCobranca: nunca menciona desconto ou promessa que ninguem fez", () => {
  const c = cobranca();
  for (const tipo of ["lembrete_antecipado", "aviso_vencida", "cobranca_promessa_expirada"]) {
    const msg = gerarMensagemCobranca(c, tipo, "Carla");
    assert.doesNotMatch(msg, /desconto|promoção/i);
  }
});

// ── decidirExecucao (modelo de autonomia: sugerir/aprovar/automatico) ────

test("decidirExecucao: modo sugerir sempre requer aprovacao humana, mesmo com todas as guardas OK", () => {
  const c = cobranca({ status: "vencida" });
  const r = decidirExecucao(c, HOJE, 10, "sugerir", CONFIG, "Diego");
  assert.equal(r.executar, true);
  assert.equal(r.requerAprovacao, true);
});

test("decidirExecucao: modo aprovar sempre requer aprovacao humana", () => {
  const c = cobranca({ status: "vencida" });
  const r = decidirExecucao(c, HOJE, 10, "aprovar", CONFIG, "Diego");
  assert.equal(r.executar, true);
  assert.equal(r.requerAprovacao, true);
});

test("decidirExecucao: modo automatico executa sozinho quando todas as guardas passam", () => {
  const c = cobranca({ status: "vencida", ultimaAcaoEm: null, tentativas: 0 });
  const r = decidirExecucao(c, HOJE, 10, "automatico", CONFIG, "Diego");
  assert.equal(r.executar, true);
  assert.equal(r.requerAprovacao, false);
});

test("decidirExecucao: modo automatico rebaixa para aprovacao humana quando uma guarda falha (fail-closed, nunca descarta a acao)", () => {
  const c = cobranca({ status: "em_negociacao" });
  // em_negociacao ainda tem tipoProximaAcao=null, entao primeiro testamos um caso com acao aplicavel mas guarda de autonomia falhando:
  const cComAcao = cobranca({ status: "vencida", tentativas: 5 }); // limite de tentativas atingido
  const r = decidirExecucao(cComAcao, HOJE, 10, "automatico", CONFIG, "Diego");
  assert.equal(r.executar, true);
  assert.equal(r.requerAprovacao, true);
});

test("decidirExecucao: false quando nenhuma acao se aplica (nao fabrica uma acao para uma cobranca em dia, longe do vencimento)", () => {
  const c = cobranca({ status: "a_vencer", vencimento: "2026-12-25" });
  const r = decidirExecucao(c, HOJE, 10, "automatico", CONFIG, "Diego");
  assert.equal(r.executar, false);
});

test("decidirExecucao: modo automatico nunca executa fora do horario permitido", () => {
  const c = cobranca({ status: "vencida" });
  const r = decidirExecucao(c, HOJE, 23, "automatico", CONFIG, "Diego");
  assert.equal(r.executar, true);
  assert.equal(r.requerAprovacao, true);
});

test("decidirExecucao: modo automatico nunca executa com opt-out do cliente", () => {
  const c = cobranca({ status: "vencida", clienteOptOut: true });
  const r = decidirExecucao(c, HOJE, 10, "automatico", CONFIG, "Diego");
  assert.equal(r.executar, true);
  assert.equal(r.requerAprovacao, true);
});

// ── B.1 (correção pós-auditoria): decidirExecucao respeita promessa sem data ─
test("decidirExecucao: modo automatico NAO executa para promessa sem data (correcao B.1)", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: null });
  const r = decidirExecucao(c, HOJE, 10, "automatico", CONFIG, "Diego");
  assert.equal(r.executar, false);
});

test("decidirExecucao: regressao — promessa COM data ja expirada continua gerando cobranca_promessa_expirada no modo automatico", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: "2026-09-10", ultimaAcaoEm: null, tentativas: 0 });
  const r = decidirExecucao(c, HOJE, 10, "automatico", CONFIG, "Diego");
  assert.equal(r.executar, true);
  assert.equal(r.requerAprovacao, false);
  assert.equal(r.acao.tipo, "cobranca_promessa_expirada");
});
