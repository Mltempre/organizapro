// Pesquisa de Preços V2 — imagem real do produto, vinda da própria página da
// loja de cada referência. Nunca inventada, nunca de página sem produto,
// nunca de rede interna; falha → sem imagem e a busca segue intacta.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  extrairImagemDoProduto, urlImagemValida, urlPublicaPermitida, ipPrivado, imagemDaPagina, imagensDasReferencias, referenciaElegivelParaImagem,
} from "../lib/pesquisa-precos-imagem.ts";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const PAG = "https://www.loja.com.br/ar-condicionado-samsung-windfree-12000";
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

test("JSON-LD Product.image (string, lista, ImageObject, @graph, @type em lista)", () => {
  assert.equal(extrairImagemDoProduto(ld({ "@type": "Product", name: "Ar", image: "https://cdn.loja.com.br/ar.jpg" }), PAG), "https://cdn.loja.com.br/ar.jpg");
  assert.equal(extrairImagemDoProduto(ld({ "@type": "Product", image: ["https://cdn.loja.com.br/1.webp", "https://cdn.loja.com.br/2.webp"] }), PAG), "https://cdn.loja.com.br/1.webp");
  assert.equal(extrairImagemDoProduto(ld({ "@type": "Product", image: { "@type": "ImageObject", url: "/img/ar.png" } }), PAG), "https://www.loja.com.br/img/ar.png");
  assert.equal(extrairImagemDoProduto(ld({ "@context": "https://schema.org", "@graph": [{ "@type": "WebPage" }, { "@type": ["Product", "Thing"], image: "https://cdn.x.com/p.jpg" }] }), PAG), "https://cdn.x.com/p.jpg");
});

test("og:image só vale quando a página se declara produto", () => {
  const og = (tipo, img) => `<meta property="og:type" content="${tipo}"><meta content="${img}" property="og:image">`;
  assert.equal(extrairImagemDoProduto(og("product", "https://cdn.loja.com.br/og.jpg"), PAG), "https://cdn.loja.com.br/og.jpg");
  assert.equal(extrairImagemDoProduto(og("og:product", "https://cdn.loja.com.br/og.jpg"), PAG), "https://cdn.loja.com.br/og.jpg");
  assert.equal(extrairImagemDoProduto(og("website", "https://cdn.loja.com.br/logo.jpg"), PAG), null, "página genérica (logo/categoria) não vira imagem do produto");
  assert.equal(extrairImagemDoProduto(`<meta property="og:image" content="https://cdn.loja.com.br/logo.jpg">`, PAG), null);
});

test("sem sinal confiável → nenhuma imagem (nunca inventa)", () => {
  assert.equal(extrairImagemDoProduto("<html><img src='https://cdn.loja.com.br/qualquer.jpg'></html>", PAG), null, "imagem solta na página não conta");
  assert.equal(extrairImagemDoProduto(ld({ "@type": "Organization", logo: "https://cdn.loja.com.br/logo.png", image: "https://cdn.loja.com.br/x.jpg" }), PAG), null);
  assert.equal(extrairImagemDoProduto(ld({ "@type": "Product" }), PAG), null);
  assert.equal(extrairImagemDoProduto('<script type="application/ld+json">{quebrado</script>', PAG), null);
});

test("URL da imagem: absoluta, https, sem data:/javascript:/svg", () => {
  assert.equal(urlImagemValida("http://cdn.loja.com.br/a.jpg", PAG), "https://cdn.loja.com.br/a.jpg", "http vira https (sem conteúdo misto)");
  assert.equal(urlImagemValida("data:image/png;base64,AAAA", PAG), null);
  assert.equal(urlImagemValida("javascript:alert(1)", PAG), null);
  assert.equal(urlImagemValida("https://cdn.loja.com.br/logo.svg", PAG), null);
  assert.equal(urlImagemValida("https://cdn.loja.com.br/a.jpg?w=400&amp;h=400", PAG), "https://cdn.loja.com.br/a.jpg?w=400&h=400");
});

test("segurança: nunca lê rede interna, IP literal, credenciais ou porta estranha", () => {
  for (const ruim of ["http://localhost/x", "http://127.0.0.1/x", "http://10.0.0.5/x", "http://[::1]/x", "http://intranet/x", "http://srv.local/x",
    "ftp://loja.com.br/x", "https://user:pass@loja.com.br/x", "https://loja.com.br:8080/x", "file:///etc/passwd"]) {
    assert.equal(urlPublicaPermitida(ruim), null, ruim);
  }
  assert.ok(urlPublicaPermitida(PAG));
  for (const ip of ["10.1.2.3", "172.16.0.1", "192.168.1.1", "127.0.0.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) assert.equal(ipPrivado(ip), true, ip);
  for (const ip of ["8.8.8.8", "200.147.67.142", "2804:14c::1"]) assert.equal(ipPrivado(ip), false, ip);
});

// fetch falso de loja: responde HTML com cabeçalhos, como um servidor real.
const pagina = (html, extra = {}) => ({ ok: true, status: 200, headers: new Headers({ "content-type": "text/html; charset=utf-8", ...extra }), text: async () => html, body: null });
const dnsPublico = async () => ["200.147.67.142"];

test("leitura da página: imagem do produto; DNS privado, não-HTML, erro e redirecionamento interno → sem imagem", async () => {
  const html = ld({ "@type": "Product", image: "https://cdn.loja.com.br/ar.jpg" });
  assert.equal(await imagemDaPagina(PAG, { fetchImpl: async () => pagina(html), resolverDns: dnsPublico }), "https://cdn.loja.com.br/ar.jpg");
  let chamou = false;
  assert.equal(await imagemDaPagina(PAG, { fetchImpl: async () => { chamou = true; return pagina(html); }, resolverDns: async () => ["10.0.0.9"] }), null);
  assert.equal(chamou, false, "DNS apontando para rede interna: nem chega a buscar");
  assert.equal(await imagemDaPagina(PAG, { fetchImpl: async () => ({ ...pagina(html), headers: new Headers({ "content-type": "image/jpeg" }) }), resolverDns: dnsPublico }), null);
  assert.equal(await imagemDaPagina(PAG, { fetchImpl: async () => ({ ok: false, status: 403, headers: new Headers({ "content-type": "text/html" }) }), resolverDns: dnsPublico }), null, "loja que bloqueia robô → sem imagem");
  assert.equal(await imagemDaPagina(PAG, { fetchImpl: async () => { throw new Error("rede"); }, resolverDns: dnsPublico }), null);
  const redir = async (u) => u === PAG ? { ok: false, status: 302, headers: new Headers({ location: "http://127.0.0.1/admin" }) } : pagina(html);
  assert.equal(await imagemDaPagina(PAG, { fetchImpl: redir, resolverDns: dnsPublico }), null, "redirecionamento para rede interna é recusado");
  const redirOk = async (u) => u === PAG ? { ok: false, status: 301, headers: new Headers({ location: "/produto/ar-12000" }) } : pagina(html);
  assert.equal(await imagemDaPagina(PAG, { fetchImpl: redirOk, resolverDns: dnsPublico }), "https://cdn.loja.com.br/ar.jpg", "redirecionamento público é seguido");
  const lento = async (_u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("abort"))));
  assert.equal(await imagemDaPagina(PAG, { fetchImpl: lento, resolverDns: dnsPublico, timeoutMs: 30 }), null, "página lenta não segura a busca");
});

test("só PRODUTO e comparáveis recebem imagem; serviço/mão de obra e 'baixa' não", async () => {
  assert.equal(referenciaElegivelParaImagem({ tipo: "produto", comparabilidade: "alta" }), true);
  assert.equal(referenciaElegivelParaImagem({ tipo: "produto", comparabilidade: "media" }), true);
  assert.equal(referenciaElegivelParaImagem({ tipo: "produto", comparabilidade: "baixa" }), false);
  assert.equal(referenciaElegivelParaImagem({ tipo: "servico", comparabilidade: "alta" }), false);
  const buscadas = [];
  const refs = [
    { url: "https://a.com.br/p1", tipo: "produto", comparabilidade: "alta" },
    { url: "https://b.com.br/p2", tipo: "produto", comparabilidade: "baixa" },
    { url: "https://c.com.br/p3", tipo: "produto", comparabilidade: "media" },
  ];
  const mapa = await imagensDasReferencias(refs, { resolverDns: dnsPublico, fetchImpl: async (u) => { buscadas.push(u); return pagina(u.includes("p1") ? ld({ "@type": "Product", image: "https://cdn.a.com.br/1.jpg" }) : "<html></html>"); } });
  assert.deepEqual([...mapa.entries()], [["https://a.com.br/p1", "https://cdn.a.com.br/1.jpg"]]);
  assert.deepEqual(buscadas.sort(), ["https://a.com.br/p1", "https://c.com.br/p3"], "'baixa' nem é buscada");
});

test("rota e tela: imagem só em produto, busca e números intactos; img externa com fallback", () => {
  const rota = ler("app/api/pesquisa-precos/busca-web/route.ts");
  assert.match(rota, /const imagens = tipo === "produto" \? await imagensDasReferencias\(busca\.extracao\.referencias\) : new Map<string, string>\(\);/);
  assert.match(rota, /referencias: busca\.extracao\.referencias\.map\(r => \(\{ \.\.\.r, imagemUrl: imagens\.get\(r\.url\) \?\? null \}\)\)/);
  assert.match(rota, /const resumo = resumirReferencias\(busca\.extracao\.referencias,/, "resumo/mediana calculados como antes");
  const tela = ler("app/pesquisa-precos/page.tsx");
  assert.match(tela, /resultado\.consulta\.tipo === "produto" && \(r\.imagemUrl && !imagensFalhas\.has\(r\.imagemUrl\)/);
  assert.match(tela, /referrerPolicy="no-referrer"/);
  assert.match(tela, /onError=\{\(\) => setImagensFalhas\(/);
  assert.match(tela, /objectFit: "contain"/);
  assert.match(tela, /data-testid="sem-imagem-referencia"/);
  assert.doesNotMatch(ler("lib/pesquisa-precos-imagem.ts"), /openai|api\.openai\.com/i, "nenhuma chamada extra ao provedor de IA");
});
