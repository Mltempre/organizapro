// Cliente 360 V1 — motor puro. Prova que a identidade do cliente nunca
// mistura pessoas diferentes, que a timeline só mostra fatos reais em
// ordem cronológica, que o total pago nunca duplica dinheiro entre
// orçamento/tratamento/cobrança, e que dados incompletos (sem paciente_id
// nem telefone) nunca são incluídos por suposição.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/cliente-360.test.mjs
// (build precisa incluir cliente-360.js e oportunidades-demanda.js)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { gerarCliente360 } = await import(pathToFileURL(path.join(buildDir, "cliente-360.js")));

const AGORA = "2026-09-20T12:00:00.000Z";

const clienteBase = {
  id: "pac-1", nome: "Ana Costa", telefone: "11911112222", whatsapp: null,
  email: "ana@example.com", status: "ativo", proximaConsulta: null, criadoEm: "2026-01-01T10:00:00Z",
};

const entradaVazia = {
  cliente: clienteBase, agora: AGORA,
  agendamentos: [], oportunidades: [], orcamentos: [], tratamentos: [], cobrancas: [], pedidos: [], avaliacoes: [],
};

// ── Cliente sem histórico ────────────────────────────────────────────

test("cliente sem histórico real nunca fabrica timeline nem indicador — tudo zero/null", () => {
  const r = gerarCliente360(entradaVazia);
  assert.equal(r.timeline.length, 0);
  assert.equal(r.indicadores.totalPago, 0);
  assert.equal(r.indicadores.totalEmAberto, 0);
  assert.equal(r.indicadores.quantidadeCompras, 0);
  assert.equal(r.indicadores.ultimoRelacionamento, null);
  assert.equal(r.indicadores.proximoCompromisso, null);
  assert.equal(r.indicadores.temOportunidadeAtiva, false);
});

// ── Um domínio por vez ────────────────────────────────────────────────

test("cliente com agendamento (por telefone) aparece na timeline e como próximo compromisso quando futuro", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    agendamentos: [{ id: "ag1", telefone: "11911112222", data: "2026-09-25", hora: "14:00", tipoConsulta: "Retorno", status: "agendado" }],
  });
  assert.equal(r.timeline.length, 1);
  assert.equal(r.timeline[0].tipo, "agendamento");
  assert.equal(r.indicadores.proximoCompromisso, "2026-09-25T14:00");
});

test("cliente com oportunidade ativa (não terminal) marca temOportunidadeAtiva", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    oportunidades: [{ id: "op1", telefone: "11911112222", canal: "whatsapp", status: "em_contato", criadoEm: "2026-09-01T10:00:00Z", ultimaInteracaoEm: "2026-09-01T10:00:00Z" }],
  });
  assert.equal(r.indicadores.temOportunidadeAtiva, true);
  assert.equal(r.oportunidades.length, 1);
});

test("oportunidade em status terminal NÃO marca temOportunidadeAtiva", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    oportunidades: [{ id: "op1", telefone: "11911112222", canal: "whatsapp", status: "perdida", criadoEm: "2026-09-01T10:00:00Z", ultimaInteracaoEm: "2026-09-01T10:00:00Z" }],
  });
  assert.equal(r.indicadores.temOportunidadeAtiva, false);
});

test("cliente com orçamento (por telefone, sem paciente_id no schema) aparece na timeline com valor, nunca somado ao total pago", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    orcamentos: [{ id: "orc1", telefone: "11911112222", procedimento: "Avaliação", valor: 500, status: "apresentado", apresentadoEm: "2026-09-10T10:00:00Z", decididoEm: null }],
  });
  assert.equal(r.orcamentos.length, 1);
  assert.equal(r.indicadores.totalPago, 0); // orçamento nunca é "pago"
});

test("cliente com tratamento (por paciente_id) aparece na timeline, valor_estimado nunca somado ao total pago", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    tratamentos: [{ id: "trt1", pacienteId: "pac-1", telefone: null, tipoTratamento: "Limpeza", status: "em_andamento", valorEstimado: 300, proximaDataPrevista: null, iniciadoEm: "2026-08-01T10:00:00Z", concluidoEm: null }],
  });
  assert.equal(r.tratamentos.length, 1);
  assert.equal(r.indicadores.totalPago, 0);
});

test("cliente com cobrança paga soma ao total pago; cobrança pendente soma ao total em aberto", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    cobrancas: [
      { id: "c1", pacienteId: "pac-1", telefone: null, descricao: "Consulta", valor: 200, valorPago: 200, vencimento: "2026-09-01", status: "pago", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null },
      { id: "c2", pacienteId: "pac-1", telefone: null, descricao: "Retorno", valor: 150, valorPago: null, vencimento: "2026-10-01", status: "pendente", pagoEm: null, emCobrancaEm: null },
    ],
  });
  assert.equal(r.indicadores.totalPago, 200);
  assert.equal(r.indicadores.totalEmAberto, 150);
});

test("cliente com pedido pago soma ao total pago e à quantidade de compras", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    pedidos: [{ id: "p1", pacienteId: "pac-1", telefone: null, descricao: "1 item", valor: 90, status: "pago", criadoEm: "2026-09-01T10:00:00Z", pagamentoConfirmadoEm: "2026-09-02T10:00:00Z" }],
  });
  assert.equal(r.indicadores.totalPago, 90);
  assert.equal(r.indicadores.quantidadeCompras, 1);
});

test("pedido NÃO pago não soma nem conta como compra", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    pedidos: [{ id: "p1", pacienteId: "pac-1", telefone: null, descricao: "1 item", valor: 90, status: "criado", criadoEm: "2026-09-01T10:00:00Z", pagamentoConfirmadoEm: null }],
  });
  assert.equal(r.indicadores.totalPago, 0);
  assert.equal(r.indicadores.quantidadeCompras, 0);
});

// ── Cadeia completa (múltiplos domínios) ────────────────────────────────

test("cadeia completa: oportunidade + orçamento + tratamento + cobrança paga + pedido pago, todos na timeline, total pago é só a soma dos estágios terminais", () => {
  const r = gerarCliente360({
    cliente: clienteBase, agora: AGORA,
    agendamentos: [{ id: "ag1", telefone: "11911112222", data: "2026-08-01", hora: "10:00", tipoConsulta: "Avaliação", status: "atendido" }],
    oportunidades: [{ id: "op1", telefone: "11911112222", canal: "whatsapp", status: "convertida", criadoEm: "2026-07-25T10:00:00Z", ultimaInteracaoEm: "2026-07-28T10:00:00Z" }],
    orcamentos: [{ id: "orc1", telefone: "11911112222", procedimento: "Implante", valor: 9999, status: "aprovado", apresentadoEm: "2026-07-28T10:00:00Z", decididoEm: "2026-07-30T10:00:00Z" }],
    tratamentos: [{ id: "trt1", pacienteId: "pac-1", telefone: null, tipoTratamento: "Implante", status: "concluido", valorEstimado: 9999, proximaDataPrevista: null, iniciadoEm: "2026-08-01T10:00:00Z", concluidoEm: "2026-08-20T10:00:00Z" }],
    cobrancas: [{ id: "c1", pacienteId: "pac-1", telefone: null, descricao: "Implante", valor: 9999, valorPago: 9999, vencimento: "2026-08-25", status: "pago", pagoEm: "2026-08-25T10:00:00Z", emCobrancaEm: null }],
    pedidos: [{ id: "p1", pacienteId: "pac-1", telefone: null, descricao: "1 item", valor: 90, status: "pago", criadoEm: "2026-09-01T10:00:00Z", pagamentoConfirmadoEm: "2026-09-02T10:00:00Z" }],
    avaliacoes: [],
  });
  assert.equal(r.indicadores.totalPago, 9999 + 90); // só cobranca.valor_pago + pedido.valor — nunca orçamento/tratamento
  assert.ok(r.timeline.length >= 7); // agendamento, oportunidade, orçamento(apresentado+decidido), tratamento(iniciado+concluído), cobrança(registrada+paga), pedido(criado+pago)
});

// ── Timeline cronológica ────────────────────────────────────────────────

test("timeline é sempre ordenada do mais recente para o mais antigo", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    cobrancas: [
      { id: "c1", pacienteId: "pac-1", telefone: null, descricao: "Antiga", valor: 100, valorPago: 100, vencimento: "2026-01-01", status: "pago", pagoEm: "2026-01-01T10:00:00Z", emCobrancaEm: null },
      { id: "c2", pacienteId: "pac-1", telefone: null, descricao: "Recente", valor: 100, valorPago: 100, vencimento: "2026-08-01", status: "pago", pagoEm: "2026-08-01T10:00:00Z", emCobrancaEm: null },
    ],
  });
  const datas = r.timeline.map(e => e.data);
  const ordenado = [...datas].sort().reverse();
  assert.deepEqual(datas, ordenado);
});

// ── Anti-duplicação financeira ──────────────────────────────────────────

test("anti-duplicação: valor de orçamento (9999) e valor_estimado de tratamento (9999) NUNCA são somados ao total pago — só valor_pago da cobrança conta", () => {
  const r = gerarCliente360({
    cliente: clienteBase, agora: AGORA,
    agendamentos: [], avaliacoes: [],
    oportunidades: [{ id: "op1", telefone: "11911112222", canal: "site", status: "convertida", criadoEm: "2026-07-25T10:00:00Z", ultimaInteracaoEm: "2026-07-25T10:00:00Z" }],
    orcamentos: [{ id: "orc1", telefone: "11911112222", procedimento: "Prótese", valor: 9999, status: "aprovado", apresentadoEm: "2026-07-25T10:00:00Z", decididoEm: "2026-07-27T10:00:00Z" }],
    tratamentos: [{ id: "trt1", pacienteId: "pac-1", telefone: null, tipoTratamento: "Prótese", status: "concluido", valorEstimado: 9999, proximaDataPrevista: null, iniciadoEm: "2026-08-01T10:00:00Z", concluidoEm: "2026-08-15T10:00:00Z" }],
    cobrancas: [{ id: "c1", pacienteId: "pac-1", telefone: null, descricao: "Prótese", valor: 800, valorPago: 700, vencimento: "2026-08-20", status: "pago", pagoEm: "2026-08-20T10:00:00Z", emCobrancaEm: null }],
    pedidos: [],
  });
  assert.equal(r.indicadores.totalPago, 700); // nem 9999, nem 800 — só o valor_pago real
});

// ── Identidade segura (nunca mistura pessoas diferentes) ────────────────

test("identidade: registro de OUTRO cliente (telefone e paciente_id diferentes) nunca aparece", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    cobrancas: [
      { id: "c1", pacienteId: "pac-1", telefone: null, descricao: "Do cliente certo", valor: 100, valorPago: 100, vencimento: "2026-09-01", status: "pago", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null },
      { id: "c2", pacienteId: "pac-2", telefone: "11999998888", descricao: "De outro cliente", valor: 500, valorPago: 500, vencimento: "2026-09-01", status: "pago", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null },
    ],
  });
  assert.equal(r.cobrancas.length, 1);
  assert.equal(r.cobrancas[0].id, "c1");
  assert.equal(r.indicadores.totalPago, 100); // nunca 600
});

test("identidade: telefone com formatação diferente (parênteses/espaço) ainda é reconhecido como o mesmo cliente — normalização determinística", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    orcamentos: [{ id: "orc1", telefone: "(11) 91111-2222", procedimento: "Avaliação", valor: 300, status: "apresentado", apresentadoEm: "2026-09-01T10:00:00Z", decididoEm: null }],
  });
  assert.equal(r.orcamentos.length, 1);
});

test("identidade: paciente_id de OUTRO cliente nunca é incluído mesmo sem telefone para comparar", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    tratamentos: [{ id: "trt1", pacienteId: "pac-outro", telefone: null, tipoTratamento: "x", status: "em_andamento", valorEstimado: 100, proximaDataPrevista: null, iniciadoEm: "2026-09-01T10:00:00Z", concluidoEm: null }],
  });
  assert.equal(r.tratamentos.length, 0);
});

// ── Dados incompletos ────────────────────────────────────────────────

test("registro sem paciente_id E sem telefone nunca é incluído por suposição, mesmo sendo o único registro existente", () => {
  const r = gerarCliente360({
    ...entradaVazia,
    cobrancas: [{ id: "c1", pacienteId: null, telefone: null, descricao: "órfã", valor: 100, valorPago: 100, vencimento: "2026-09-01", status: "pago", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null }],
  });
  assert.equal(r.cobrancas.length, 0);
  assert.equal(r.indicadores.totalPago, 0);
});

test("cliente sem nenhum telefone/whatsapp cadastrado: registros vinculados só por paciente_id ainda funcionam", () => {
  const r = gerarCliente360({
    cliente: { ...clienteBase, telefone: null, whatsapp: null },
    agora: AGORA,
    agendamentos: [], oportunidades: [], orcamentos: [], avaliacoes: [], pedidos: [],
    tratamentos: [{ id: "trt1", pacienteId: "pac-1", telefone: null, tipoTratamento: "x", status: "em_andamento", valorEstimado: 100, proximaDataPrevista: null, iniciadoEm: "2026-09-01T10:00:00Z", concluidoEm: null }],
    cobrancas: [],
  });
  assert.equal(r.tratamentos.length, 1);
});

// ── Determinismo ──────────────────────────────────────────────────────

test("idempotência/determinismo: mesma entrada duas vezes produz exatamente o mesmo resultado", () => {
  const entrada = {
    ...entradaVazia,
    cobrancas: [{ id: "c1", pacienteId: "pac-1", telefone: null, descricao: "x", valor: 100, valorPago: 100, vencimento: "2026-09-01", status: "pago", pagoEm: "2026-09-01T10:00:00Z", emCobrancaEm: null }],
  };
  assert.deepEqual(gerarCliente360(entrada), gerarCliente360(entrada));
});

// ── Wiring: a tela nunca consulta o banco direto para os domínios service-role-only, sempre pelas APIs canônicas já existentes; cliente sempre escopado por id E clinica_id (isolamento tenant) ──

const pagina = fs.readFileSync(new URL("../app/clientes/[id]/page.tsx", import.meta.url), "utf8");

test("cliente-360: paciente é buscado sempre escopado por id E clinica_id — nunca um cliente de outro tenant", () => {
  const idx = pagina.indexOf("from('pacientes')");
  assert.ok(idx > -1);
  const trecho = pagina.slice(idx, idx + 150);
  assert.match(trecho, /\.eq\('id', params\.id\)/);
  assert.match(trecho, /\.eq\('clinica_id', cid\)/);
});

test("cliente-360: domínios service-role-only (orçamentos/tratamentos/cobranças/pedidos) usam sempre as APIs canônicas escopadas por clinica_id, nunca supabase.from direto", () => {
  assert.match(pagina, /\/api\/orcamentos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/tratamentos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/cobrancas\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/pedidos\?clinica_id=\$\{cid\}/);
  assert.doesNotMatch(pagina, /supabase\.from\("orcamentos"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("cobrancas"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("tratamentos"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("pedidos"\)/);
});

test("cliente-360: toda a decisão é delegada a gerarCliente360 — nenhuma soma calculada na própria tela", () => {
  assert.match(pagina, /gerarCliente360\(/);
  assert.doesNotMatch(pagina, /\.reduce\(/);
});
