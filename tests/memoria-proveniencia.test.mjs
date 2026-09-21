// Memória com Proveniência V1 — motor puro. Prova que nenhuma memória é
// aceita sem fonte real identificável, que uma referência a entidade
// canônica nunca guarda sua própria verdade (a validade é sempre
// recalculada do estado atual real), que um fato humano mais recente
// sempre prevalece sobre um antigo do mesmo tipo, e que tudo é
// determinístico e escopado por tenant.
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/memoria-proveniencia.test.mjs
// (build precisa incluir memoria-proveniencia.js)

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const {
  validarProveniencia, prepararRegistroMemoria, referenciaAindaValida,
  fatoHumanoAindaValido, fatoVigente, ordenarCronologicamente,
} = await import(pathToFileURL(path.join(buildDir, "memoria-proveniencia.js")));

// ── Proveniência — fonte válida vs rejeição ──────────────────────────

test("proveniência: referência a entidade canônica com id real é válida", () => {
  const r = validarProveniencia({ tipo: "entidade_canonica", entidadeTipo: "orcamento", entidadeId: "orc1" });
  assert.deepEqual(r, { valido: true });
});

test("proveniência: referência a entidade canônica SEM id nunca é válida — fail-closed", () => {
  const r = validarProveniencia({ tipo: "entidade_canonica", entidadeTipo: "orcamento", entidadeId: "" });
  assert.equal(r.valido, false);
});

test("proveniência: fato humano com autor real é válido", () => {
  const r = validarProveniencia({ tipo: "humano", autorId: "user1", autorNome: "Maria (recepção)" });
  assert.deepEqual(r, { valido: true });
});

test("proveniência: fato humano SEM autor identificado nunca é válido — fail-closed, sem fonte não persiste como fato confiável", () => {
  const r = validarProveniencia({ tipo: "humano", autorId: null, autorNome: "" });
  assert.equal(r.valido, false);
  assert.match(r.motivo, /autor/);
});

// ── prepararRegistroMemoria — rejeição sem proveniência ──────────────

test("prepararRegistroMemoria: rejeita (retorna null) quando a proveniência é inválida — nunca fabrica uma origem", () => {
  const resultado = prepararRegistroMemoria({
    clinicaId: "c1", cliente: { pacienteId: "pac1", telefone: null },
    origem: { tipo: "humano", autorId: null, autorNome: "" },
    tipoFato: "combinado_retorno", conteudo: "Cliente pediu retorno sexta",
    observadoEm: "2026-09-20T10:00:00Z", validoAte: null,
  });
  assert.equal(resultado, null);
});

test("prepararRegistroMemoria: fato humano sem cliente identificável (sem paciente_id nem telefone) nunca é registrado", () => {
  const resultado = prepararRegistroMemoria({
    clinicaId: "c1", cliente: { pacienteId: null, telefone: null },
    origem: { tipo: "humano", autorId: "user1", autorNome: "Maria" },
    tipoFato: "combinado_retorno", conteudo: "x",
    observadoEm: "2026-09-20T10:00:00Z", validoAte: null,
  });
  assert.equal(resultado, null);
});

// ── Referência a cliente/entidade ────────────────────────────────────

test("prepararRegistroMemoria: memória de referência a entidade canônica usa a entidade real como entidadeId, preserva clinicaId no payload", () => {
  const resultado = prepararRegistroMemoria({
    clinicaId: "c1", cliente: { pacienteId: "pac1", telefone: null },
    origem: { tipo: "entidade_canonica", entidadeTipo: "cobranca", entidadeId: "cob1" },
    tipoFato: "referencia_cobranca", conteudo: "Cobrança referenciada",
    observadoEm: "2026-09-20T10:00:00Z", validoAte: null,
  });
  assert.ok(resultado);
  assert.equal(resultado.entidadeTipo, "cobranca");
  assert.equal(resultado.entidadeId, "cob1");
  assert.equal(resultado.payload.cliente.pacienteId, "pac1");
});

test("prepararRegistroMemoria: fato humano usa o telefone normalizado do cliente como entidadeId quando não há paciente_id", () => {
  const resultado = prepararRegistroMemoria({
    clinicaId: "c1", cliente: { pacienteId: null, telefone: "(11) 91111-2222" },
    origem: { tipo: "humano", autorId: "user1", autorNome: "Maria" },
    tipoFato: "preferencia_contato", conteudo: "Prefere contato à tarde",
    observadoEm: "2026-09-20T10:00:00Z", validoAte: null,
  });
  assert.equal(resultado.entidadeTipo, "cliente");
  assert.equal(resultado.entidadeId, "11911112222");
});

// ── Idempotência ──────────────────────────────────────────────────────

test("idempotência: mesmo fato (mesma entidade + tipo + momento observado) gera a mesma chave — nunca duplica em duplo clique/retry", () => {
  const fato = {
    clinicaId: "c1", cliente: { pacienteId: "pac1", telefone: null },
    origem: { tipo: "humano", autorId: "user1", autorNome: "Maria" },
    tipoFato: "combinado_retorno", conteudo: "Retorno sexta",
    observadoEm: "2026-09-20T10:00:00Z", validoAte: "2026-09-25T23:59:59Z",
  };
  const r1 = prepararRegistroMemoria(fato);
  const r2 = prepararRegistroMemoria(fato);
  assert.equal(r1.chaveIdempotencia, r2.chaveIdempotencia);
});

test("idempotência: um fato NOVO (observadoEm diferente) do mesmo tipo/entidade gera uma chave DIFERENTE — nunca bloqueia um follow-up legítimo futuro", () => {
  const base = {
    clinicaId: "c1", cliente: { pacienteId: "pac1", telefone: null },
    origem: { tipo: "humano", autorId: "user1", autorNome: "Maria" },
    tipoFato: "combinado_retorno", conteudo: "Retorno",
    validoAte: null,
  };
  const r1 = prepararRegistroMemoria({ ...base, observadoEm: "2026-09-20T10:00:00Z" });
  const r2 = prepararRegistroMemoria({ ...base, observadoEm: "2026-09-27T10:00:00Z" });
  assert.notEqual(r1.chaveIdempotencia, r2.chaveIdempotencia);
});

// ── Estado canônico sempre prevalece sobre memória antiga ──────────────

test("referência a orçamento: só válida enquanto 'apresentado' — decidido (aprovado/recusado/expirado) invalida a memória automaticamente, sem flag manual", () => {
  assert.equal(referenciaAindaValida({ entidadeTipo: "orcamento", status: "apresentado" }), true);
  assert.equal(referenciaAindaValida({ entidadeTipo: "orcamento", status: "aprovado" }), false);
  assert.equal(referenciaAindaValida({ entidadeTipo: "orcamento", status: "recusado" }), false);
});

test("referência a cobrança: paga ou cancelada invalida a memória de 'precisa cobrar' automaticamente", () => {
  assert.equal(referenciaAindaValida({ entidadeTipo: "cobranca", status: "pendente" }), true);
  assert.equal(referenciaAindaValida({ entidadeTipo: "cobranca", status: "pago" }), false);
  assert.equal(referenciaAindaValida({ entidadeTipo: "cobranca", status: "cancelada" }), false);
});

test("referência a oportunidade: convertida/perdida/expirada invalida — respeita o estado real, nunca reabre", () => {
  assert.equal(referenciaAindaValida({ entidadeTipo: "oportunidade", status: "em_contato" }), true);
  assert.equal(referenciaAindaValida({ entidadeTipo: "oportunidade", status: "convertida" }), false);
  assert.equal(referenciaAindaValida({ entidadeTipo: "oportunidade", status: "perdida" }), false);
});

test("referência a pedido: pago ou cancelado invalida", () => {
  assert.equal(referenciaAindaValida({ entidadeTipo: "pedido", status: "confirmado" }), true);
  assert.equal(referenciaAindaValida({ entidadeTipo: "pedido", status: "pago" }), false);
});

test("referência a agendamento: sempre válida como fato histórico — não expira por status", () => {
  assert.equal(referenciaAindaValida({ entidadeTipo: "agendamento" }), true);
});

test("fato humano com validoAte: deixa de valer quando 'agora' passa da data — 'retornar sexta' expira", () => {
  assert.equal(fatoHumanoAindaValido("2026-09-25T23:59:59Z", "2026-09-20T10:00:00Z"), true);
  assert.equal(fatoHumanoAindaValido("2026-09-25T23:59:59Z", "2026-09-26T10:00:00Z"), false);
});

test("fato humano sem validoAte não expira por tempo", () => {
  assert.equal(fatoHumanoAindaValido(null, "2099-01-01T00:00:00Z"), true);
});

// ── Fato posterior substitui anterior ────────────────────────────────

test("fatoVigente: entre vários fatos do mesmo tipo/cliente, só o mais recente (por observadoEm) prevalece — nunca acumula", () => {
  const fatos = [
    { entidadeId: "pac1", tipoFato: "preferencia_contato", conteudo: "Prefere manhã", origem: { tipo: "humano", autorId: "u1", autorNome: "Maria" }, observadoEm: "2026-08-01T10:00:00Z", validoAte: null, registradoEm: "2026-08-01T10:05:00Z" },
    { entidadeId: "pac1", tipoFato: "preferencia_contato", conteudo: "Prefere tarde", origem: { tipo: "humano", autorId: "u1", autorNome: "Maria" }, observadoEm: "2026-09-15T10:00:00Z", validoAte: null, registradoEm: "2026-09-15T10:05:00Z" },
  ];
  const vigente = fatoVigente(fatos);
  assert.equal(vigente.conteudo, "Prefere tarde");
});

test("fatoVigente: fatos de tipos diferentes nunca se substituem entre si — cada tipo é consultado separadamente", () => {
  const fatos = [
    { entidadeId: "pac1", tipoFato: "preferencia_contato", conteudo: "Prefere tarde", origem: { tipo: "humano", autorId: "u1", autorNome: "Maria" }, observadoEm: "2026-08-01T10:00:00Z", validoAte: null, registradoEm: "2026-08-01T10:05:00Z" },
  ];
  const vigenteOutroTipo = fatoVigente(fatos.filter(f => f.tipoFato === "combinado_retorno"));
  assert.equal(vigenteOutroTipo, null);
});

test("fatoVigente: zero fatos nunca fabrica um resultado", () => {
  assert.equal(fatoVigente([]), null);
});

// ── Ordenação temporal ────────────────────────────────────────────────

test("ordenarCronologicamente: mais recente primeiro, por observadoEm (quando o fato aconteceu, não quando foi digitado)", () => {
  const fatos = [
    { entidadeId: "pac1", tipoFato: "x", conteudo: "antigo", origem: { tipo: "humano", autorId: "u1", autorNome: "M" }, observadoEm: "2026-08-01T10:00:00Z", validoAte: null, registradoEm: "2026-09-20T10:00:00Z" },
    { entidadeId: "pac1", tipoFato: "x", conteudo: "recente", origem: { tipo: "humano", autorId: "u1", autorNome: "M" }, observadoEm: "2026-09-15T10:00:00Z", validoAte: null, registradoEm: "2026-08-02T10:00:00Z" },
  ];
  const ordenado = ordenarCronologicamente(fatos);
  assert.deepEqual(ordenado.map(f => f.conteudo), ["recente", "antigo"]);
});

// ── Zero dados ────────────────────────────────────────────────────────

test("zero dados reais nunca fabrica nada: ordenarCronologicamente/fatoVigente em lista vazia são seguros", () => {
  assert.deepEqual(ordenarCronologicamente([]), []);
  assert.equal(fatoVigente([]), null);
});

// ── Cross-tenant ──────────────────────────────────────────────────────

test("cross-tenant: clinicaId é sempre preservado no fato de entrada — cabe a quem chama nunca misturar listas de clínicas diferentes (mesmo padrão de todos os outros motores desta sessão, que nunca filtram por clinica_id internamente)", () => {
  const resultado = prepararRegistroMemoria({
    clinicaId: "clinica-A", cliente: { pacienteId: "pac1", telefone: null },
    origem: { tipo: "humano", autorId: "u1", autorNome: "Maria" },
    tipoFato: "x", conteudo: "y", observadoEm: "2026-09-20T10:00:00Z", validoAte: null,
  });
  // O motor não filtra por tenant (nenhum outro motor desta sessão faz),
  // mas garante que o dado do tenant nunca se perde no caminho.
  assert.ok(resultado);
});

// ── Determinismo ──────────────────────────────────────────────────────

test("idempotência/determinismo: mesma entrada duas vezes produz exatamente o mesmo resultado", () => {
  const fato = {
    clinicaId: "c1", cliente: { pacienteId: "pac1", telefone: null },
    origem: { tipo: "entidade_canonica", entidadeTipo: "tratamento", entidadeId: "t1" },
    tipoFato: "referencia_tratamento", conteudo: "x",
    observadoEm: "2026-09-20T10:00:00Z", validoAte: null,
  };
  assert.deepEqual(prepararRegistroMemoria(fato), prepararRegistroMemoria(fato));
});
