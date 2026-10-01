// Pesquisa de Preços V2 — imagem real do produto, vinda da própria página da
// loja de cada referência. Nunca inventada, nunca de página sem produto,
// nunca de rede interna; falha → sem imagem e a busca segue intacta.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import zlib from "node:zlib";
import {
  extrairImagemDoProduto, urlImagemValida, urlPublicaPermitida, ipPrivado, imagemDaPagina, imagensDasReferencias, referenciaElegivelParaImagem,
  lookupProtegido, criarRequisitarProtegido, LIMITE_HTML_BYTES,
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

// Resposta falsa de loja no formato de `Requisitar`.
const pagina = (html, contentType = "text/html; charset=utf-8", status = 200, location = null) =>
  ({ status, location, contentType, ler: async () => html, descartar: () => {} });

test("leitura da página: imagem do produto; não-HTML, erro e redirecionamento interno → sem imagem", async () => {
  const html = ld({ "@type": "Product", image: "https://cdn.loja.com.br/ar.jpg" });
  const req = fn => ({ requisitar: async (url, signal) => fn(url.href, signal) });
  assert.equal(await imagemDaPagina(PAG, req(() => pagina(html))), "https://cdn.loja.com.br/ar.jpg");
  assert.equal(await imagemDaPagina(PAG, req(() => pagina(html, "image/jpeg"))), null);
  assert.equal(await imagemDaPagina(PAG, req(() => pagina("", "text/html", 403))), null, "loja que bloqueia robô → sem imagem");
  assert.equal(await imagemDaPagina(PAG, req(() => { throw new Error("rede"); })), null);
  let foiInterno = false;
  const redir = u => { if (u.includes("127.0.0.1")) foiInterno = true; return u === PAG ? pagina("", "text/html", 302, "http://127.0.0.1/admin") : pagina(html); };
  assert.equal(await imagemDaPagina(PAG, req(redir)), null, "redirecionamento para rede interna é recusado");
  assert.equal(foiInterno, false, "nem chega a requisitar o destino interno");
  const redirOk = u => u === PAG ? pagina("", "text/html", 301, "/produto/ar-12000") : pagina(html);
  assert.equal(await imagemDaPagina(PAG, req(redirOk)), "https://cdn.loja.com.br/ar.jpg", "redirecionamento público é seguido");
  const lento = (_u, signal) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort"))));
  assert.equal(await imagemDaPagina(PAG, { ...req(lento), timeoutMs: 30 }), null, "página lenta não segura a busca");
});

// ── Anti-SSRF sem TOCTOU: a conexão REAL usa o DNS validado (node:http) ────
async function servidorLocal() {
  let acessos = 0;
  const srv = http.createServer((_req, res) => { acessos++; res.writeHead(200, { "content-type": "text/html" }); res.end(ld({ "@type": "Product", image: "https://cdn.x.com.br/a.jpg" })); });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  return { porta: srv.address().port, acessos: () => acessos, fechar: () => new Promise(r => srv.close(r)) };
}

test("lookup protegido: recusa IP interno e entrega à conexão só os IPs validados", async () => {
  const chamar = (resolver, opcoes) => new Promise(ok => lookupProtegido(resolver)("loja.com.br", opcoes, (erro, endereco, familia) => ok({ erro, endereco, familia })));
  const bloqueado = await chamar(async () => ["200.147.67.142", "10.0.0.9"], { all: true });
  assert.equal(bloqueado.erro?.code, "EDESTINO_BLOQUEADO", "basta UM IP interno para recusar");
  const publico = await chamar(async () => ["200.147.67.142", "2804:14c::1"], { all: true });
  assert.equal(publico.erro, null);
  assert.deepEqual(publico.endereco, [{ address: "200.147.67.142", family: 4 }, { address: "2804:14c::1", family: 6 }]);
  const simples = await chamar(async () => ["200.147.67.142"], {});
  assert.deepEqual([simples.endereco, simples.familia], ["200.147.67.142", 4]);
});

test("conexão real: o DNS usado é o validado (não o do sistema) e IP interno é recusado antes de qualquer requisição", async () => {
  const s = await servidorLocal();
  try {
    const consultas = [];
    const requisitar = await criarRequisitarProtegido(async (host) => { consultas.push(host); return ["127.0.0.1"]; });
    const ctl = new AbortController();
    // nome que o DNS do sistema não resolve: se a conexão usasse outro DNS, o erro seria ENOTFOUND
    const erro = await requisitar(new URL(`http://loja-inexistente.organizapro-teste:${s.porta}/p`), ctl.signal).then(() => null, e => e);
    assert.equal(erro?.code, "EDESTINO_BLOQUEADO");
    assert.deepEqual(consultas, ["loja-inexistente.organizapro-teste"], "uma única resolução, a do lookup protegido");
    assert.equal(s.acessos(), 0, "o servidor interno não recebeu nenhuma requisição");
  } finally { await s.fechar(); }
});

test("conexão real: HTML compactado (gzip/br) é lido; limite vale sobre o conteúdo DESCOMPACTADO (bomba de compressão)", async () => {
  const html = ld({ "@type": "Product", image: "https://cdn.x.com.br/gz.jpg" });
  const bomba = zlib.gzipSync(Buffer.alloc(20_000_000, 0x20)); // ~20 KB compactados → 20 MB
  const srv = http.createServer((req, res) => {
    if (req.url === "/gzip") { res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" }); return res.end(zlib.gzipSync(html)); }
    if (req.url === "/br") { res.writeHead(200, { "content-type": "text/html", "content-encoding": "br" }); return res.end(zlib.brotliCompressSync(html)); }
    if (req.url === "/bomba") { res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" }); return res.end(bomba); }
    res.writeHead(200, { "content-type": "text/html", "content-encoding": "compress-desconhecido" }); res.end("xx");
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  try {
    const porta = srv.address().port;
    // só ESTE teste libera 127.0.0.1 (servidor local); a produção nunca passa ipPermitido
    const requisitar = await criarRequisitarProtegido(async () => ["127.0.0.1"], ip => ip === "127.0.0.1");
    const ler = async (p) => (await requisitar(new URL(`http://loja.organizapro-teste:${porta}${p}`), new AbortController().signal)).ler();
    assert.equal(extrairImagemDoProduto(await ler("/gzip"), "https://loja.com.br/x"), "https://cdn.x.com.br/gz.jpg");
    assert.equal(extrairImagemDoProduto(await ler("/br"), "https://loja.com.br/x"), "https://cdn.x.com.br/gz.jpg");
    const grande = await ler("/bomba");
    assert.ok(grande.length <= LIMITE_HTML_BYTES, `descompactado limitado a ${LIMITE_HTML_BYTES} (veio ${grande.length})`);
    assert.equal(await ler("/desconhecida"), "", "codificação desconhecida não é interpretada");
  } finally { await new Promise(r => srv.close(r)); }
});

test("DNS rebinding: 1ª resposta pública, 2ª interna — só existe UMA resolução e a conexão nunca vai ao IP interno", async () => {
  const s = await servidorLocal();
  try {
    let consultas = 0;
    // atacante: primeiro responde IP público (TEST-NET, não roteável), depois 127.0.0.1
    const requisitar = await criarRequisitarProtegido(async () => (++consultas === 1 ? ["203.0.113.10"] : ["127.0.0.1"]));
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 400);
    await requisitar(new URL(`http://rebind.organizapro-teste:${s.porta}/p`), ctl.signal).then(() => null, e => e);
    assert.equal(consultas, 1, "não há segunda resolução para o atacante trocar o destino");
    assert.equal(s.acessos(), 0, "nenhuma requisição chegou ao endereço interno");
    // e pelo fluxo completo da imagem (com o mesmo resolvedor malicioso), resultado: sem imagem
    let n = 0;
    const mapa = await imagensDasReferencias([{ url: `https://rebind.organizapro-teste/p`, tipo: "produto", comparabilidade: "alta" }],
      { resolverDns: async () => (++n === 1 ? ["203.0.113.10"] : ["127.0.0.1"]), timeoutMs: 400 });
    assert.equal(mapa.size, 0);
    assert.equal(n, 1);
    assert.equal(s.acessos(), 0);
  } finally { await s.fechar(); }
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
  const mapa = await imagensDasReferencias(refs, { requisitar: async (u) => { buscadas.push(u.href); return pagina(u.href.includes("p1") ? ld({ "@type": "Product", image: "https://cdn.a.com.br/1.jpg" }) : "<html></html>"); } });
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
  const modulo = ler("lib/pesquisa-precos-imagem.ts");
  assert.doesNotMatch(modulo, /openai|api\.openai\.com/i, "nenhuma chamada extra ao provedor de IA");
  assert.match(modulo, /requisitar = await criarRequisitarProtegido\(resolverDns\);/, "produção nunca libera IP (sem ipPermitido)");
  assert.doesNotMatch(modulo, /\bfetch\(/, "a leitura da página não usa fetch (que resolveria o DNS de novo)");
});
