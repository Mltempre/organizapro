// ── Testes reais (node:test) · lib/motor-reputacao.ts ───────────────────────
// Roda contra o JS REAL compilado (não uma reimplementação) — ver
// README-TESTES no mesmo diretório. Cobre o motor de reputação (rastreio
// honesto de clique) ANTES de qualquer migration existir — puro, sem banco.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BUILD = process.env.SMART_COMMERCE_BUILD_DIR;
if (!BUILD) {
  throw new Error(
    "Defina SMART_COMMERCE_BUILD_DIR apontando para o diretorio com o build " +
    "commonjs de lib/motor-reputacao.ts (ver README-TESTES.md)."
  );
}

const {
  estadoDaSolicitacao, podeRegistrarClique, gerarCodigoRastreio,
  validarLinkDestino, janelaAntiSpamExpirada, taxaDeCliquePct,
  classificarEvidenciaRespondeu, rotuloRespondeu,
} = require(`${BUILD}/motor-reputacao.js`);

// ── estadoDaSolicitacao / podeRegistrarClique ───────────────────────────

test("estadoDaSolicitacao: 'enviado' quando clicadoEm e null", () => {
  assert.equal(estadoDaSolicitacao({ clicadoEm: null }), "enviado");
});

test("estadoDaSolicitacao: 'clicado' quando clicadoEm esta preenchido", () => {
  assert.equal(estadoDaSolicitacao({ clicadoEm: "2026-09-18T10:00:00.000Z" }), "clicado");
});

test("estadoDaSolicitacao: nunca retorna 'avaliou'/'respondeu' (nao e um valor possivel do tipo)", () => {
  const possiveis = new Set(["enviado", "clicado"]);
  assert.ok(possiveis.has(estadoDaSolicitacao({ clicadoEm: null })));
  assert.ok(possiveis.has(estadoDaSolicitacao({ clicadoEm: "2026-09-18T10:00:00.000Z" })));
});

test("podeRegistrarClique: true quando ainda nao houve clique", () => {
  assert.equal(podeRegistrarClique({ clicadoEm: null }), true);
});

test("podeRegistrarClique: false quando ja houve clique (idempotente, nao sobrescreve)", () => {
  assert.equal(podeRegistrarClique({ clicadoEm: "2026-09-18T10:00:00.000Z" }), false);
});

// ── gerarCodigoRastreio ─────────────────────────────────────────────────

test("gerarCodigoRastreio: gera codigo de 10 caracteres, alfabeto sem 0/1/i/l/o", () => {
  const codigo = gerarCodigoRastreio();
  assert.equal(codigo.length, 10);
  assert.doesNotMatch(codigo, /[01ilo]/);
});

test("gerarCodigoRastreio: determinístico quando o gerador aleatorio e injetado (testabilidade)", () => {
  const sempreZero = () => 0;
  const codigo = gerarCodigoRastreio(sempreZero);
  assert.equal(codigo, "2222222222"); // primeiro caractere do alfabeto, repetido
});

// ── validarLinkDestino ───────────────────────────────────────────────────

test("validarLinkDestino: aceita http/https", () => {
  assert.equal(validarLinkDestino("https://g.page/r/exemplo/review"), true);
  assert.equal(validarLinkDestino("http://exemplo.com"), true);
});

test("validarLinkDestino: rejeita null/undefined/vazio", () => {
  assert.equal(validarLinkDestino(null), false);
  assert.equal(validarLinkDestino(undefined), false);
  assert.equal(validarLinkDestino(""), false);
});

test("validarLinkDestino: rejeita esquemas perigosos (nunca vira open-redirect)", () => {
  assert.equal(validarLinkDestino("javascript:alert(1)"), false);
  assert.equal(validarLinkDestino("data:text/html,<script>alert(1)</script>"), false);
});

test("validarLinkDestino: rejeita string que nao e uma URL valida", () => {
  assert.equal(validarLinkDestino("nao e uma url"), false);
});

// ── janelaAntiSpamExpirada ───────────────────────────────────────────────

const HOJE = "2026-09-18";

test("janelaAntiSpamExpirada: true quando nunca foi solicitado antes", () => {
  assert.equal(janelaAntiSpamExpirada(null, HOJE), true);
});

test("janelaAntiSpamExpirada: false dentro da janela padrao de 7 dias", () => {
  assert.equal(janelaAntiSpamExpirada("2026-09-15", HOJE), false); // 3 dias
});

test("janelaAntiSpamExpirada: true exatamente na borda da janela", () => {
  assert.equal(janelaAntiSpamExpirada("2026-09-11", HOJE), true); // 7 dias
});

test("janelaAntiSpamExpirada: respeita janela customizada", () => {
  assert.equal(janelaAntiSpamExpirada("2026-09-16", HOJE, 1), true);   // 2 dias >= 1
  assert.equal(janelaAntiSpamExpirada("2026-09-18", HOJE, 1), false);  // 0 dias < 1
});

// ── taxaDeCliquePct ───────────────────────────────────────────────────────

test("taxaDeCliquePct: 0 quando a lista esta vazia (nunca NaN/Infinity)", () => {
  assert.equal(taxaDeCliquePct([]), 0);
});

test("taxaDeCliquePct: calcula percentual correto de cliques", () => {
  const solicitacoes = [
    { clicadoEm: "2026-09-18T10:00:00.000Z" },
    { clicadoEm: null },
    { clicadoEm: "2026-09-18T11:00:00.000Z" },
    { clicadoEm: null },
  ];
  assert.equal(taxaDeCliquePct(solicitacoes), 50);
});

test("taxaDeCliquePct: 100 quando todas clicaram, 0 quando nenhuma clicou", () => {
  assert.equal(taxaDeCliquePct([{ clicadoEm: "x" }, { clicadoEm: "y" }]), 100);
  assert.equal(taxaDeCliquePct([{ clicadoEm: null }, { clicadoEm: null }]), 0);
});

// ── classificarEvidenciaRespondeu / rotuloRespondeu (Fase A — verdade dos dados) ──
// Contra o falso positivo real encontrado em produção: app/reputacao/page.tsx
// mostrava "✅ Respondeu" para uma coluna que nenhum caminho real do
// produto jamais escreve como true (só cron insere `false`; só seed de
// demo escreve `true`). Estes testes travam para sempre a proibição de
// qualquer rótulo que alegue um evento não verificado.

test("classificarEvidenciaRespondeu: false vira 'sem_evidencia'", () => {
  assert.equal(classificarEvidenciaRespondeu(false), "sem_evidencia");
});

test("classificarEvidenciaRespondeu: true vira 'marcado_sem_verificacao', NUNCA 'confirmado'/'respondeu'", () => {
  const resultado = classificarEvidenciaRespondeu(true);
  assert.equal(resultado, "marcado_sem_verificacao");
  assert.notEqual(resultado, "confirmado");
  assert.notEqual(resultado, "respondeu");
});

test("rotuloRespondeu: nunca contém a palavra 'Respondeu' sozinha como afirmação de fato, em nenhum dos dois estados", () => {
  const rotuloTrue  = rotuloRespondeu(true);
  const rotuloFalse = rotuloRespondeu(false);
  // A proibição é específica: nenhum rótulo pode ser exatamente uma alegação
  // de fato verificado como "Respondeu" ou "Cliente respondeu".
  assert.notEqual(rotuloTrue, "Respondeu");
  assert.notEqual(rotuloTrue, "✅ Respondeu");
  assert.notEqual(rotuloFalse, "Respondeu");
  assert.ok(rotuloTrue.length > 0);
  assert.ok(rotuloFalse.length > 0);
  assert.notEqual(rotuloTrue, rotuloFalse);
});

test("rotuloRespondeu: é determinístico e puro (mesma entrada, mesma saída, sem efeito colateral)", () => {
  assert.equal(rotuloRespondeu(true), rotuloRespondeu(true));
  assert.equal(rotuloRespondeu(false), rotuloRespondeu(false));
});
