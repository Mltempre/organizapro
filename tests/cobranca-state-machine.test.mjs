// ── Testes reais (node:test) · lib/cobranca-state-machine.ts ────────────────
// Roda contra o JS REAL compilado — ver README-TESTES no mesmo diretório.
// Cobre a state machine do Cobrador AI (Financeiro Inteligente) ANTES de
// qualquer migration existir — puro, sem banco, sem LLM.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BUILD = process.env.SMART_COMMERCE_BUILD_DIR;
if (!BUILD) {
  throw new Error(
    "Defina SMART_COMMERCE_BUILD_DIR apontando para o diretorio com o build " +
    "commonjs de lib/cobranca-state-machine.ts (ver README-TESTES.md)."
  );
}

const {
  podeTransicionar, ehEstadoTerminal, estaVencida, promessaExpirada,
  aplicarEvento, precisaIntervencaoHumana, estaPausada, cooldownExpirado,
  dentroDoHorarioPermitido, podeGerarAcaoAutomatica, podeCriarCobranca,
  chaveIdempotenciaAcao, classificarComoReceitaRecuperada,
} = require(`${BUILD}/cobranca-state-machine.js`);

const HOJE = "2026-09-18";

function cobranca(overrides = {}) {
  return {
    id: "c1", clinicaId: "clinica-1", orcamentoId: null,
    valorCentavos: 10000, vencimento: "2026-09-25", status: "a_vencer",
    promessaData: null, ultimaAcaoEm: null, tentativas: 0, clienteOptOut: false,
    ...overrides,
  };
}

// ── Cobrança a vencer / vencimento ───────────────────────────────────────

test("estaVencida: false quando o vencimento ainda nao chegou", () => {
  assert.equal(estaVencida("2026-09-25", HOJE), false);
});

test("estaVencida: true quando o vencimento ja passou", () => {
  assert.equal(estaVencida("2026-09-10", HOJE), true);
});

test("aplicarEvento tempo_passou: a_vencer -> vencida quando o vencimento e atingido", () => {
  const c = cobranca({ status: "a_vencer", vencimento: "2026-09-10" });
  const r = aplicarEvento(c, { tipo: "tempo_passou" }, HOJE);
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "vencida");
});

test("aplicarEvento tempo_passou: a_vencer permanece a_vencer antes do vencimento (nenhuma mudanca)", () => {
  const c = cobranca({ status: "a_vencer", vencimento: "2026-09-25" });
  const r = aplicarEvento(c, { tipo: "tempo_passou" }, HOJE);
  assert.equal(r.transicionou, false);
});

// ── Idempotência de tentativa / chave de acao ────────────────────────────

test("chaveIdempotenciaAcao: mesma cobranca+tipo+dia sempre gera a mesma chave", () => {
  const a = chaveIdempotenciaAcao("c1", "aviso_vencida", "2026-09-18T10:00:00.000Z");
  const b = chaveIdempotenciaAcao("c1", "aviso_vencida", "2026-09-18T23:59:00.000Z");
  assert.equal(a, b);
});

test("chaveIdempotenciaAcao: dias diferentes geram chaves diferentes (nao trava a cobranca para sempre)", () => {
  const a = chaveIdempotenciaAcao("c1", "aviso_vencida", "2026-09-18");
  const b = chaveIdempotenciaAcao("c1", "aviso_vencida", "2026-09-19");
  assert.notEqual(a, b);
});

// ── Cooldown ──────────────────────────────────────────────────────────────

test("cooldownExpirado: true quando nunca houve acao antes", () => {
  assert.equal(cooldownExpirado(null, HOJE), true);
});

test("cooldownExpirado: false dentro da janela padrao de 3 dias", () => {
  assert.equal(cooldownExpirado("2026-09-17T10:00:00.000Z", HOJE), false);
});

test("cooldownExpirado: true apos a janela padrao", () => {
  assert.equal(cooldownExpirado("2026-09-10T10:00:00.000Z", HOJE), true);
});

// ── Pagamento informado != confirmado ────────────────────────────────────

test("aplicarEvento cliente_informou_pagamento: vencida -> aguardando_confirmacao, NUNCA paga direto", () => {
  const c = cobranca({ status: "vencida" });
  const r = aplicarEvento(c, { tipo: "cliente_informou_pagamento" }, HOJE);
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "aguardando_confirmacao");
  assert.notEqual(r.novoStatus, "paga");
});

test("precisaIntervencaoHumana: aguardando_confirmacao sempre exige humano (confirmar evidencia nunca e automatico)", () => {
  const c = cobranca({ status: "aguardando_confirmacao" });
  assert.equal(precisaIntervencaoHumana(c, 5), true);
});

test("aplicarEvento confirmacao_rejeitada: aguardando_confirmacao -> vencida quando a alegacao nao procede e ja venceu", () => {
  const c = cobranca({ status: "aguardando_confirmacao", vencimento: "2026-09-10" });
  const r = aplicarEvento(c, { tipo: "confirmacao_rejeitada" }, HOJE);
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "vencida");
});

test("aplicarEvento confirmacao_rejeitada: so e valido a partir de aguardando_confirmacao", () => {
  const c = cobranca({ status: "vencida" });
  const r = aplicarEvento(c, { tipo: "confirmacao_rejeitada" }, HOJE);
  assert.equal(r.transicionou, false);
});

// ── Promessa pausa cobrança ───────────────────────────────────────────────

test("aplicarEvento cliente_prometeu_pagamento: vencida -> promessa_pausada com data futura", () => {
  const c = cobranca({ status: "vencida" });
  const r = aplicarEvento(c, { tipo: "cliente_prometeu_pagamento", dataPrometida: "2026-09-22" }, HOJE);
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "promessa_pausada");
});

test("aplicarEvento cliente_prometeu_pagamento: rejeita data prometida no passado (nao registra promessa invalida)", () => {
  const c = cobranca({ status: "vencida" });
  const r = aplicarEvento(c, { tipo: "cliente_prometeu_pagamento", dataPrometida: "2026-09-01" }, HOJE);
  assert.equal(r.transicionou, false);
});

test("estaPausada: true quando promessa_pausada e a data prometida ainda nao passou", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: "2026-09-22" });
  assert.equal(estaPausada(c, HOJE), true);
});

test("estaPausada: false quando a promessa ja expirou (deve voltar a cobrar)", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: "2026-09-10" });
  assert.equal(estaPausada(c, HOJE), false);
});

test("promessaExpirada / aplicarEvento tempo_passou: promessa_pausada -> vencida quando a data prometida passa sem pagamento", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: "2026-09-10" });
  assert.equal(promessaExpirada(c.promessaData, HOJE), true);
  const r = aplicarEvento(c, { tipo: "tempo_passou" }, HOJE);
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "vencida");
});

test("podeGerarAcaoAutomatica: false enquanto a promessa ainda esta dentro do prazo (respeita a promessa)", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: "2026-09-22" });
  const pode = podeGerarAcaoAutomatica(c, HOJE, 10, { cooldownDias: 3, limiteTentativas: 5, horarioInicio: 8, horarioFim: 20 });
  assert.equal(pode, false);
});

// ── B.1 (correção pós-auditoria): promessa SEM data sempre pausa ─────────
// Antes desta correção, estaPausada retornava false e podeGerarAcaoAutomatica
// retornava true para promessa_pausada com promessaData=null — só nao
// gerava acao de fato por coincidencia de ordem de chamada em
// decidirExecucao (tipoProximaAcao tambem retornava null para esse caso).
// Estes testes provam que a guarda agora e segura isoladamente.

test("estaPausada: true para promessa_pausada COM data vigente (regressao)", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: "2026-09-22" });
  assert.equal(estaPausada(c, HOJE), true);
});

test("estaPausada: true para promessa_pausada SEM data (correcao B.1 — antes retornava false)", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: null });
  assert.equal(estaPausada(c, HOJE), true);
});

test("estaPausada: false para promessa_pausada COM data ja expirada (regressao — nao fica pausada para sempre)", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: "2026-09-10" });
  assert.equal(estaPausada(c, HOJE), false);
});

test("podeGerarAcaoAutomatica: false (bloqueada) para promessa SEM data, mesmo com todas as outras guardas OK (correcao B.1)", () => {
  const c = cobranca({ status: "promessa_pausada", promessaData: null, ultimaAcaoEm: null, tentativas: 0 });
  const pode = podeGerarAcaoAutomatica(c, HOJE, 10, { cooldownDias: 3, limiteTentativas: 5, horarioInicio: 8, horarioFim: 20 });
  assert.equal(pode, false);
});

test("podeGerarAcaoAutomatica: seguro isoladamente para promessa sem data, independente de qualquer outra funcao ser chamada antes (chamada direta, sem passar por tipoProximaAcao)", () => {
  // Mesmo cenario do achado da auditoria (B.1), mas chamando a guarda
  // diretamente — nao depende de decidirExecucao/tipoProximaAcao terem
  // rodado antes para produzir o resultado seguro.
  const c = cobranca({ status: "promessa_pausada", promessaData: null, tentativas: 0, ultimaAcaoEm: null, clienteOptOut: false });
  assert.equal(podeGerarAcaoAutomatica(c, "2026-12-25", 12, { cooldownDias: 1, limiteTentativas: 99, horarioInicio: 0, horarioFim: 24 }), false);
});

// ── Contestação exige humano ──────────────────────────────────────────────

test("aplicarEvento cliente_contestou: qualquer estado nao-terminal -> em_negociacao", () => {
  for (const status of ["a_vencer", "vencida", "aguardando_confirmacao", "promessa_pausada", "pausada"]) {
    const c = cobranca({ status, promessaData: status === "promessa_pausada" ? "2026-09-22" : null });
    const r = aplicarEvento(c, { tipo: "cliente_contestou" }, HOJE);
    assert.equal(r.transicionou, true, `status=${status}`);
    assert.equal(r.novoStatus, "em_negociacao", `status=${status}`);
  }
});

test("precisaIntervencaoHumana: em_negociacao sempre exige humano", () => {
  const c = cobranca({ status: "em_negociacao" });
  assert.equal(precisaIntervencaoHumana(c, 100), true);
});

test("podeGerarAcaoAutomatica: false quando em negociacao, mesmo com todas as outras guardas OK", () => {
  const c = cobranca({ status: "em_negociacao", ultimaAcaoEm: null, tentativas: 0 });
  const pode = podeGerarAcaoAutomatica(c, HOJE, 10, { cooldownDias: 3, limiteTentativas: 5, horarioInicio: 8, horarioFim: 20 });
  assert.equal(pode, false);
});

// ── Pagamento confirmado encerra / não cobrar pago ───────────────────────

test("aplicarEvento pagamento_confirmado: qualquer estado nao-terminal -> paga", () => {
  for (const status of ["a_vencer", "vencida", "aguardando_confirmacao", "promessa_pausada", "em_negociacao", "pausada"]) {
    const c = cobranca({ status, promessaData: status === "promessa_pausada" ? "2026-09-22" : null });
    const r = aplicarEvento(c, { tipo: "pagamento_confirmado" }, HOJE);
    assert.equal(r.transicionou, true, `status=${status}`);
    assert.equal(r.novoStatus, "paga", `status=${status}`);
  }
});

test("ehEstadoTerminal: paga e cancelada sao terminais; os demais nao sao", () => {
  assert.equal(ehEstadoTerminal("paga"), true);
  assert.equal(ehEstadoTerminal("cancelada"), true);
  for (const s of ["a_vencer", "vencida", "aguardando_confirmacao", "promessa_pausada", "em_negociacao", "pausada"]) {
    assert.equal(ehEstadoTerminal(s), false, s);
  }
});

test("aplicarEvento: nenhum evento reabre uma cobranca paga (zero cobranca apos pagamento confirmado)", () => {
  const c = cobranca({ status: "paga" });
  for (const evento of [
    { tipo: "tempo_passou" }, { tipo: "cliente_informou_pagamento" },
    { tipo: "cliente_contestou" }, { tipo: "cancelamento_manual" },
  ]) {
    const r = aplicarEvento(c, evento, HOJE);
    assert.equal(r.transicionou, false, JSON.stringify(evento));
  }
});

test("podeGerarAcaoAutomatica: false para cobranca paga (nunca gera nova acao sobre item ja pago)", () => {
  const c = cobranca({ status: "paga" });
  const pode = podeGerarAcaoAutomatica(c, HOJE, 10, { cooldownDias: 3, limiteTentativas: 5, horarioInicio: 8, horarioFim: 20 });
  assert.equal(pode, false);
});

test("podeTransicionar: paga -> qualquer coisa e sempre falso", () => {
  for (const destino of ["a_vencer", "vencida", "aguardando_confirmacao", "promessa_pausada", "em_negociacao", "pausada", "cancelada"]) {
    assert.equal(podeTransicionar("paga", destino), false, destino);
  }
});

// ── Cancelamento ──────────────────────────────────────────────────────────

test("aplicarEvento cancelamento_manual: qualquer estado nao-terminal -> cancelada", () => {
  const c = cobranca({ status: "vencida" });
  const r = aplicarEvento(c, { tipo: "cancelamento_manual" }, HOJE);
  assert.equal(r.transicionou, true);
  assert.equal(r.novoStatus, "cancelada");
});

test("aplicarEvento: nenhum evento reabre uma cobranca cancelada", () => {
  const c = cobranca({ status: "cancelada" });
  const r = aplicarEvento(c, { tipo: "pagamento_confirmado" }, HOJE);
  assert.equal(r.transicionou, false);
});

// ── Limite de tentativas ──────────────────────────────────────────────────

test("precisaIntervencaoHumana: true quando o limite de tentativas automaticas foi atingido (escala para humano, nunca insiste infinitamente)", () => {
  const c = cobranca({ status: "vencida", tentativas: 5 });
  assert.equal(precisaIntervencaoHumana(c, 5), true);
});

test("precisaIntervencaoHumana: false quando ainda ha tentativas disponiveis", () => {
  const c = cobranca({ status: "vencida", tentativas: 2 });
  assert.equal(precisaIntervencaoHumana(c, 5), false);
});

// ── Opt-out / horário permitido (anti-spam) ──────────────────────────────

test("podeGerarAcaoAutomatica: false quando o cliente fez opt-out, sob qualquer outra condicao", () => {
  const c = cobranca({ status: "vencida", clienteOptOut: true });
  const pode = podeGerarAcaoAutomatica(c, HOJE, 10, { cooldownDias: 3, limiteTentativas: 5, horarioInicio: 8, horarioFim: 20 });
  assert.equal(pode, false);
});

test("dentroDoHorarioPermitido: respeita janela configurada", () => {
  assert.equal(dentroDoHorarioPermitido(10, 8, 20), true);
  assert.equal(dentroDoHorarioPermitido(7, 8, 20), false);
  assert.equal(dentroDoHorarioPermitido(21, 8, 20), false);
});

test("podeGerarAcaoAutomatica: false fora do horario permitido, mesmo com todas as outras guardas OK", () => {
  const c = cobranca({ status: "vencida" });
  const pode = podeGerarAcaoAutomatica(c, HOJE, 23, { cooldownDias: 3, limiteTentativas: 5, horarioInicio: 8, horarioFim: 20 });
  assert.equal(pode, false);
});

test("podeGerarAcaoAutomatica: true quando todas as guardas passam", () => {
  const c = cobranca({ status: "vencida", ultimaAcaoEm: null, tentativas: 0 });
  const pode = podeGerarAcaoAutomatica(c, HOJE, 10, { cooldownDias: 3, limiteTentativas: 5, horarioInicio: 8, horarioFim: 20 });
  assert.equal(pode, true);
});

// ── Deduplicação: no máximo uma cobrança ativa por orçamento ─────────────

test("podeCriarCobranca: false quando ja existe uma cobranca nao-terminal para o mesmo orcamento", () => {
  const existentes = [{ orcamentoId: "orc-1", status: "vencida" }];
  assert.equal(podeCriarCobranca("orc-1", existentes), false);
});

test("podeCriarCobranca: true quando a cobranca existente para o mesmo orcamento ja e terminal", () => {
  const existentes = [{ orcamentoId: "orc-1", status: "paga" }];
  assert.equal(podeCriarCobranca("orc-1", existentes), true);
});

test("podeCriarCobranca: true quando nao ha orcamento de origem (dedup fica a cargo de quem chama)", () => {
  assert.equal(podeCriarCobranca(null, [{ orcamentoId: "orc-1", status: "vencida" }]), true);
});

// ── Receita recuperada — regra conservadora (contrato endurecido, B.3) ───
// classificarComoReceitaRecuperada agora recebe evidencia BRUTA (lista de
// acoes com status_execucao/executadoEm reais + timestamp de confirmacao
// do pagamento) e filtra ela mesma — nao confia mais num contador
// pre-calculado pelo chamador.

function evidencia(overrides = {}) {
  return {
    esteveVencida: true,
    pagamentoConfirmadoEm: "2026-09-20T10:00:00.000Z",
    acoes: [{ statusExecucao: "executada", executadoEm: "2026-09-15T10:00:00.000Z" }],
    ...overrides,
  };
}

test("classificarComoReceitaRecuperada: true quando vencida + acao executada antes do pagamento + pagamento confirmado", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia()), true);
});

test("classificarComoReceitaRecuperada: false quando nunca esteve vencida (pagamento espontaneo, nao 'recuperado')", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia({ esteveVencida: false })), false);
});

test("classificarComoReceitaRecuperada: false quando pagamento apenas informado, nunca confirmado (pagamentoConfirmadoEm=null)", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia({ pagamentoConfirmadoEm: null })), false);
});

test("classificarComoReceitaRecuperada: false quando o pagamento nao esta confirmado, mesmo com acoes executadas presentes", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia({
    pagamentoConfirmadoEm: null,
    acoes: [{ statusExecucao: "executada", executadoEm: "2026-09-15T10:00:00.000Z" }],
  })), false);
});

test("classificarComoReceitaRecuperada: false quando a unica acao esta pendente (nunca conta acao nao executada)", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia({
    acoes: [{ statusExecucao: "pendente", executadoEm: null }],
  })), false);
});

test("classificarComoReceitaRecuperada: false quando a unica acao foi rejeitada", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia({
    acoes: [{ statusExecucao: "rejeitada", executadoEm: null }],
  })), false);
});

test("classificarComoReceitaRecuperada: false quando a acao executada aconteceu DEPOIS do pagamento confirmado", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia({
    pagamentoConfirmadoEm: "2026-09-15T10:00:00.000Z",
    acoes: [{ statusExecucao: "executada", executadoEm: "2026-09-20T10:00:00.000Z" }],
  })), false);
});

test("classificarComoReceitaRecuperada: false quando nao ha nenhuma acao (nem executada, nem de nenhum outro tipo)", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia({ acoes: [] })), false);
});

test("classificarComoReceitaRecuperada: true quando ha varias acoes e SO UMA executada antes do pagamento (as demais pendente/rejeitada nao atrapalham)", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia({
    acoes: [
      { statusExecucao: "pendente", executadoEm: null },
      { statusExecucao: "rejeitada", executadoEm: null },
      { statusExecucao: "executada", executadoEm: "2026-09-16T10:00:00.000Z" },
    ],
  })), true);
});

test("classificarComoReceitaRecuperada: uma acao com statusExecucao != 'executada' mas com executadoEm preenchido por engano nunca conta", () => {
  assert.equal(classificarComoReceitaRecuperada(evidencia({
    acoes: [{ statusExecucao: "aprovada", executadoEm: "2026-09-15T10:00:00.000Z" }],
  })), false);
});

// ── Retomada / pausa manual ────────────────────────────────────────────────

test("aplicarEvento retomada_manual: so e valido a partir de pausada", () => {
  const c = cobranca({ status: "vencida" });
  const r = aplicarEvento(c, { tipo: "retomada_manual" }, HOJE);
  assert.equal(r.transicionou, false);
});

test("aplicarEvento retomada_manual: pausada -> vencida ou a_vencer conforme o vencimento real", () => {
  const vencida = aplicarEvento(cobranca({ status: "pausada", vencimento: "2026-09-01" }), { tipo: "retomada_manual" }, HOJE);
  assert.equal(vencida.novoStatus, "vencida");
  const futura = aplicarEvento(cobranca({ status: "pausada", vencimento: "2026-10-01" }), { tipo: "retomada_manual" }, HOJE);
  assert.equal(futura.novoStatus, "a_vencer");
});
