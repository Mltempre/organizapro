// Pesquisa de Preços — botão "Voltar" quando aberta pelo Catálogo e Pedidos.
// Melhoria localizada de UX: link direto para /pedidos (não usa o histórico
// do navegador), fixo no topo durante a rolagem, sem mexer na lógica da busca.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pagina = ler("app/pesquisa-precos/page.tsx");
const catalogo = ler("app/pedidos/page.tsx");

test("o link 'Pesquisar preço' do Catálogo leva servico_id — é o sinal de origem", () => {
  assert.match(catalogo, /href=\{`\/pesquisa-precos\?termo=\$\{encodeURIComponent\(c\.nome\)\}&servico_id=\$\{encodeURIComponent\(c\.id\)\}`\}/);
});

test("Voltar aparece só quando veio do Catálogo (servico_id na URL)", () => {
  assert.match(pagina, /setVeioDoCatalogo\(!!servicoId\)/);
  assert.match(pagina, /\{veioDoCatalogo && \(/);
});

test("Voltar é link direto para /pedidos, sem depender do histórico do navegador", () => {
  assert.match(pagina, /<Link href="\/pedidos" className="pp-voltar" data-testid="voltar-catalogo" aria-label="Voltar para Catálogo e Pedidos">/);
  assert.match(pagina, /<span aria-hidden="true">←<\/span> Voltar/);
  assert.doesNotMatch(pagina, /router\.back\(|history\.back\(|history\.go\(/);
});

test("visual: fixo no topo, dourado, hover discreto, foco visível e responsivo", () => {
  assert.match(pagina, /\.pp-voltar\{position:fixed;top:23px;right:32px;z-index:45/);
  assert.match(pagina, /color:#e3c05c/);
  assert.match(pagina, /\.pp-voltar:hover\{/);
  assert.match(pagina, /\.pp-voltar:focus-visible\{/);
  assert.match(pagina, /@media\(max-width:767px\)\{\.pp-voltar\{top:15px;right:16px/);
});

test("lógica da busca, APIs e parâmetros de entrada seguem iguais", () => {
  for (const trecho of [
    'const termo = q.get("termo")?.slice(0, 160) ?? "";',
    'const servicoId = q.get("servico_id") ?? "";',
    "if (termo || servicoId) setBusca((b) => ({ ...b, termo, servicoId, tipo }));",
    '"/api/pesquisa-precos/busca-web"',
  ]) assert.ok(pagina.includes(trecho), trecho);
});
