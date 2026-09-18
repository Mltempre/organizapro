// ── Testes reais (node:test) · lib/presenca-digital.ts ──────────────────────
// Roda contra o JS REAL compilado — ver README-TESTES no mesmo diretório.
// Garante que o diagnóstico nunca alega integração Google que não existe.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BUILD = process.env.SMART_COMMERCE_BUILD_DIR;
if (!BUILD) {
  throw new Error(
    "Defina SMART_COMMERCE_BUILD_DIR apontando para o diretorio com o build " +
    "commonjs de lib/presenca-digital.ts (ver README-TESTES.md)."
  );
}

const { calcularPresencaDigital } = require(`${BUILD}/presenca-digital.js`);

const CONFIG_VAZIA = {
  slug: null, linkGoogle: null, notaGoogle: null, numAvaliacoes: null,
  telefone: null, endereco: null, horarioFuncionamento: null,
  seoTitulo: null, seoDescricao: null,
};

const CONFIG_COMPLETA = {
  slug: "barbearia-central", linkGoogle: "https://g.page/r/exemplo/review",
  notaGoogle: 4.8, numAvaliacoes: 120, telefone: "11999999999",
  endereco: "Rua Exemplo, 123", horarioFuncionamento: "Seg-Sex 9h-18h",
  seoTitulo: "Barbearia Central", seoDescricao: "A melhor barbearia da região",
};

test("calcularPresencaDigital: integracaoGoogleAtiva e sempre false (nunca alega API que nao existe)", () => {
  assert.equal(calcularPresencaDigital(CONFIG_VAZIA).integracaoGoogleAtiva, false);
  assert.equal(calcularPresencaDigital(CONFIG_COMPLETA).integracaoGoogleAtiva, false);
});

test("calcularPresencaDigital: observacaoIntegracao explica que nota/avaliacoes sao manuais", () => {
  const diag = calcularPresencaDigital(CONFIG_VAZIA);
  assert.match(diag.observacaoIntegracao, /manualmente/i);
  assert.match(diag.observacaoIntegracao, /Google Business Profile/i);
});

test("calcularPresencaDigital: pontuacao 0 quando nenhum campo esta preenchido", () => {
  assert.equal(calcularPresencaDigital(CONFIG_VAZIA).pontuacao, 0);
});

test("calcularPresencaDigital: pontuacao 100 quando todos os campos estao preenchidos", () => {
  assert.equal(calcularPresencaDigital(CONFIG_COMPLETA).pontuacao, 100);
});

test("calcularPresencaDigital: pontuacao parcial reflete exatamente os itens preenchidos", () => {
  const config = { ...CONFIG_VAZIA, slug: "exemplo", linkGoogle: "https://g.page/r/x" };
  const diag = calcularPresencaDigital(config);
  // 2 de 8 itens completos = 25%
  assert.equal(diag.pontuacao, 25);
  const completos = diag.itens.filter(i => i.completo).map(i => i.chave);
  assert.deepEqual(completos.sort(), ["link_avaliacao", "site_publicado"]);
});

test("calcularPresencaDigital: nota_google conta como completo mesmo quando o valor e 0 (fato, nao ausencia)", () => {
  const config = { ...CONFIG_VAZIA, notaGoogle: 0 };
  const diag = calcularPresencaDigital(config);
  const item = diag.itens.find(i => i.chave === "nota_google");
  assert.equal(item.completo, true);
});

test("calcularPresencaDigital: item 'seo' so completa quando titulo E descricao estao preenchidos", () => {
  const soTitulo = calcularPresencaDigital({ ...CONFIG_VAZIA, seoTitulo: "X" });
  assert.equal(soTitulo.itens.find(i => i.chave === "seo").completo, false);

  const ambos = calcularPresencaDigital({ ...CONFIG_VAZIA, seoTitulo: "X", seoDescricao: "Y" });
  assert.equal(ambos.itens.find(i => i.chave === "seo").completo, true);
});

test("calcularPresencaDigital: sempre retorna os mesmos 8 itens, na mesma ordem", () => {
  const diag = calcularPresencaDigital(CONFIG_VAZIA);
  assert.deepEqual(diag.itens.map(i => i.chave), [
    "site_publicado", "link_avaliacao", "nota_google", "num_avaliacoes",
    "telefone", "endereco", "horario", "seo",
  ]);
});
