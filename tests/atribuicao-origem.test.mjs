// ── Testes reais (node:test) · lib/atribuicao-origem.ts ─────────────────────
// Roda contra o JS REAL compilado — ver README-TESTES no mesmo diretório.
// Cobre captura/classificação de origem e CAC/ROAS null-safe, puro, sem
// nenhuma chamada a Google Ads/Meta Ads (nenhuma API existe nesta fase).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BUILD = process.env.SMART_COMMERCE_BUILD_DIR;
if (!BUILD) {
  throw new Error(
    "Defina SMART_COMMERCE_BUILD_DIR apontando para o diretorio com o build " +
    "commonjs de lib/atribuicao-origem.ts (ver README-TESTES.md)."
  );
}

const {
  capturarOrigem, classificarOrigem,
  construirLinkComRastreio, extrairCodigoRastreio,
  calcularCAC, calcularROAS,
  gerarCodigoOrigem, podeVincularOrigem,
} = require(`${BUILD}/atribuicao-origem.js`);

const AGORA = "2026-09-18T12:00:00.000Z";

// ── capturarOrigem ────────────────────────────────────────────────────────

test("capturarOrigem: campos ausentes viram null, nunca string vazia/inventada", () => {
  const o = capturarOrigem(new URLSearchParams(), null, AGORA);
  assert.equal(o.utmSource, null);
  assert.equal(o.utmMedium, null);
  assert.equal(o.gclid, null);
  assert.equal(o.fbclid, null);
  assert.equal(o.referrerHost, null);
  assert.equal(o.capturadoEm, AGORA);
});

test("capturarOrigem: le utm_* e gclid de URLSearchParams", () => {
  const params = new URLSearchParams("utm_source=google&utm_medium=cpc&utm_campaign=verao&gclid=abc123");
  const o = capturarOrigem(params, null, AGORA);
  assert.equal(o.utmSource, "google");
  assert.equal(o.utmMedium, "cpc");
  assert.equal(o.utmCampaign, "verao");
  assert.equal(o.gclid, "abc123");
});

test("capturarOrigem: aceita objeto simples (Next.js searchParams) alem de URLSearchParams", () => {
  const o = capturarOrigem({ utm_source: "instagram", fbclid: "xyz" }, null, AGORA);
  assert.equal(o.utmSource, "instagram");
  assert.equal(o.fbclid, "xyz");
});

test("capturarOrigem: string vazia/so espacos normaliza para null", () => {
  const o = capturarOrigem(new URLSearchParams("utm_source=   "), null, AGORA);
  assert.equal(o.utmSource, null);
});

test("capturarOrigem: extrai host do referrer quando e uma URL valida", () => {
  const o = capturarOrigem(new URLSearchParams(), "https://www.google.com/search?q=barbearia", AGORA);
  assert.equal(o.referrerHost, "www.google.com");
});

test("capturarOrigem: referrer invalido vira null, nunca lanca excecao", () => {
  const o = capturarOrigem(new URLSearchParams(), "nao e uma url", AGORA);
  assert.equal(o.referrerHost, null);
});

// ── classificarOrigem ────────────────────────────────────────────────────

test("classificarOrigem: gclid com origem Meta conflitante permanece incerto", () => {
  const o = { utmSource: "instagram", utmMedium: null, utmCampaign: null, utmContent: null, gclid: "abc", fbclid: null, referrerHost: null, capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "campanha_utm");
});

test("classificarOrigem: fbclid isolado não prova mídia paga Meta", () => {
  const o = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, gclid: null, fbclid: "xyz", referrerHost: null, capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "referencia");
});

test("classificarOrigem: apenas utm (sem click id) classifica campanha_utm", () => {
  const o = { utmSource: "newsletter", utmMedium: "email", utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: null, capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "campanha_utm");
});

test("classificarOrigem: referrer de busca conhecida sem utm/click id classifica busca_organica", () => {
  const o = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: "www.google.com", capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "busca_organica");
});

test("classificarOrigem: referrer de terceiro (nao-busca) classifica referencia", () => {
  const o = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: "outroblog.com.br", capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "referencia");
});

test("classificarOrigem: nada capturado classifica direto (origem desconhecida/direta, nunca adivinhada)", () => {
  const o = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: null, capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "direto");
});

// ── Nenhuma atribuição falsa de Google/Meta ─────────────────────────────
// Requisito explícito do Capitão: jamais classificar google_ads/meta_ads
// sem o click id correspondente, mesmo com UTM ou referrer parecidos.

test("classificarOrigem: UTM google/cpc é marcação explícita de campanha paga, não verificação da plataforma", () => {
  const o = { utmSource: "google", utmMedium: "cpc", utmCampaign: "promo", utmContent: null, gclid: null, fbclid: null, referrerHost: null, capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "google_ads");
});

test("classificarOrigem: utm_source='facebook' SEM fbclid NUNCA vira meta_ads — só campanha_utm", () => {
  const o = { utmSource: "facebook", utmMedium: "social", utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: null, capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "campanha_utm");
  assert.notEqual(classificarOrigem(o), "meta_ads");
});

test("classificarOrigem: referrer de busca do Google SEM gclid NUNCA vira google_ads — só busca_organica", () => {
  const o = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: "google.com.br", capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "busca_organica");
  assert.notEqual(classificarOrigem(o), "google_ads");
});

test("classificarOrigem: nenhuma combinação sem gclid/fbclid produz google_ads/meta_ads (varredura de casos)", () => {
  const casosSemClickId = [
    { utmSource: "google", utmMedium: "organic", utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: null, capturadoEm: AGORA },
    { utmSource: null, utmMedium: null, utmCampaign: "meta_ads_manual", utmContent: null, gclid: null, fbclid: null, referrerHost: null, capturadoEm: AGORA },
    { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: "m.facebook.com", capturadoEm: AGORA },
  ];
  for (const c of casosSemClickId) {
    const resultado = classificarOrigem(c);
    assert.notEqual(resultado, "google_ads");
    assert.notEqual(resultado, "meta_ads");
  }
});

// ── construirLinkComRastreio / extrairCodigoRastreio ────────────────────

test("construirLinkComRastreio: adiciona ref:codigo ao texto pre-preenchido existente", () => {
  const link = construirLinkComRastreio("https://wa.me/5511999999999?text=Ola", "ab12cd34");
  const url = new URL(link);
  assert.match(url.searchParams.get("text"), /^Ola\n\nref:ab12cd34$/);
});

test("construirLinkComRastreio: cria texto minimo quando o link base nao tem 'text'", () => {
  const link = construirLinkComRastreio("https://wa.me/5511999999999", "ab12cd34");
  const url = new URL(link);
  assert.equal(url.searchParams.get("text"), "ref:ab12cd34");
});

test("construirLinkComRastreio: nunca altera o numero/destino do link", () => {
  const link = construirLinkComRastreio("https://wa.me/5511999999999?text=Oi", "codigo1");
  assert.match(link, /^https:\/\/wa\.me\/5511999999999\?/);
});

test("extrairCodigoRastreio: encontra o codigo no formato ref:<codigo>", () => {
  assert.equal(extrairCodigoRastreio("Ola! ref:ab12cd34"), "ab12cd34");
});

test("extrairCodigoRastreio: null quando nao ha referencia no texto (nunca adivinha)", () => {
  assert.equal(extrairCodigoRastreio("Ola, gostaria de agendar um horario"), null);
});

test("extrairCodigoRastreio: null para texto ausente/vazio", () => {
  assert.equal(extrairCodigoRastreio(null), null);
  assert.equal(extrairCodigoRastreio(undefined), null);
  assert.equal(extrairCodigoRastreio(""), null);
});

test("extrairCodigoRastreio: ref invalido (curto demais, fora do formato) nunca e aceito", () => {
  assert.equal(extrairCodigoRastreio("ref:ab"), null); // menor que 6 caracteres
  assert.equal(extrairCodigoRastreio("referencia:ab12cd34"), null); // prefixo errado
  assert.equal(extrairCodigoRastreio("meu ref e ab12cd34"), null); // sem os dois pontos
});

test("extrairCodigoRastreio: WhatsApp sem nenhum ref continua funcionando normalmente (retorna null, nunca lanca)", () => {
  const mensagensReais = [
    "Oi, qual o horario de funcionamento?",
    "👍",
    "Gostaria de agendar um horario para amanha",
  ];
  for (const m of mensagensReais) {
    assert.equal(extrairCodigoRastreio(m), null);
  }
});

// ── gerarCodigoOrigem ────────────────────────────────────────────────────

test("gerarCodigoOrigem: gera codigo de 10 caracteres, sem 0/1/i/l/o (sem ambiguidade visual)", () => {
  const codigo = gerarCodigoOrigem();
  assert.equal(codigo.length, 10);
  assert.doesNotMatch(codigo, /[01ilo]/);
});

test("gerarCodigoOrigem: aceita gerador de aleatoriedade injetado (determinístico em teste)", () => {
  const semprePrimeiro = () => 0;
  const codigo = gerarCodigoOrigem(semprePrimeiro);
  assert.equal(codigo, "2222222222");
});

// ── podeVincularOrigem — idempotência / replay ──────────────────────────

test("podeVincularOrigem: true quando ainda nao foi vinculado", () => {
  assert.equal(podeVincularOrigem({ vinculadoEm: null }), true);
});

test("podeVincularOrigem: false quando ja foi vinculado — replay do webhook nunca revincula", () => {
  assert.equal(podeVincularOrigem({ vinculadoEm: "2026-09-19T10:00:00.000Z" }), false);
});

// ── calcularCAC / calcularROAS ───────────────────────────────────────────

test("calcularCAC: null quando custo e null (nunca inventa custo)", () => {
  assert.equal(calcularCAC(null, 5), null);
});

test("calcularCAC: null quando nao ha nenhuma conversao (nunca divide por zero)", () => {
  assert.equal(calcularCAC(10000, 0), null);
});

test("calcularCAC: calcula custo por conversao corretamente", () => {
  assert.equal(calcularCAC(10000, 5), 2000);
});

test("calcularROAS: null quando custo e null/zero (nunca inventa)", () => {
  assert.equal(calcularROAS(null, 50000), null);
  assert.equal(calcularROAS(0, 50000), null);
});

test("calcularROAS: 0 e um resultado valido quando a receita atribuida e zero (fato, nao ausencia)", () => {
  assert.equal(calcularROAS(10000, 0), 0);
});

test("calcularROAS: calcula a razao receita/custo corretamente", () => {
  assert.equal(calcularROAS(10000, 42000), 4.2);
});
