// Prioridades canônicas — fonte única da Visão Geral e do Gerente Comercial.
// Regra protegida: toda prioridade contada pela Visão Geral está acessível no
// Gerente (sem prioridades órfãs). Antes desta correção a Visão Geral contava
// as recomendações gerais do negócio e o Gerente não as listava (26 × 20).
//
// node --test tests/prioridades-canonicas.test.mjs   (CONVERGENCIA_BUILD_DIR = lib compilada)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { montarSinaisCanonicos, contextoNegocioDaBase } = require(path.join(buildDir, "prioridades-canonicas.js"));
const { organizarSinaisCanonicos, gerarEstadoComercialCanonico } = require(path.join(buildDir, "nucleo-inteligente.js"));
const { gerarOportunidadesClientes } = require(path.join(buildDir, "oportunidades-clientes.js"));

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const semComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const plain = v => JSON.parse(JSON.stringify(v));

const HOJE = "2026-10-02", AGORA = "2026-10-02T12:00:00.000Z";
const base = (extra = {}) => ({
  agendaHoje: [], proximosSemana: 0, atrasados: 0, totalPacientes: 5, clientesParaReativar: 0, totalAgendamentos: 3,
  avaliacoesPendentes: 0, config: { email: "a@b.c", telefone: "1", endereco: "x", horario_funcionamento: null }, temWhatsapp: true, ...extra,
});
const clientes = (confirmacoes = []) => gerarOportunidadesClientes({
  hoje: HOJE, agora: AGORA, clientesSemProximoCompromisso: [], cancelamentosSemReagendamento: [], confirmacoesPendentes: confirmacoes,
  orcamentosParados: [{ id: "o1", pacienteNome: "Ana", telefone: "43999990001", procedimento: "Box", valor: 300, apresentadoEm: "2026-09-01T12:00:00.000Z" }],
  pedidosNaoConcluidos: [], recomprasPossiveis: [], tratamentosSemRetorno: [], cobrancasAtrasadas: [],
});

test("as 3 fontes entram: sinais de clientes + recomendações do negócio + demanda", () => {
  const contexto = contextoNegocioDaBase(base({ avaliacoesPendentes: 2, temWhatsapp: false }));
  const sinais = montarSinaisCanonicos({
    temDadosComerciais: true, oportunidadesClientes: clientes(), contexto,
    oportunidadesDemanda: [{ id: "d1", canal: "site", telefone: "43999990009", nome_informado: "Lead", status: "sinalizada", confianca_classificacao: "alta", orcamento_vinculado_id: null }],
  });
  const tipos = sinais.map(s => s.tipo);
  assert.ok(tipos.includes("orcamento_parado"), "cliente");
  assert.ok(sinais.some(s => s.id.startsWith("rec-")), "recomendação do negócio");
  assert.ok(tipos.includes("whatsapp-nao-configurado") && tipos.includes("avaliacao-pendente"), tipos.join(","));
  assert.ok(tipos.includes("interesse_sem_orcamento"), "demanda");
});

test("deduplicação preservada: agregado já coberto pelos cards de cliente não repete", () => {
  const contexto = contextoNegocioDaBase(base({ agendaHoje: [{ id: "a1", hora: "09:00", status: "agendado" }] }));
  const sinais = montarSinaisCanonicos({
    temDadosComerciais: true,
    oportunidadesClientes: clientes([{ id: "a1", nome: "Bia", telefone: "43999990002", data: HOJE }]),
    contexto, oportunidadesDemanda: [],
  });
  assert.equal(sinais.filter(s => s.tipo === "confirmacao-pendente-hoje").length, 0, "agregado coberto sai");
  assert.equal(sinais.filter(s => s.tipo === "confirmacao_pendente").length, 1, "o card do cliente fica");
});

test("sem dados comerciais reais: nenhuma prioridade (mesmo comportamento das duas telas)", () => {
  assert.deepEqual(plain(montarSinaisCanonicos({ temDadosComerciais: false, oportunidadesClientes: clientes(), contexto: contextoNegocioDaBase(base()), oportunidadesDemanda: [] })), []);
});

test("o total da Visão Geral é exatamente a lista do Gerente (mesma ordenação do núcleo)", () => {
  const sinais = montarSinaisCanonicos({ temDadosComerciais: true, oportunidadesClientes: clientes(), contexto: contextoNegocioDaBase(base({ temWhatsapp: false })), oportunidadesDemanda: [] });
  const visaoGeral = gerarEstadoComercialCanonico(sinais);
  const totalVisaoGeral = visaoGeral.missaoDoDia.length + visaoGeral.sinais.slice(visaoGeral.missaoDoDia.length).length;
  const gerente = organizarSinaisCanonicos(sinais);
  assert.equal(totalVisaoGeral, gerente.length);
  assert.deepEqual(plain(gerente.map(s => s.id)), plain(visaoGeral.sinais.map(s => s.id)));
});

test("contexto da Central: mesmo cálculo que a Visão Geral sempre usou", () => {
  const c = contextoNegocioDaBase(base({
    agendaHoje: [{ id: "1", hora: "09:00", status: "agendado" }, { id: "2", hora: "10:00", status: "cancelado" }, { id: "3", hora: "11:00", status: "confirmado" }, { id: "4", hora: "12:00", status: "faltou" }],
    proximosSemana: 4, atrasados: 2,
  }));
  assert.equal(c.compromissosHoje, 2);
  assert.equal(c.pendentesHoje, 1);
  assert.equal(c.cancelamentosHoje, 1);
  assert.equal(c.proximosSemana, 4);
  assert.equal(c.atrasados, 2);
});

test("as duas telas usam a MESMA consulta da base e a MESMA montagem — nenhuma segunda implementação", () => {
  const dashboard = semComentarios(ler("app/dashboard/page.tsx"));
  const gerente = semComentarios(ler("app/copiloto/page.tsx"));
  for (const p of [dashboard, gerente]) {
    assert.match(p, /consultarBaseDoNegocio\(supabase, cid, \{ hoje, amanha, fimSete, trintaDiasAtras \}\)/);
    assert.match(p, /contextoNegocioDaBase\(\{/);
    assert.match(p, /montarSinaisCanonicos\(\{/);
    assert.doesNotMatch(p, /adaptarRecomendacoes|removerAgregadosCobertosPorClientes|gerarCentralOportunidades|adaptarOportunidadesClientes\(|adaptarOportunidadesDemanda\(/, "montagem só na função compartilhada");
    assert.doesNotMatch(p, /supabase\.from\('agendamentos'\)|supabase\.from\("agendamentos"\)|supabase\.from\('pacientes'\)|supabase\.from\("pacientes"\)/, "consultas da base só na função compartilhada");
  }
});
