// ── Testes reais (node:test) · Smart Commerce, bloco sem migration ─────────
// Roda contra o JS REAL compilado de lib/oportunidades-clientes.ts e
// lib/nucleo-inteligente.ts (não uma reimplementação) — ver README-TESTES no
// mesmo diretório para como (re)gerar o build antes de rodar este arquivo.
//
// Cobre: sem_proximo_compromisso (comportamento antigo preservado quando o
// campo novo está ausente; texto de reativação quando presente),
// interesse_sem_compra e demanda_nao_atendida (heurísticos: nunca disputam
// com sinal de agenda de prioridade alta/média; nunca aparecem se já
// converteram; texto sempre marcado como heurístico), dedup por
// telefone/chave, e o TIER/evidência de nucleo-inteligente.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BUILD = process.env.SMART_COMMERCE_BUILD_DIR;
if (!BUILD) {
  throw new Error(
    "Defina SMART_COMMERCE_BUILD_DIR apontando para o diretorio com o build " +
    "commonjs de lib/oportunidades-clientes.ts + lib/nucleo-inteligente.ts + lib/recomendacoes.ts."
  );
}

const { gerarOportunidadesClientes } = require(`${BUILD}/oportunidades-clientes.js`);
const { adaptarOportunidadesClientes, organizarSinaisCanonicos } = require(`${BUILD}/nucleo-inteligente.js`);
const { gerarRecomendacoesConsultivas } = require(`${BUILD}/ia-comercial.js`);

const HOJE = "2026-09-18";

function entradaBase(overrides = {}) {
  return {
    hoje: HOJE,
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    ...overrides,
  };
}

// ── sem_proximo_compromisso · não-regressão ──────────────────────────────

test("sem_proximo_compromisso: sem o campo novo, texto e acao ficam identicos a antes", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    clientesSemProximoCompromisso: [
      { id: "p1", nome: "Ana", telefone: "11999990000", proximaConsulta: null },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].motivoPrincipal, "Ana está sem um próximo atendimento programado.");
  assert.equal(out[0].acaoSugerida, "Oferecer um novo horário");
  assert.equal(out[0].sinais[0].tipo, "sem_proximo_compromisso");
});

test("sem_proximo_compromisso: teveAtendimentoConcluido=false tambem preserva o texto antigo", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    clientesSemProximoCompromisso: [
      { id: "p1", nome: "Ana", telefone: "11999990000", proximaConsulta: null, teveAtendimentoConcluido: false },
    ],
  }));
  assert.equal(out[0].motivoPrincipal, "Ana está sem um próximo atendimento programado.");
  assert.equal(out[0].acaoSugerida, "Oferecer um novo horário");
});

test("sem_proximo_compromisso: teveAtendimentoConcluido=true muda para o texto de reativacao", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    clientesSemProximoCompromisso: [
      { id: "p1", nome: "Bruno", telefone: "11988880000", proximaConsulta: null, teveAtendimentoConcluido: true },
    ],
  }));
  assert.equal(out[0].motivoPrincipal, "Bruno já foi atendido antes e está sem um novo atendimento programado — candidato a reativação.");
  assert.equal(out[0].acaoSugerida, "Oferecer retorno e reativar o relacionamento");
  assert.equal(out[0].sinais[0].tipo, "sem_proximo_compromisso"); // evoluido, nao um tipo novo
});

// ── interesse_sem_compra ──────────────────────────────────────────────────

test("interesse_sem_compra: aparece quando nao ha agendamento apos a conversa", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    conversasComInteresseSemAgendamento: [
      { id: "log1", nome: "Carla", telefone: "11977770000", data: "2026-09-15", teveAgendamentoApos: false },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinais[0].tipo, "interesse_sem_compra");
  assert.equal(out[0].prioridade, "baixa");
  assert.match(out[0].motivoPrincipal, /sinal heurístico/i);
  assert.match(out[0].motivoPrincipal, /não é um registro confirmado/i);
});

test("interesse_sem_compra: desaparece quando ja houve agendamento apos a conversa (converteu)", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    conversasComInteresseSemAgendamento: [
      { id: "log1", nome: "Carla", telefone: "11977770000", data: "2026-09-15", teveAgendamentoApos: true },
    ],
  }));
  assert.equal(out.length, 0);
});

test("interesse_sem_compra: nome ausente usa rotulo generico, nunca inventa nome", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    conversasComInteresseSemAgendamento: [
      { id: "log1", nome: null, telefone: "11977770000", data: "2026-09-15", teveAgendamentoApos: false },
    ],
  }));
  assert.match(out[0].motivoPrincipal, /^Contato sem nome salvo/);
});

// ── demanda_nao_atendida ───────────────────────────────────────────────────

test("demanda_nao_atendida: aparece quando a conversa nao teve resolucao nem agendamento depois", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    conversasSemResolucao: [
      { id: "log2", nome: "Diego", telefone: "11966660000", data: "2026-09-17", teveAgendamentoApos: false },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinais[0].tipo, "demanda_nao_atendida");
  assert.equal(out[0].prioridade, "baixa");
  assert.match(out[0].motivoPrincipal, /sinal heurístico/i);
});

test("demanda_nao_atendida: desaparece quando ja houve agendamento apos", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    conversasSemResolucao: [
      { id: "log2", nome: "Diego", telefone: "11966660000", data: "2026-09-17", teveAgendamentoApos: true },
    ],
  }));
  assert.equal(out.length, 0);
});

// ── Orçamento → Venda → Receita (dado CONFIRMADO, nao heuristico) ──────────
// Ver docs/orcamento-venda-receita-v1-arquitetura.md — ainda sem fonte real
// de dado (nenhuma migration executada); estes testes cobrem só o motor
// puro, que ja fica pronto para o dia em que a migration for aprovada.
// HOJE = "2026-09-18" (ver entradaBase).

test("orcamento_sem_resposta: aparece com prioridade alta e evidencia NAO-heuristica (sem validade definida)", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "orc1", nome: "Otavio", telefone: "11400000000", valor: 1500, dataEnvio: "2026-09-14", validadeAte: null },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinais[0].tipo, "orcamento_sem_resposta");
  assert.equal(out[0].prioridade, "alta");
  assert.doesNotMatch(out[0].motivoPrincipal, /sinal heurístico/i);
  assert.match(out[0].motivoPrincipal, /R\$\s*1\.500,00/);
});

test("orcamento_sem_resposta: valor ausente nao inventa numero, so omite o trecho de valor", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "orc2", nome: "Paula", telefone: "11300000000", valor: null, dataEnvio: "2026-09-14", validadeAte: null },
    ],
  }));
  assert.equal(out[0].motivoPrincipal, "Paula tem um orçamento enviado, ainda sem resposta.");
});

test("orcamento_sem_resposta: validade distante (fora da janela de 3 dias) continua sem_resposta, nao expirando", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "orc1b", nome: "Zeca", telefone: "11450000000", valor: 100, dataEnvio: "2026-09-16", validadeAte: "2026-09-30" },
    ],
  }));
  assert.equal(out[0].sinais[0].tipo, "orcamento_sem_resposta");
});

test("orcamento_expirado: validade ja vencida vira tipo proprio, nunca sem_resposta", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "orc3", nome: "Rafael", telefone: "11200000000", valor: 300, dataEnvio: "2026-08-01", validadeAte: "2026-09-01" },
    ],
  }));
  assert.equal(out[0].sinais[0].tipo, "orcamento_expirado");
  assert.match(out[0].motivoPrincipal, /validade já venceu/);
});

test("orcamento_expirando: validade a vencer dentro de 3 dias vira tipo proprio, distinto de expirado e sem_resposta", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "orc3b", nome: "Bia", telefone: "11250000000", valor: 700, dataEnvio: "2026-09-10", validadeAte: "2026-09-20" },
    ],
  }));
  assert.equal(out[0].sinais[0].tipo, "orcamento_expirando");
  assert.match(out[0].motivoPrincipal, /vencendo em breve/);
});

test("prioridade: orcamento_sem_resposta (alta) e cancelamento_sem_reagendamento (alta) nunca perdem para sem_proximo_compromisso (media)", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    clientesSemProximoCompromisso: [
      { id: "p1", nome: "Sonia", telefone: "11100000000", proximaConsulta: null },
    ],
    orcamentosEnviados: [
      { id: "orc4", nome: "Thiago", telefone: "11000000000", valor: 800, dataEnvio: "2026-09-16", validadeAte: null },
    ],
  }));
  assert.equal(out[0].nome, "Thiago");
  assert.equal(out[0].prioridade, "alta");
  assert.equal(out[1].nome, "Sonia");
  assert.equal(out[1].prioridade, "media");
});

test("prioridade interna: orcamento_expirado vem antes de orcamento_expirando, que vem antes de orcamento_sem_resposta", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "e1", nome: "SemResposta", telefone: "11991110000", valor: 100, dataEnvio: "2026-09-16", validadeAte: null },
      { id: "e2", nome: "Expirando",   telefone: "11992220000", valor: 100, dataEnvio: "2026-09-10", validadeAte: "2026-09-20" },
      { id: "e3", nome: "Expirado",    telefone: "11993330000", valor: 100, dataEnvio: "2026-08-01", validadeAte: "2026-09-01" },
    ],
  }));
  assert.deepEqual(out.map(o => o.nome), ["Expirado", "Expirando", "SemResposta"]);
});

test("dedup: mesmo telefone com orcamento_sem_resposta e sinal heuristico gera um unico card, orcamento em destaque", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "orc5", nome: "Ursula", telefone: "10999990000", valor: 200, dataEnvio: "2026-09-16", validadeAte: null },
    ],
    conversasComInteresseSemAgendamento: [
      { id: "log9", nome: "Ursula", telefone: "10999990000", data: "2026-09-12", teveAgendamentoApos: false },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinaisAdicionais, 1);
  assert.equal(out[0].sinais[0].tipo, "orcamento_sem_resposta");
  assert.equal(out[0].sinais[1].tipo, "interesse_sem_compra");
});

test("Sinal Canonico: evidencia de orcamento_sem_resposta cita 'historico real de orcamentos', nunca 'agendamentos' nem 'heuristico'", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "orc6", nome: "Vitor", telefone: "10888880000", valor: 450, dataEnvio: "2026-09-15", validadeAte: null },
    ],
  }));
  const canonicos = adaptarOportunidadesClientes(oportunidades);
  assert.match(canonicos[0].evidencia, /histórico real de orçamentos/);
  assert.doesNotMatch(canonicos[0].evidencia, /agendamentos/);
  assert.doesNotMatch(canonicos[0].evidencia, /heurístico/i);
});

test("Diretor Digital: orcamento_sem_resposta vira recomendacao consultiva, categoria existente, evidencia nao-heuristica", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "orc7", nome: "Wagner", telefone: "10777770000", valor: 999, dataEnvio: "2026-09-13", validadeAte: null },
    ],
  }));
  const consultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: null,
  });
  assert.equal(consultivas.length, 1);
  assert.equal(consultivas[0].categoria, "cancelamento_confirmacao");
  assert.match(consultivas[0].evidencia, /histórico real de orçamentos/);
  assert.doesNotMatch(consultivas[0].evidencia, /heurístico/i);
});

// ── orcamento_aceito_sem_agendamento (venda fechada, nunca confundida com pagamento) ──

test("orcamento_aceito_sem_agendamento: aparece com prioridade alta, evidencia real", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosAceitosSemAgendamento: [
      { id: "acc1", nome: "Yara", telefone: "10666660000", valor: 2000, dataAceite: "2026-09-17" },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinais[0].tipo, "orcamento_aceito_sem_agendamento");
  assert.equal(out[0].prioridade, "alta");
  assert.match(out[0].motivoPrincipal, /aceitou um orçamento/);
  assert.match(out[0].motivoPrincipal, /R\$\s*2\.000,00/);
  assert.doesNotMatch(out[0].motivoPrincipal, /pag/i); // nunca menciona pagamento — aceite != pago
});

test("prioridade interna: orcamento_aceito_sem_agendamento vem antes de orcamento_expirado (negocio fechado pesa mais)", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosEnviados: [
      { id: "e4", nome: "Expirado2", telefone: "11994440000", valor: 100, dataEnvio: "2026-08-01", validadeAte: "2026-09-01" },
    ],
    orcamentosAceitosSemAgendamento: [
      { id: "acc2", nome: "Aceito2", telefone: "10555550000", valor: 100, dataAceite: "2026-09-17" },
    ],
  }));
  assert.deepEqual(out.map(o => o.nome), ["Aceito2", "Expirado2"]);
});

test("Diretor Digital: orcamento_aceito_sem_agendamento nunca usa a palavra receita/pago no texto (aceite != pagamento)", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    orcamentosAceitosSemAgendamento: [
      { id: "acc3", nome: "Zilda", telefone: "10444440000", valor: 500, dataAceite: "2026-09-16" },
    ],
  }));
  const consultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: null,
  });
  assert.equal(consultivas.length, 1);
  assert.doesNotMatch(consultivas[0].identificado, /pago|pagamento|receita/i);
  assert.doesNotMatch(consultivas[0].motivo, /pago|receita comprovada/i);
});

// ── prioridade: heuristico nunca fica na frente de sinal real de agenda ────

test("prioridade: cancelamento (alta) sempre vem antes de interesse_sem_compra (baixa), mesmo cliente diferente", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    cancelamentosSemReagendamento: [
      { id: "a1", nome: "Elaine", telefone: "11955550000", data: "2026-09-17" },
    ],
    conversasComInteresseSemAgendamento: [
      { id: "log3", nome: "Fabio", telefone: "11944440000", data: "2026-09-10", teveAgendamentoApos: false },
    ],
  }));
  assert.equal(out.length, 2);
  assert.equal(out[0].nome, "Elaine");
  assert.equal(out[0].prioridade, "alta");
  assert.equal(out[1].nome, "Fabio");
  assert.equal(out[1].prioridade, "baixa");
});

test("prioridade: sem_proximo_compromisso (media) vem antes de demanda_nao_atendida (baixa)", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    clientesSemProximoCompromisso: [
      { id: "p1", nome: "Gustavo", telefone: "11933330000", proximaConsulta: null },
    ],
    conversasSemResolucao: [
      { id: "log4", nome: "Helena", telefone: "11922220000", data: "2026-09-16", teveAgendamentoApos: false },
    ],
  }));
  assert.equal(out[0].nome, "Gustavo");
  assert.equal(out[1].nome, "Helena");
});

// ── deduplicacao: mesmo telefone em sinal de agenda + sinal heuristico vira 1 card ──

test("dedup: mesmo telefone com sinal de agenda e sinal heuristico gera um unico card, sinal de agenda em destaque", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    clientesSemProximoCompromisso: [
      { id: "p1", nome: "Igor", telefone: "11911110000", proximaConsulta: null },
    ],
    conversasComInteresseSemAgendamento: [
      { id: "log5", nome: "Igor", telefone: "11911110000", data: "2026-09-12", teveAgendamentoApos: false },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinaisAdicionais, 1);
  assert.equal(out[0].sinais[0].tipo, "sem_proximo_compromisso"); // media > baixa, fica em destaque
  assert.equal(out[0].sinais[1].tipo, "interesse_sem_compra");
});

// ── nucleo-inteligente.ts: evidencia distingue heuristico de agenda real ───

test("Sinal Canonico: evidencia de sinal de agenda real menciona 'historico real de agendamentos'", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    cancelamentosSemReagendamento: [
      { id: "a1", nome: "Julia", telefone: "11900000000", data: "2026-09-17" },
    ],
  }));
  const canonicos = adaptarOportunidadesClientes(oportunidades);
  assert.match(canonicos[0].evidencia, /histórico real de agendamentos/);
});

test("Sinal Canonico: evidencia de sinal heuristico avisa que nao e confirmado", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    conversasSemResolucao: [
      { id: "log6", nome: "Karen", telefone: "11800000000", data: "2026-09-16", teveAgendamentoApos: false },
    ],
  }));
  const canonicos = adaptarOportunidadesClientes(oportunidades);
  assert.match(canonicos[0].evidencia, /Sinal heurístico/);
  assert.match(canonicos[0].evidencia, /não é um registro confirmado/);
});

test("Sinal Canonico: sinal heuristico continua valido (motivo/evidencia/acao preenchidos) e sobrevive a organizarSinaisCanonicos", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    conversasComInteresseSemAgendamento: [
      { id: "log7", nome: "Lucas", telefone: "11700000000", data: "2026-09-14", teveAgendamentoApos: false },
    ],
  }));
  const canonicos = adaptarOportunidadesClientes(oportunidades);
  const organizados = organizarSinaisCanonicos(canonicos);
  assert.equal(organizados.length, 1);
  assert.equal(organizados[0].tipo, "interesse_sem_compra");
});

test("Sinal Canonico: heuristico nunca fica antes de um sinal real na Missao do Dia (organizarSinaisCanonicos)", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    cancelamentosSemReagendamento: [
      { id: "a1", nome: "Marcia", telefone: "11600000000", data: "2026-09-17" },
    ],
    conversasSemResolucao: [
      { id: "log8", nome: "Nina", telefone: "11500000000", data: "2026-09-01", teveAgendamentoApos: false },
    ],
  }));
  const organizados = organizarSinaisCanonicos(adaptarOportunidadesClientes(oportunidades));
  assert.equal(organizados[0].contexto.nome, "Marcia");
  assert.equal(organizados[1].contexto.nome, "Nina");
});

// ── lib/ia-comercial.ts: Diretor Digital narra os dois sinais heuristicos ──
// (reaproveitando a categoria "retorno_cliente" já existente no contrato —
// nenhuma categoria nova, nenhuma alteração em componente visual).

test("Diretor Digital: interesse_sem_compra vira recomendacao consultiva com texto heuristico", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    conversasComInteresseSemAgendamento: [
      { id: "log9", nome: "Otavio", telefone: "11400000000", data: "2026-09-14", teveAgendamentoApos: false },
    ],
  }));
  const consultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: null,
  });
  assert.equal(consultivas.length, 1);
  assert.equal(consultivas[0].categoria, "retorno_cliente");
  assert.match(consultivas[0].evidencia, /Sinal heurístico/);
  assert.match(consultivas[0].evidencia, /não é um registro confirmado/);
});

test("Diretor Digital: demanda_nao_atendida vira recomendacao consultiva com texto heuristico", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    conversasSemResolucao: [
      { id: "log10", nome: "Paula", telefone: "11300000000", data: "2026-09-13", teveAgendamentoApos: false },
    ],
  }));
  const consultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: null,
  });
  assert.equal(consultivas.length, 1);
  assert.equal(consultivas[0].categoria, "retorno_cliente");
  assert.match(consultivas[0].identificado, /assistente não conseguiu resolver/);
});

test("Diretor Digital: temDadosSuficientes=false devolve lista vazia mesmo com sinal heuristico presente", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    conversasSemResolucao: [
      { id: "log11", nome: "Rafael", telefone: "11200000000", data: "2026-09-12", teveAgendamentoApos: false },
    ],
  }));
  const consultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: false, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: null,
  });
  assert.equal(consultivas.length, 0);
});

// ── cobranca_vencida (Financeiro Inteligente / Cobrador AI) ──────────────
// Ver docs/financeiro-inteligente-cobrador-ai-v1-arquitetura.md — dado
// CONFIRMADO (decidido por lib/cobranca-state-machine.ts, nunca recalculado
// aqui), maior prioridade interna do motor: dinheiro já vencido pesa mais
// que qualquer sinal de agenda.

test("cobranca_vencida: aparece com prioridade alta e evidencia propria de cobranca", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    cobrancasVencidas: [
      { id: "cob1", nome: "Aline", telefone: "11711110000", valor: 150, vencimento: "2026-09-10" },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinais[0].tipo, "cobranca_vencida");
  assert.equal(out[0].prioridade, "alta");
  assert.match(out[0].motivoPrincipal, /cobrança/);
  assert.match(out[0].motivoPrincipal, /R\$\s*150,00/);
});

test("cobranca_vencida: valor ausente nao inventa numero, so omite o trecho de valor", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    cobrancasVencidas: [
      { id: "cob2", nome: "Bento", telefone: "11722220000", valor: null, vencimento: "2026-09-10" },
    ],
  }));
  assert.equal(out[0].motivoPrincipal, "Bento tem uma cobrança vencida, sem pagamento confirmado.");
});

test("prioridade interna: cobranca_vencida vem antes de cancelamento_sem_reagendamento e de todo sinal de orcamento", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    cancelamentosSemReagendamento: [
      { id: "canc1", nome: "Cancelou", telefone: "11733330000", data: "2026-09-16" },
    ],
    orcamentosAceitosSemAgendamento: [
      { id: "acc1", nome: "AceitouSemAgenda", telefone: "11744440000", valor: 100, dataAceite: "2026-09-17" },
    ],
    cobrancasVencidas: [
      { id: "cob3", nome: "Devendo", telefone: "11755550000", valor: 200, vencimento: "2026-09-10" },
    ],
  }));
  assert.equal(out[0].nome, "Devendo");
});

test("Sinal Canonico: evidencia de cobranca_vencida cita 'historico real de cobrancas', nunca 'orcamentos' nem 'agendamentos'", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    cobrancasVencidas: [
      { id: "cob4", nome: "Diana", telefone: "11766660000", valor: 300, vencimento: "2026-09-05" },
    ],
  }));
  const canonicos = organizarSinaisCanonicos(adaptarOportunidadesClientes(oportunidades));
  assert.equal(canonicos.length, 1);
  assert.match(canonicos[0].evidencia, /histórico real de cobranças/);
  assert.doesNotMatch(canonicos[0].evidencia, /orçamentos|agendamentos/);
});

test("Diretor Digital: cobranca_vencida vira recomendacao consultiva, nunca chama o cliente de inadimplente", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    cobrancasVencidas: [
      { id: "cob5", nome: "Elias", telefone: "11777770000", valor: 400, vencimento: "2026-09-01" },
    ],
  }));
  const consultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: null,
  });
  assert.equal(consultivas.length, 1);
  assert.match(consultivas[0].identificado, /cobrança vencida/);
  assert.doesNotMatch(consultivas[0].identificado, /inadimplente/i);
  assert.doesNotMatch(consultivas[0].motivo, /inadimplente/i);
});

test("dedup: mesmo telefone com cobranca_vencida e orcamento_aceito_sem_agendamento gera um unico card, cobranca em destaque", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    orcamentosAceitosSemAgendamento: [
      { id: "acc2", nome: "Fabio", telefone: "10999990000", valor: 200, dataAceite: "2026-09-16" },
    ],
    cobrancasVencidas: [
      { id: "cob6", nome: "Fabio", telefone: "10999990000", valor: 500, vencimento: "2026-09-05" },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinaisAdicionais, 1);
  assert.equal(out[0].sinais[0].tipo, "cobranca_vencida");
});

// ── E-commerce IA: pedido_nao_concluido / recompra_possivel / interesse_sem_pedido ──
// Ver docs/ecommerce-ia-v1-arquitetura.md.

test("pedido_nao_concluido: aparece com prioridade alta e evidencia propria de pedido", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    pedidosNaoConcluidos: [
      { id: "ped1", nome: "Gustavo", telefone: "11811110000", valor: 89.9, dataCriacao: "2026-09-14" },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinais[0].tipo, "pedido_nao_concluido");
  assert.equal(out[0].prioridade, "alta");
  assert.match(out[0].motivoPrincipal, /pedido/);
  assert.match(out[0].motivoPrincipal, /R\$\s*89,90/);
});

test("pedido_nao_concluido: valor ausente nao inventa numero, so omite o trecho de valor", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    pedidosNaoConcluidos: [
      { id: "ped2", nome: "Helena", telefone: "11822220000", valor: null, dataCriacao: "2026-09-14" },
    ],
  }));
  assert.equal(out[0].motivoPrincipal, "Helena tem um pedido em aberto, ainda sem confirmação ou pagamento.");
});

test("recompra_possivel: aparece com prioridade media", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    clientesRecompraPossivel: [
      { id: "rec1", nome: "Igor", telefone: "11833330000", dataUltimoPedidoPago: "2026-08-01" },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinais[0].tipo, "recompra_possivel");
  assert.equal(out[0].prioridade, "media");
});

test("interesse_sem_pedido: sinal heuristico, prioridade baixa, texto nunca afirma intencao confirmada", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    conversasComercialSemPedido: [
      { id: "log20", nome: "Julia", telefone: "11844440000", data: "2026-09-15", tevePedidoApos: false },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinais[0].tipo, "interesse_sem_pedido");
  assert.equal(out[0].prioridade, "baixa");
  assert.match(out[0].motivoPrincipal, /sinal heurístico/);
});

test("interesse_sem_pedido: desaparece quando ja houve pedido apos a conversa (converteu)", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    conversasComercialSemPedido: [
      { id: "log21", nome: "Kevin", telefone: "11855550000", data: "2026-09-15", tevePedidoApos: true },
    ],
  }));
  assert.equal(out.length, 0);
});

test("prioridade interna: pedido_nao_concluido vem antes de sem_proximo_compromisso, mas depois do bloco de orcamento", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    clientesSemProximoCompromisso: [
      { id: "p1", nome: "SemProximo", telefone: "11866660000", proximaConsulta: null },
    ],
    orcamentosAceitosSemAgendamento: [
      { id: "acc3", nome: "AceitouOrc", telefone: "11877770000", valor: 100, dataAceite: "2026-09-17" },
    ],
    pedidosNaoConcluidos: [
      { id: "ped3", nome: "PedidoAberto", telefone: "11888880000", valor: 50, dataCriacao: "2026-09-16" },
    ],
  }));
  assert.deepEqual(out.map(o => o.nome), ["AceitouOrc", "PedidoAberto", "SemProximo"]);
});

test("dedup: mesmo telefone com pedido_nao_concluido e interesse_sem_pedido gera um unico card, pedido em destaque", () => {
  const out = gerarOportunidadesClientes(entradaBase({
    pedidosNaoConcluidos: [
      { id: "ped4", nome: "Larissa", telefone: "10444440000", valor: 30, dataCriacao: "2026-09-16" },
    ],
    conversasComercialSemPedido: [
      { id: "log22", nome: "Larissa", telefone: "10444440000", data: "2026-09-14", tevePedidoApos: false },
    ],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sinaisAdicionais, 1);
  assert.equal(out[0].sinais[0].tipo, "pedido_nao_concluido");
});

test("Sinal Canonico: evidencia de pedido_nao_concluido/recompra_possivel cita 'historico real de pedidos', nunca outro dominio", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    pedidosNaoConcluidos: [
      { id: "ped5", nome: "Marcelo", telefone: "10555550000", valor: 70, dataCriacao: "2026-09-10" },
    ],
  }));
  const canonicos = organizarSinaisCanonicos(adaptarOportunidadesClientes(oportunidades));
  assert.equal(canonicos.length, 1);
  assert.match(canonicos[0].evidencia, /histórico real de pedidos/);
  assert.doesNotMatch(canonicos[0].evidencia, /orçamentos|agendamentos|cobranças/);
});

test("Diretor Digital: pedido_nao_concluido e recompra_possivel viram recomendacao consultiva, categorias existentes", () => {
  const oportunidades = gerarOportunidadesClientes(entradaBase({
    pedidosNaoConcluidos: [
      { id: "ped6", nome: "Natalia", telefone: "10666660000", valor: 60, dataCriacao: "2026-09-10" },
    ],
    clientesRecompraPossivel: [
      { id: "rec2", nome: "Otavio", telefone: "10777770000", dataUltimoPedidoPago: "2026-07-01" },
    ],
  }));
  const consultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: true, oportunidadesClientes: oportunidades, recomendacoes: [], ocupacaoPct: null,
  });
  assert.equal(consultivas.length, 2);
  const categorias = consultivas.map(c => c.categoria).sort();
  assert.deepEqual(categorias, ["cancelamento_confirmacao", "retorno_cliente"]);
});
