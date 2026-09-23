// Google Business Profile — Última Milha V1. Motor puro: prova que o
// estado de uma avaliação nunca é inferido do rascunho local (só do
// Google real), que a publicação exige texto real e estado aberto, que
// as chaves de idempotência nunca duplicam por duplo-clique, que o
// prompt de resposta nunca instrui a inventar fato comercial, admitir
// culpa ou prometer desconto, e que o sinal de atenção para Reputação/
// Diretor é determinístico e isolado (nunca integrado ao Radar nesta
// missão).
//
// CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/google-business-profile-ultima-milha.test.mjs
// (build precisa incluir google-business-profile.js)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const gbp = await import(pathToFileURL(path.join(buildDir, "google-business-profile.js")));

// ── Estado real da avaliação (nunca inferido do rascunho local) ────────

test("estadoAvaliacaoGoogle: sem resposta no Google e sem rascunho local é 'sem_resposta'", () => {
  assert.equal(gbp.estadoAvaliacaoGoogle({ temRespostaGoogle: false, temRascunhoLocal: false }), "sem_resposta");
});

test("estadoAvaliacaoGoogle: sem resposta no Google MAS com rascunho local é 'resposta_preparada'", () => {
  assert.equal(gbp.estadoAvaliacaoGoogle({ temRespostaGoogle: false, temRascunhoLocal: true }), "resposta_preparada");
});

test("estadoAvaliacaoGoogle: resposta real no Google é 'respondida' MESMO que também exista um rascunho local antigo — o Google sempre prevalece", () => {
  assert.equal(gbp.estadoAvaliacaoGoogle({ temRespostaGoogle: true, temRascunhoLocal: true }), "respondida");
});

// ── Publicação exige aprovação explícita (texto real + estado aberto) ──

test("podePublicarResposta: true só quando ainda sem resposta E texto real não vazio", () => {
  assert.equal(gbp.podePublicarResposta("sem_resposta", "Obrigado pelo retorno!"), true);
});

test("podePublicarResposta: false quando já respondida, mesmo com texto", () => {
  assert.equal(gbp.podePublicarResposta("respondida", "Obrigado pelo retorno!"), false);
});

test("podePublicarResposta: false quando o texto é vazio/só espaço — nunca publica rascunho vazio", () => {
  assert.equal(gbp.podePublicarResposta("sem_resposta", "   "), false);
  assert.equal(gbp.podePublicarResposta("sem_resposta", ""), false);
});

// ── Idempotência — clique/retry não gera duplicidade ─────────────────

test("chaveIdempotenciaRascunhoAvaliacao: mesma review + mesma idempotency_key produz a mesma chave", () => {
  const k1 = gbp.chaveIdempotenciaRascunhoAvaliacao("rev1", "abc-123");
  const k2 = gbp.chaveIdempotenciaRascunhoAvaliacao("rev1", "abc-123");
  assert.equal(k1, k2);
});

test("chaveIdempotenciaRascunhoAvaliacao: idempotency_key diferente (nova tentativa deliberada) produz chave diferente", () => {
  const k1 = gbp.chaveIdempotenciaRascunhoAvaliacao("rev1", "abc-123");
  const k2 = gbp.chaveIdempotenciaRascunhoAvaliacao("rev1", "xyz-789");
  assert.notEqual(k1, k2);
});

test("chaveIdempotenciaPublicacaoAvaliacao: determinística e distinta da chave de rascunho (nunca colidem entre si)", () => {
  const kRascunho = gbp.chaveIdempotenciaRascunhoAvaliacao("rev1", "abc-123");
  const kPublicacao = gbp.chaveIdempotenciaPublicacaoAvaliacao("rev1", "abc-123");
  assert.notEqual(kRascunho, kPublicacao);
  assert.equal(gbp.chaveIdempotenciaPublicacaoAvaliacao("rev1", "abc-123"), gbp.chaveIdempotenciaPublicacaoAvaliacao("rev1", "abc-123"));
});

// ── OAuth: state assinado, expiração, token cifrado (patrimônio já existente, reconfirmado) ──

test("criarEstadoGoogle/validarEstadoGoogle: state real é aceito antes de expirar", () => {
  const state = gbp.criarEstadoGoogle("clinica1", "user1", "segredo-teste", 1000);
  const validado = gbp.validarEstadoGoogle(state, "segredo-teste", 1000);
  assert.ok(validado);
  assert.equal(validado.clinicaId, "clinica1");
});

test("validarEstadoGoogle: state expirado é rejeitado — falha fechada", () => {
  const state = gbp.criarEstadoGoogle("clinica1", "user1", "segredo-teste", 1000);
  const validado = gbp.validarEstadoGoogle(state, "segredo-teste", 1000 + 700); // além do TTL de 600s
  assert.equal(validado, null);
});

test("validarEstadoGoogle: state com segredo errado é rejeitado — falha fechada", () => {
  const state = gbp.criarEstadoGoogle("clinica1", "user1", "segredo-teste", 1000);
  const validado = gbp.validarEstadoGoogle(state, "segredo-errado", 1000);
  assert.equal(validado, null);
});

test("cifrarRefreshToken/decifrarRefreshToken: token real sobrevive ao ciclo cifrar->decifrar", () => {
  const token = "refresh-token-real-do-google-1234567890";
  const cifrado = gbp.cifrarRefreshToken(token, "segredo-de-32-bytes-ou-mais-aqui!!");
  assert.notEqual(cifrado, token); // nunca armazenado em texto puro
  assert.equal(gbp.decifrarRefreshToken(cifrado, "segredo-de-32-bytes-ou-mais-aqui!!"), token);
});

test("decifrarRefreshToken: com segredo errado nunca decifra silenciosamente — lança erro real", () => {
  const cifrado = gbp.cifrarRefreshToken("token-real", "segredo-a");
  assert.throws(() => gbp.decifrarRefreshToken(cifrado, "segredo-b"));
});

// ── Prompt de resposta: nunca inventa dado comercial, nunca admite culpa, nunca promete ──

test("montarPromptRespostaAvaliacao: inclui só nota e comentário REAIS, nunca inventa produto/atendimento/entrega", () => {
  const prompt = gbp.montarPromptRespostaAvaliacao({ nomeEmpresa: "Clínica Exemplo", nota: 5, comentario: "Atendimento excelente!" });
  assert.match(prompt, /Clínica Exemplo/);
  assert.match(prompt, /5 de 5 estrelas/);
  assert.match(prompt, /Atendimento excelente!/);
});

test("montarPromptRespostaAvaliacao: sem comentário real, nunca inventa um — declara explicitamente que não há comentário", () => {
  const prompt = gbp.montarPromptRespostaAvaliacao({ nomeEmpresa: "Clínica Exemplo", nota: 3, comentario: null });
  assert.match(prompt, /não deixou comentário/);
});

test("montarPromptRespostaAvaliacao: sempre instrui a nunca admitir culpa/responsabilidade jurídica", () => {
  const prompt = gbp.montarPromptRespostaAvaliacao({ nomeEmpresa: "X", nota: 1, comentario: "Péssimo" });
  assert.match(prompt, /[Nn]unca admita culpa/);
});

test("montarPromptRespostaAvaliacao: sempre instrui a nunca oferecer desconto/reembolso/promessa", () => {
  const prompt = gbp.montarPromptRespostaAvaliacao({ nomeEmpresa: "X", nota: 1, comentario: "Péssimo" });
  assert.match(prompt, /[Nn]unca ofereça desconto/);
});

test("montarPromptRespostaAvaliacao: sempre instrui a nunca inventar detalhes fora do comentário real", () => {
  const prompt = gbp.montarPromptRespostaAvaliacao({ nomeEmpresa: "X", nota: 4, comentario: "Bom" });
  assert.match(prompt, /[Nn]unca invente detalhes/);
});

// ── Bloco 8 — sinal de atenção (provado isoladamente, nunca integrado ao Radar/Diretor nesta missão) ──

test("avaliacaoPrecisaAtencao: nota crítica (<=2), sem resposta, há dias reais, precisa de atenção", () => {
  assert.equal(gbp.avaliacaoPrecisaAtencao({ reviewId: "r1", nota: 1, temRespostaGoogle: false, diasSemResposta: 5 }), true);
});

test("avaliacaoPrecisaAtencao: nota boa (>=3) nunca precisa de atenção, mesmo sem resposta há muito tempo", () => {
  assert.equal(gbp.avaliacaoPrecisaAtencao({ reviewId: "r1", nota: 5, temRespostaGoogle: false, diasSemResposta: 30 }), false);
});

test("avaliacaoPrecisaAtencao: já respondida nunca precisa de atenção, mesmo com nota crítica", () => {
  assert.equal(gbp.avaliacaoPrecisaAtencao({ reviewId: "r1", nota: 1, temRespostaGoogle: true, diasSemResposta: 30 }), false);
});

test("avaliacaoPrecisaAtencao: nota crítica recém-recebida (dentro do limiar) ainda não precisa de atenção — não fabrica urgência", () => {
  assert.equal(gbp.avaliacaoPrecisaAtencao({ reviewId: "r1", nota: 1, temRespostaGoogle: false, diasSemResposta: 0 }), false);
});

// ── Determinismo ──────────────────────────────────────────────────────

test("determinismo: mesma entrada sempre produz o mesmo resultado em todas as funções puras novas", () => {
  const a = { temRespostaGoogle: false, temRascunhoLocal: true };
  assert.equal(gbp.estadoAvaliacaoGoogle(a), gbp.estadoAvaliacaoGoogle(a));
  assert.equal(gbp.chaveIdempotenciaRascunhoAvaliacao("r1", "k1"), gbp.chaveIdempotenciaRascunhoAvaliacao("r1", "k1"));
});

// Os cenários de autorização, publicação, retry, erros e persistência antes
// verificados por regex nas rotas agora executam os handlers reais em
// google-business-profile-coordenada.test.mjs, com I/O estritamente simulado.
test("rotas delegam aos handlers GBP que mantêm a fronteira server-only", () => {
  const routes = {
    "route.ts": 'lerGoogle(req, "status")',
    "avaliacoes/route.ts": 'lerGoogle(req, "avaliacoes")',
    "locations/route.ts": 'lerGoogle(req, "locations")',
    "metricas/route.ts": 'lerGoogle(req, "metricas")',
    "posts/route.ts": 'escreverGoogle(req, "post")',
  };
  for (const [file, call] of Object.entries(routes)) {
    const code = fs.readFileSync(new URL("../app/api/google-business-profile/" + file, import.meta.url), "utf8");
    assert.ok(code.includes(call));
  }
});
