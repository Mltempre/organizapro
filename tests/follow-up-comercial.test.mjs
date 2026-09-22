// Follow-up Comercial Inteligente V1 — motor puro. Prova que só os
// sinais reais sem dono hoje (oportunidade_parada, orcamento_parado,
// tratamento_sem_retorno, pedido_nao_concluido, recompra_possivel)
// geram casos com ação própria; que cobrança atrasada e os sinais de
// Agenda Autônoma aparecem só como referência (donoDoFluxo), nunca
// re-registrados; que um caso resolvido (dado real mudou) some
// sozinho; e que tudo é determinístico.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/follow-up-comercial.test.mjs
// (build precisa incluir follow-up-comercial.js, motor-orcamentos.js,
// motor-cobranca.js, motor-tratamento.js)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { gerarFollowUpsComerciais, prepararMensagemFollowUp } = await import(pathToFileURL(path.join(buildDir, "follow-up-comercial.js")));

const HOJE = "2026-09-20";
const AGORA = "2026-09-20T12:00:00.000Z";

const entradaVazia = {
  hoje: HOJE, agora: AGORA, entidadesComTentativaHoje: new Set(),
  oportunidadesParadas: [], orcamentosParados: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [], recomprasPossiveis: [],
};

// ── Zero dados ───────────────────────────────────────────────────────

test("zero dados reais nunca fabrica caso nenhum", () => {
  assert.deepEqual(gerarFollowUpsComerciais(entradaVazia), []);
});

// ── Oportunidade parada ──────────────────────────────────────────────

test("oportunidade parada (sem orçamento, sem interação há mais de 3 dias, status aberto) é elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    oportunidadesParadas: [{ id: "op1", telefone: "11911112222", pacienteNome: "Ana", status: "em_contato", orcamentoVinculadoId: null, ultimaInteracaoEm: "2026-09-10T10:00:00Z" }],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "oportunidade_parada");
  assert.equal(r[0].status, "elegivel");
  assert.equal(r[0].donoDoFluxo, "follow-up");
});

test("oportunidade recém-criada (menos de 3 dias) NÃO é elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    oportunidadesParadas: [{ id: "op1", telefone: "11911112222", pacienteNome: "Ana", status: "sinalizada", orcamentoVinculadoId: null, ultimaInteracaoEm: "2026-09-19T10:00:00Z" }],
  });
  assert.equal(r.length, 0);
});

test("oportunidade JÁ com orçamento vinculado não vira oportunidade_parada — o caso agora é orcamento_parado, nunca os dois ao mesmo tempo", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    oportunidadesParadas: [{ id: "op1", telefone: "11911112222", pacienteNome: "Ana", status: "em_contato", orcamentoVinculadoId: "orc1", ultimaInteracaoEm: "2026-09-01T10:00:00Z" }],
  });
  assert.equal(r.length, 0);
});

test("oportunidade em status terminal (convertida/perdida/expirada) nunca é elegível — respeita o estado real", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    oportunidadesParadas: [
      { id: "op1", telefone: "11911112222", pacienteNome: "A", status: "convertida", orcamentoVinculadoId: null, ultimaInteracaoEm: "2026-09-01T10:00:00Z" },
      { id: "op2", telefone: "11922223333", pacienteNome: "B", status: "perdida", orcamentoVinculadoId: null, ultimaInteracaoEm: "2026-09-01T10:00:00Z" },
    ],
  });
  assert.equal(r.length, 0);
});

// ── Orçamento pendente ────────────────────────────────────────────────

test("orçamento apresentado e parado (>= limiar real) é elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    orcamentosParados: [{ id: "orc1", pacienteNome: "Bruno", telefone: "11933334444", procedimento: "Avaliação", valor: 500, apresentadoEm: "2026-09-10T10:00:00Z" }],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "orcamento_parado");
  assert.equal(r[0].status, "elegivel");
});

test("orçamento recém-apresentado (dentro do limiar real) NÃO é elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    orcamentosParados: [{ id: "orc1", pacienteNome: "Bruno", telefone: "11933334444", procedimento: "Avaliação", valor: 500, apresentadoEm: "2026-09-20T11:00:00Z" }],
  });
  assert.equal(r.length, 0);
});

test("caso resolvido: orçamento decidido nunca é enviado na entrada (a tela já só manda 'apresentado') — deixa de ser elegível automaticamente", () => {
  // Simula a tela reconsultando: orçamento que já saiu de 'apresentado'
  // simplesmente não está mais na lista de entrada — nunca aparece.
  const r = gerarFollowUpsComerciais(entradaVazia);
  assert.equal(r.length, 0);
});

// ── Tratamento pendente ──────────────────────────────────────────────

test("tratamento em_andamento sem próximo passo real (precisaRetorno) é elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    tratamentosSemRetorno: [{ id: "trt1", pacienteNome: "Carla", telefone: "11944445555", tipoTratamento: "Limpeza", status: "em_andamento", proximaDataPrevista: null, updatedAt: "2026-09-10T10:00:00Z", interrompidoEm: null }],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "tratamento_sem_retorno");
});

test("tratamento em_andamento COM retorno já agendado no futuro NÃO é elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    tratamentosSemRetorno: [{ id: "trt1", pacienteNome: "Carla", telefone: "11944445555", tipoTratamento: "Limpeza", status: "em_andamento", proximaDataPrevista: "2026-10-01", updatedAt: "2026-09-10T10:00:00Z", interrompidoEm: null }],
  });
  assert.equal(r.length, 0);
});

test("tratamento interrompido é elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    tratamentosSemRetorno: [{ id: "trt1", pacienteNome: "Duda", telefone: "11955556666", tipoTratamento: "Ortodontia", status: "interrompido", proximaDataPrevista: null, updatedAt: "2026-09-10T10:00:00Z", interrompidoEm: "2026-09-10T10:00:00Z" }],
  });
  assert.equal(r.length, 1);
});

// ── Pedido / recompra ─────────────────────────────────────────────────

test("pedido não concluído parado (>= limiar real) é elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    pedidosNaoConcluidos: [{ id: "p1", pacienteNome: "Elis", telefone: "11966667777", descricao: "1 item", valor: 90, criadoEm: "2026-09-17T10:00:00Z" }],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "pedido_nao_concluido");
});

test("recompra possível (>= 60 dias) é elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    recomprasPossiveis: [{ pacienteNome: "Fábio", telefone: "11977778888", ultimoPedidoPagoEm: "2026-06-01T10:00:00Z" }],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "recompra_possivel");
});

// ── Cliente sem telefone ──────────────────────────────────────────────

test("cliente sem telefone real (recompra) nunca fabrica um jeito de contatar — descartado, não incluído", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    recomprasPossiveis: [{ pacienteNome: "Gustavo", telefone: null, ultimoPedidoPagoEm: "2026-06-01T10:00:00Z" }],
  });
  assert.equal(r.length, 0);
});

test("oportunidade sem telefone normalizável nunca vira caso", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    oportunidadesParadas: [{ id: "op1", telefone: "", pacienteNome: "Helena", status: "sinalizada", orcamentoVinculadoId: null, ultimaInteracaoEm: "2026-09-01T10:00:00Z" }],
  });
  assert.equal(r.length, 0);
});

// ── Idempotência / aguardando retorno ──────────────────────────────────

test("caso com tentativa já registrada hoje aparece como 'aguardando_retorno', nunca duplicado nem escondido", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    entidadesComTentativaHoje: new Set(["orc1"]),
    orcamentosParados: [{ id: "orc1", pacienteNome: "Igor", telefone: "11988889999", procedimento: "x", valor: 100, apresentadoEm: "2026-09-10T10:00:00Z" }],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].status, "aguardando_retorno");
});

test("follow-up futuro legítimo: mesmo caso SEM tentativa hoje (dia seguinte) volta a ser elegível", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    entidadesComTentativaHoje: new Set(), // nenhuma tentativa HOJE, mesmo que tenha tido uma ontem
    orcamentosParados: [{ id: "orc1", pacienteNome: "Igor", telefone: "11988889999", procedimento: "x", valor: 100, apresentadoEm: "2026-09-10T10:00:00Z" }],
  });
  assert.equal(r[0].status, "elegivel");
});

// ── Delegação — Cobrador Digital e Agenda Autônoma ─────────────────────

test("cobrança atrasada aparece como caso delegado ao Cobrador Digital — sem status próprio, sem ação de tentativa aqui", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    cobrancasAtrasadas: [{ id: "c1", pacienteNome: "Julia", telefone: "11999990000", descricao: "Mensalidade", valor: 200, vencimento: "2026-09-01", status: "pendente" }],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "cobranca_atrasada");
  assert.equal(r[0].donoDoFluxo, "cobrador-digital");
  assert.equal(r[0].status, null);
  assert.equal(r[0].destino, "/cobrancas");
});

test("cobrança dentro do vencimento nunca vira caso delegado — nunca fabrica atraso", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    cobrancasAtrasadas: [{ id: "c1", pacienteNome: "Julia", telefone: "11999990000", descricao: "Mensalidade", valor: 200, vencimento: "2026-10-01", status: "pendente" }],
  });
  assert.equal(r.length, 0);
});

test("casos de Agenda Autônoma são aceitos como já prontos (CasoAgendaAutonoma) e aparecem delegados, nunca redetectados", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    casosAgendaAutonoma: [{ tipo: "cancelamento_sem_reagendamento", id: "ag1", nome: "Kaio", telefone: "11911110000", motivo: "Cancelou e não reagendou", proximaAcao: "Reagendar", destino: "/agendamentos" }],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "cancelamento_sem_reagendamento");
  assert.equal(r[0].donoDoFluxo, "agenda-autonoma");
  assert.equal(r[0].status, null);
  assert.equal(r[0].destino, "/agendamentos");
});

test("não duplicação: caso próprio e caso delegado nunca se misturam — cada um mantém seu donoDoFluxo mesmo quando aparecem juntos", () => {
  const r = gerarFollowUpsComerciais({
    ...entradaVazia,
    orcamentosParados: [{ id: "orc1", pacienteNome: "Laura", telefone: "11922221111", procedimento: "x", valor: 100, apresentadoEm: "2026-09-10T10:00:00Z" }],
    cobrancasAtrasadas: [{ id: "c1", pacienteNome: "Marcos", telefone: "11933332222", descricao: "x", valor: 200, vencimento: "2026-09-01", status: "pendente" }],
  });
  assert.equal(r.length, 2);
  assert.equal(r.find(c => c.tipo === "orcamento_parado").donoDoFluxo, "follow-up");
  assert.equal(r.find(c => c.tipo === "cobranca_atrasada").donoDoFluxo, "cobrador-digital");
});

// ── Dados incompletos ────────────────────────────────────────────────

test("dados incompletos (sem os campos delegados) nunca quebram — cobrancasAtrasadas/casosAgendaAutonoma são opcionais", () => {
  const r = gerarFollowUpsComerciais({
    hoje: HOJE, agora: AGORA, entidadesComTentativaHoje: new Set(),
    oportunidadesParadas: [], orcamentosParados: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [], recomprasPossiveis: [],
  });
  assert.deepEqual(r, []);
});

// ── Mensagem preparada ──────────────────────────────────────────────

test("prepararMensagemFollowUp: nunca menciona valor, dívida, acordo, desconto ou promessa — texto profissional genérico", () => {
  for (const tipo of ["oportunidade_parada", "orcamento_parado", "tratamento_sem_retorno", "pedido_nao_concluido", "recompra_possivel"]) {
    const m = prepararMensagemFollowUp(tipo, "Nina", "motivo qualquer");
    assert.equal(m.canal, "whatsapp");
    assert.doesNotMatch(m.texto.toLowerCase(), /r\$|desconto|acordo|parcelamento|juros|promet/);
  }
});

// ── Priorização (mesma ordem já usada no Radar, nunca um score novo) ──

test("priorização: casos próprios vêm ordenados na mesma ordem relativa já usada no Radar (orçamento antes de pedido antes de tratamento antes de recompra), e sempre antes dos delegados", () => {
  const r = gerarFollowUpsComerciais({
    hoje: HOJE, agora: AGORA, entidadesComTentativaHoje: new Set(),
    oportunidadesParadas: [],
    recomprasPossiveis: [{ pacienteNome: "A", telefone: "11911111111", ultimoPedidoPagoEm: "2026-06-01T10:00:00Z" }],
    tratamentosSemRetorno: [{ id: "t1", pacienteNome: "B", telefone: "11922222222", tipoTratamento: "x", status: "interrompido", proximaDataPrevista: null, updatedAt: "2026-09-01T10:00:00Z", interrompidoEm: "2026-09-01T10:00:00Z" }],
    pedidosNaoConcluidos: [{ id: "p1", pacienteNome: "C", telefone: "11933333333", descricao: "x", valor: 50, criadoEm: "2026-09-17T10:00:00Z" }],
    orcamentosParados: [{ id: "orc1", pacienteNome: "D", telefone: "11944444444", procedimento: "x", valor: 100, apresentadoEm: "2026-09-01T10:00:00Z" }],
    cobrancasAtrasadas: [{ id: "c1", pacienteNome: "E", telefone: "11955555555", descricao: "x", valor: 200, vencimento: "2026-09-01", status: "pendente" }],
  });
  assert.deepEqual(r.map(c => c.tipo), ["orcamento_parado", "pedido_nao_concluido", "tratamento_sem_retorno", "recompra_possivel", "cobranca_atrasada"]);
});

// ── Determinismo ──────────────────────────────────────────────────────

test("idempotência/determinismo: mesma entrada duas vezes produz exatamente o mesmo resultado", () => {
  const entrada = {
    ...entradaVazia,
    orcamentosParados: [{ id: "orc1", pacienteNome: "Nina", telefone: "11911112222", procedimento: "x", valor: 100, apresentadoEm: "2026-09-10T10:00:00Z" }],
  };
  assert.deepEqual(gerarFollowUpsComerciais(entrada), gerarFollowUpsComerciais(entrada));
});

// ── Wiring: a tela nunca consulta o banco direto, sempre pelas APIs canônicas já existentes; tenant escopado por clinica_id ──

const pagina = fs.readFileSync(new URL("../app/follow-up/page.tsx", import.meta.url), "utf8");
const rota = fs.readFileSync(new URL("../app/api/follow-up/tentativa/route.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Atualizado — Correção da Última Milha (achados #3/#4/#5): os 5 fetches
// passaram a usar fetchJsonSeguro (lib/fetch-seguro.ts) em vez de
// fetch(...).then(...).catch(...) direto, para distinguir falha real de
// vazio real — mesmos 5 endpoints canônicos, nenhum novo, nenhum removido.
test("follow-up: tela busca só pelas APIs canônicas já existentes (todas escopadas por clinica_id, via fetchJsonSeguro), nenhuma query direta a supabase.from em tabela de negócio", () => {
  assert.match(pagina, /import \{ fetchJsonSeguro \} from '\.\.\/\.\.\/lib\/fetch-seguro'/);
  assert.match(pagina, /fetchJsonSeguro<\{ data: OportunidadeRow\[\] \}>\('\/api\/oportunidades'/);
  assert.match(pagina, /\/api\/orcamentos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/tratamentos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/pedidos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/cobrancas\?clinica_id=\$\{cid\}/);
  assert.doesNotMatch(pagina, /supabase\.from\("orcamentos"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("cobrancas"\)/);
});

test("follow-up: toda a decisão é delegada a gerarFollowUpsComerciais — nenhuma soma/priorização calculada na própria tela", () => {
  assert.match(pagina, /gerarFollowUpsComerciais\(/);
});

test("POST /api/follow-up/tentativa: autoriza antes de qualquer leitura/escrita", () => {
  const idxAuth = rota.indexOf("autorizarUsuarioNaClinica(req, clinica_id)");
  const idxInsert = rota.indexOf('.from("eventos_dominio").insert(');
  assert.ok(idxAuth > -1 && idxInsert > -1);
  assert.ok(idxAuth < idxInsert, "autorização deveria acontecer antes do registro do evento");
});

test("POST /api/follow-up/tentativa: entidade é sempre relida do banco escopada por clinica_id, nunca confia no client — fail-closed", () => {
  assert.match(rota, /\.eq\("clinica_id", clinica_id\)/);
  // reavaliarCasoFollowUp (lib/follow-up-persistencia.ts, extraído da rota
  // para ser reaproveitado também por .../aprovar-envio — WhatsApp
  // Governado V1) é quem chama gerarFollowUpsComerciais internamente;
  // continua sendo a MESMA função pura, nenhuma segunda implementação.
  assert.match(rota, /reavaliarCasoFollowUp\(/);
  assert.match(rota, /if \(!caso\)/);
});

test("POST /api/follow-up/tentativa: idempotência via eventos_dominio inclui a data — no máximo uma tentativa por caso por dia", () => {
  assert.match(rota, /chaveIdempotencia = `\$\{entidade_id\}:followup\.tentativa:\$\{hoje\}`/);
});

test("POST /api/follow-up/tentativa: NUNCA chama o adaptador de envio real (Z-API/WhatsApp) — modo estritamente preparatório", () => {
  assert.doesNotMatch(rota, /fetch\(.*whatsapp/i);
  assert.doesNotMatch(rota, /z-api\.io/i);
  assert.match(rota, /modo: "preparatorio"/);
  assert.match(rota, /resultado: null/);
});

test("POST /api/follow-up/tentativa: rejeita explicitamente tipos delegados (cobranca_atrasada, sinais de Agenda) — nunca aceita registrar tentativa própria para eles", () => {
  assert.match(rota, /TIPOS_VALIDOS: TipoFollowUpProprio\[\] = \["oportunidade_parada", "orcamento_parado", "tratamento_sem_retorno", "pedido_nao_concluido", "recompra_possivel"\]/);
  assert.doesNotMatch(rota, /"cobranca_atrasada"/);
  assert.doesNotMatch(rota, /"cancelamento_sem_reagendamento"/);
});
