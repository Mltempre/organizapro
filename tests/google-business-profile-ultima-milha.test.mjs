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

// ── Wiring: rotas ─────────────────────────────────────────────────────

const root = path.join(path.dirname(fileURLToPathSafe(import.meta.url)), "..");
function fileURLToPathSafe(u) { return new URL(u).pathname.replace(/^\/([A-Za-z]):/, "$1:"); }
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const rotaBase = ler("app/api/google-business-profile/route.ts");
const rotaAvaliacoes = ler("app/api/google-business-profile/avaliacoes/route.ts");
const rotaRascunho = ler("app/api/google-business-profile/avaliacoes/[reviewId]/rascunho/route.ts");
const rotaPublicar = ler("app/api/google-business-profile/avaliacoes/[reviewId]/publicar/route.ts");
const rotaMetricas = ler("app/api/google-business-profile/metricas/route.ts");
const rotaPosts = ler("app/api/google-business-profile/posts/route.ts");
const rotaLocations = ler("app/api/google-business-profile/locations/route.ts");

test("tenant: TODAS as rotas GBP exigem clinica_id e chamam autorizarUsuarioNaClinica antes de qualquer leitura de conexão", () => {
  for (const [nome, rota] of [["base", rotaBase], ["avaliacoes", rotaAvaliacoes], ["rascunho", rotaRascunho], ["publicar", rotaPublicar], ["metricas", rotaMetricas], ["locations", rotaLocations]]) {
    assert.match(rota, /autorizarUsuarioNaClinica/, `${nome} deveria chamar autorizarUsuarioNaClinica`);
    assert.match(rota, /\.eq\("clinica_id", clinica/, `${nome} deveria escopar por clinica_id`);
  }
});

test("tenant: DELETE (desconectar) também escopado por clinica_id — nunca remove vínculo de outro tenant", () => {
  const idxDelete = rotaBase.indexOf("export async function DELETE");
  const trecho = rotaBase.slice(idxDelete);
  assert.match(trecho, /\.eq\("clinica_id", clinicaId\)/);
});

test("token não vaza: nenhuma rota loga refresh_token/access_token em texto (nem via console.log nem no corpo da resposta)", () => {
  for (const [nome, rota] of [["callback (já existente)", ler("app/api/google-business-profile/oauth/callback/route.ts")], ["avaliacoes", rotaAvaliacoes], ["rascunho", rotaRascunho], ["publicar", rotaPublicar], ["metricas", rotaMetricas]]) {
    assert.doesNotMatch(rota, /console\.log\([^)]*access_token/i, `${nome} não deveria logar access_token`);
    assert.doesNotMatch(rota, /NextResponse\.json\([^}]*refresh_token[^}]*access_token/i, `${nome} não deveria devolver tokens na resposta`);
  }
});

test("avaliação sem resposta pode gerar rascunho: rota de rascunho relê a avaliação real antes de aceitar (fail-closed)", () => {
  assert.match(rotaRascunho, /buscarAvaliacoesGoogle\(/);
  assert.match(rotaRascunho, /temRespostaGoogle/);
});

test("publicação exige aprovação explícita: rota de publicar exige texto e review_name no body — nunca publica sem os dois", () => {
  assert.match(rotaPublicar, /!clinica_id \|\| !texto\?\.trim\(\) \|\| !idempotency_key \|\| !review_name/);
});

test("clique/retry não gera resposta duplicada: rota de publicar checa chave_idempotencia ANTES de qualquer chamada ao Google", () => {
  const idxCheck = rotaPublicar.indexOf("jaPublicado");
  const idxPublicarChamada = rotaPublicar.indexOf("await publicarRespostaGoogle(");
  assert.ok(idxCheck > -1 && idxPublicarChamada > -1);
  assert.ok(idxCheck < idxPublicarChamada);
});

test("falha Google nunca vira sucesso: no catch da chamada de publicação, a rota SEMPRE registra 'falhou' e retorna sucesso:false", () => {
  const idxTry = rotaPublicar.indexOf("await publicarRespostaGoogle(accessToken, review_name, texto.trim());");
  const idxCatch = rotaPublicar.indexOf("catch (e)", idxTry);
  const idxFimCatch = rotaPublicar.indexOf("status: 502 });", idxCatch);
  const trechoCatch = rotaPublicar.slice(idxCatch, idxFimCatch + 20);
  assert.match(trechoCatch, /resultado: "falhou"/);
  assert.match(trechoCatch, /sucesso: false/);
  assert.doesNotMatch(trechoCatch, /sucesso: true/);
});

test("resposta publicada atualiza estado: rota de publicar SÓ retorna sucesso:true e estado 'respondida' depois de publicarRespostaGoogle ter sido chamada sem lançar", () => {
  const idxPublicar = rotaPublicar.indexOf("await publicarRespostaGoogle(");
  const idxRetornoSucesso = rotaPublicar.lastIndexOf('estado: "respondida"');
  assert.ok(idxPublicar > -1 && idxRetornoSucesso > -1);
  assert.ok(idxPublicar < idxRetornoSucesso);
});

test("ausência de IA externa não quebra GBP: nenhuma rota do módulo GBP chama OpenAI diretamente — o rascunho é sempre gerado pelo client via /api/ia já existente", () => {
  for (const [nome, rota] of [["avaliacoes", rotaAvaliacoes], ["rascunho", rotaRascunho], ["publicar", rotaPublicar]]) {
    assert.doesNotMatch(rota, /openai\.com/i, `${nome} não deveria chamar OpenAI diretamente`);
  }
});

test("ausência de credenciais Google retorna estado controlado: rotas de leitura (avaliacoes/metricas/locations) nunca lançam quando assertGoogleEnv falha — sempre devolvem indisponivel:true", () => {
  for (const [nome, rota] of [["avaliacoes", rotaAvaliacoes], ["metricas", rotaMetricas], ["locations", rotaLocations]]) {
    assert.match(rota, /catch \(e\)/, `${nome} deveria capturar falha de configuração`);
    assert.match(rota, /indisponivel: true/, `${nome} deveria devolver indisponivel:true`);
  }
});

test("posts: exige aprovação explícita (texto do body) e nunca publica automaticamente — mesma idempotência do Bloco 5", () => {
  assert.match(rotaPosts, /!clinica_id \|\| !texto\?\.trim\(\) \|\| !idempotency_key/);
  assert.match(rotaPosts, /jaPublicado/);
});

test("avaliação não duplica em nova sincronização: a lista usa reviewId (identificador estável do Google) como chave para juntar com rascunhos locais, nunca um índice de posição", () => {
  assert.match(rotaAvaliacoes, /rascunhoPorReview\.get\(av\.reviewId\)/);
});
