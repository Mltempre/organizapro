import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");

const nucleo = await import(pathToFileURL(path.join(buildDir, "nucleo-inteligente.js")));
const diretor = await import(pathToFileURL(path.join(buildDir, "ia-comercial.js")));

function sinal(overrides = {}) {
  return {
    id: "s-1",
    especialista: "comercial",
    tipo: "sem_proximo_compromisso",
    prioridade: "media",
    titulo: "Cliente sem próximo compromisso",
    motivo: "Não existe compromisso futuro registrado.",
    evidencia: "Histórico real de agendamentos.",
    acaoSugerida: "Oferecer um horário",
    chaveDedup: "cliente:1",
    criadoEm: null,
    ...overrides,
  };
}

const DEMANDA = {
  id: "op-1",
  canal: "site",
  telefone: "11999990000",
  nome_informado: "Ana",
  status: "sinalizada",
  confianca_classificacao: "alta",
  orcamento_vinculado_id: null,
};

test("prioridade comercial é independente da confiança da classificação", () => {
  const [resultado] = nucleo.adaptarOportunidadesDemanda([DEMANDA]);
  assert.equal(resultado.prioridade, "media");
  assert.equal(resultado.confianca, "alta");
});

test("tier comercial explícito vence a ordem de entrada dentro da mesma prioridade", () => {
  const entrada = [
    sinal({ id: "confirmacao", tipo: "confirmacao_pendente", prioridade: "alta", chaveDedup: "z" }),
    sinal({ id: "pedido", tipo: "pedido_nao_concluido", prioridade: "alta", chaveDedup: "y" }),
    sinal({ id: "cobranca", tipo: "cobranca_atrasada", prioridade: "alta", chaveDedup: "x" }),
    sinal({ id: "orcamento", tipo: "orcamento_parado", prioridade: "alta", chaveDedup: "w" }),
    sinal({ id: "cancelamento", tipo: "cancelamento_sem_reagendamento", prioridade: "alta", chaveDedup: "v" }),
  ];
  assert.deepEqual(
    nucleo.organizarSinaisCanonicos(entrada).map(item => item.id),
    ["cancelamento", "orcamento", "cobranca", "pedido", "confirmacao"]
  );
});

test("ordenação é determinística, inclusive quando tipo e prioridade empatam", () => {
  const a = sinal({ id: "a", tipo: "recompra_possivel", chaveDedup: "a", urgencia: 70 });
  const b = sinal({ id: "b", tipo: "recompra_possivel", chaveDedup: "b", urgencia: 90 });
  const c = sinal({ id: "c", tipo: "recompra_possivel", chaveDedup: "c", urgencia: 90 });
  const primeira = nucleo.organizarSinaisCanonicos([a, b, c]).map(item => item.id);
  const segunda = nucleo.organizarSinaisCanonicos([c, a, b]).map(item => item.id);
  assert.deepEqual(primeira, ["b", "c", "a"]);
  assert.deepEqual(segunda, primeira);
});

test("deduplicação mantém somente o primeiro sinal organizado por chave canônica", () => {
  const alta = sinal({ id: "alta", tipo: "orcamento_parado", prioridade: "alta", chaveDedup: "mesma" });
  const baixa = sinal({ id: "baixa", prioridade: "baixa", chaveDedup: "mesma" });
  assert.deepEqual(nucleo.organizarSinaisCanonicos([baixa, alta]).map(item => item.id), ["alta"]);
});

test("oportunidade de demanda entra na coleção e nas projeções canônicas", () => {
  const demanda = nucleo.adaptarOportunidadesDemanda([DEMANDA])[0];
  const estado = nucleo.gerarEstadoComercialCanonico([demanda]);
  assert.equal(estado.sinais[0].id, "demanda-op-1");
  assert.equal(estado.central.media[0].id, demanda.id);
  assert.equal(estado.radar[0].id, demanda.id);
  assert.equal(estado.missaoDoDia[0].id, demanda.id);
  assert.equal(estado.diretor[0].id, demanda.id);
});

test("Missão, Central e Diretor derivam da mesma ordem sem recalcular prioridade", () => {
  const sinais = [
    sinal({ id: "media", chaveDedup: "media" }),
    sinal({ id: "alta", tipo: "orcamento_parado", prioridade: "alta", chaveDedup: "alta" }),
  ];
  const estado = nucleo.gerarEstadoComercialCanonico(sinais);
  assert.deepEqual(estado.missaoDoDia.map(item => item.id), ["alta", "media"]);
  assert.deepEqual(estado.diretor.map(item => item.id), ["alta", "media"]);
  assert.equal(estado.central.alta[0], estado.sinais[0]);

  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true,
    oportunidadesClientes: [],
    recomendacoes: [],
    ocupacaoPct: null,
    sinaisCanonicos: estado.diretor,
  });
  assert.deepEqual(recomendacoes.map(item => item.id), ["consultivo-canonico-alta", "consultivo-canonico-media"]);
});

test("sinal de demanda carrega entidade, destino e estado real sem fabricar paciente", () => {
  const [resultado] = nucleo.adaptarOportunidadesDemanda([{ ...DEMANDA, nome_informado: null }]);
  assert.equal(resultado.entidadeTipo, "oportunidade");
  assert.equal(resultado.entidadeId, "op-1");
  assert.equal(resultado.destino, "/oportunidades");
  assert.equal(resultado.dados.status, "sinalizada");
  assert.equal(resultado.contexto.nome, "Contato");
  assert.equal("pacienteId" in resultado, false);
});

test("inteligência comercial existe sem pacientes quando há oportunidade real", () => {
  assert.equal(nucleo.existemDadosComerciaisReais({
    totalPacientes: 0,
    totalAgendamentos: 0,
    oportunidades: 1,
    orcamentos: 0,
    tratamentos: 0,
    cobrancas: 0,
    pedidos: 0,
  }), true);
});

test("sinal legado com tipo desconhecido continua válido e recebe tier padrão", () => {
  const legado = sinal({ id: "legado", tipo: "tipo_legado", chaveDedup: "legado" });
  const conhecido = sinal({ id: "conhecido", tipo: "recompra_possivel", chaveDedup: "conhecido" });
  assert.deepEqual(nucleo.organizarSinaisCanonicos([legado, conhecido]).map(item => item.id), ["conhecido", "legado"]);
});

test("fonte sem fatos produz estado vazio e nenhuma recomendação fabricada", () => {
  assert.equal(nucleo.existemDadosComerciaisReais({
    totalPacientes: 0,
    totalAgendamentos: 0,
    oportunidades: 0,
    orcamentos: 0,
    tratamentos: 0,
    cobrancas: 0,
    pedidos: 0,
  }), false);
  assert.deepEqual(nucleo.gerarEstadoComercialCanonico([]).sinais, []);
  assert.deepEqual(diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: false,
    oportunidadesClientes: [],
    recomendacoes: [],
    ocupacaoPct: null,
    sinaisCanonicos: [],
  }), []);
});

test("núcleo canônico permanece puro: sem fetch, banco, service role ou bypass de tenant", () => {
  const source = fs.readFileSync(path.resolve("lib/nucleo-inteligente.ts"), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\.from\s*\(/);
  assert.doesNotMatch(source, /service[_-]?role/i);
  assert.doesNotMatch(source, /supabase/i);
});
