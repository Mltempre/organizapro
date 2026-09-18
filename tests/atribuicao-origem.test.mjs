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

test("classificarOrigem: gclid presente sempre classifica google_ads, mesmo com outros dados", () => {
  const o = { utmSource: "instagram", utmMedium: null, utmCampaign: null, utmContent: null, gclid: "abc", fbclid: null, referrerHost: null, capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "google_ads");
});

test("classificarOrigem: fbclid presente (sem gclid) classifica meta_ads", () => {
  const o = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, gclid: null, fbclid: "xyz", referrerHost: null, capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "meta_ads");
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

test("classificarOrigem: nada capturado classifica direto", () => {
  const o = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: null, capturadoEm: AGORA };
  assert.equal(classificarOrigem(o), "direto");
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
