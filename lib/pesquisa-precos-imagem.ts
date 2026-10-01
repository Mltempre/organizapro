// ── Pesquisa de Preços — imagem REAL do produto pesquisado ─────────────────
//
// A imagem vem da PRÓPRIA página da loja onde o preço foi encontrado (a URL
// de cada referência), nunca do modelo nem de busca extra: o servidor lê a
// página e usa só a imagem que a loja declara PARA O PRODUTO —
//   1. dados estruturados Product.image (JSON-LD, padrão das lojas);
//   2. senão og:image, e só quando a página se declara produto (og:type).
// Página de categoria/busca, logo da loja ou qualquer dúvida → sem imagem.
// Nada é gerado, baixado para nosso servidor nem armazenado: a tela exibe a
// URL da loja; se a imagem falhar (hotlink/expirada), mostra placeholder.
//
// Segurança da leitura (a URL veio da busca): só http(s) em domínio público,
// sem IP literal; o DNS é validado contra redes privadas DENTRO da própria
// conexão (sem segunda resolução — imune a DNS rebinding), em cada
// redirecionamento; só HTML, até 1,5 MB, tempo curto. Qualquer falha → null.

import type { LookupFunction } from "node:net";
import type { ReferenciaPreco } from "./pesquisa-precos-web";

export const LIMITE_HTML_BYTES = 1_500_000;
export const TEMPO_PAGINA_MS = 4_000;
const MAX_REDIRECIONAMENTOS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; OrganizaProPrecos/1.0; +https://www.organizaprooficial.com.br)";

export type ResolverDns = (host: string) => Promise<string[]>;

// ── Endereços que nunca podem ser lidos (rede interna) ─────────────────────
export function ipPrivado(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    const [a, b] = v.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("ff");
}

export function urlPublicaPermitida(bruta: string): URL | null {
  let u: URL;
  try { u = new URL(bruta); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost" || host.endsWith(".localhost")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) return null; // IP literal: lojas usam domínio
  return u;
}

// ── Extração da imagem declarada para o produto ────────────────────────────
function imagemDe(valor: unknown): string | null {
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) { for (const v of valor) { const i = imagemDe(v); if (i) return i; } return null; }
  if (valor && typeof valor === "object") {
    const o = valor as Record<string, unknown>;
    return imagemDe(o.url ?? o.contentUrl ?? null);
  }
  return null;
}

function ehProduto(tipo: unknown): boolean {
  const tipos = Array.isArray(tipo) ? tipo : [tipo];
  return tipos.some(t => typeof t === "string" && /(^|[/#:])product$/i.test(t.trim()));
}

function produtosNoJsonLd(no: unknown, achados: Record<string, unknown>[] = [], profundidade = 0): Record<string, unknown>[] {
  if (profundidade > 6 || !no || typeof no !== "object") return achados;
  if (Array.isArray(no)) { for (const n of no) produtosNoJsonLd(n, achados, profundidade + 1); return achados; }
  const o = no as Record<string, unknown>;
  if (ehProduto(o["@type"])) achados.push(o);
  for (const chave of ["@graph", "mainEntity", "itemOffered", "about"]) if (o[chave]) produtosNoJsonLd(o[chave], achados, profundidade + 1);
  return achados;
}

function atributos(tag: string): Record<string, string> {
  const r: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) r[m[1].toLowerCase()] = (m[3] ?? m[4] ?? "").trim();
  return r;
}

function decodificarEntidades(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/").replace(/&quot;/g, '"');
}

/** Normaliza a URL da imagem: absoluta, https, sem data:/javascript:. */
export function urlImagemValida(bruta: string | null, base: string): string | null {
  if (!bruta) return null;
  try {
    const u = new URL(decodificarEntidades(bruta.trim()), base);
    if (u.protocol === "http:") u.protocol = "https:"; // a tela é https: nunca conteúdo misto
    if (u.protocol !== "https:" || u.href.length > 2000) return null;
    if (/\.svg($|\?)/i.test(u.pathname)) return null; // logos/ícones, não foto de produto
    return u.href;
  } catch { return null; }
}

/** Imagem que a página declara para o produto; null se não houver sinal confiável. */
export function extrairImagemDoProduto(html: string, urlPagina: string): string | null {
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let dados: unknown;
    try { dados = JSON.parse(m[1].trim()); } catch { continue; }
    for (const p of produtosNoJsonLd(dados)) {
      const img = urlImagemValida(imagemDe(p.image), urlPagina);
      if (img) return img;
    }
  }
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => atributos(m[0]));
  const valor = (nome: string) => metas.find(a => (a.property ?? a.name)?.toLowerCase() === nome)?.content ?? null;
  const ogType = valor("og:type");
  if (ogType && /product/i.test(ogType)) return urlImagemValida(valor("og:image:secure_url") ?? valor("og:image"), urlPagina);
  return null;
}

// ── Leitura segura de UMA página ───────────────────────────────────────────
// Anti-SSRF sem janela de troca (TOCTOU / DNS rebinding): o DNS é resolvido
// UMA vez, dentro da própria conexão (opção `lookup` de node:http/https), e o
// socket conecta exatamente no IP que acabou de ser validado. Não existe uma
// segunda resolução depois da validação. O TLS continua verificando o
// certificado contra o nome do domínio.

export type RespostaPagina = { status: number; location: string | null; contentType: string; ler: () => Promise<string>; descartar: () => void };
export type Requisitar = (url: URL, signal: AbortSignal) => Promise<RespostaPagina>;

/** `lookup` para a conexão: resolve, recusa se QUALQUER IP for interno, e entrega só os IPs validados. */
export function lookupProtegido(resolverDns: ResolverDns, ipPermitido: (ip: string) => boolean = (ip) => !ipPrivado(ip)): LookupFunction {
  return (host, opcoes, callback) => {
    resolverDns(host).then((ips) => {
      if (!ips.length || !ips.every(ipPermitido)) {
        const erro: NodeJS.ErrnoException = new Error("Destino de rede não permitido");
        erro.code = "EDESTINO_BLOQUEADO";
        return callback(erro, "", 0);
      }
      const enderecos = ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
      if (opcoes?.all) return callback(null, enderecos);
      return callback(null, enderecos[0].address, enderecos[0].family);
    }, (erro: NodeJS.ErrnoException) => callback(erro, "", 0));
  };
}

/** Requisição real (node:http/https) com o lookup protegido; corpo limitado a LIMITE_HTML_BYTES. */
// `ipPermitido` existe só para teste com servidor local; a produção nunca o
// passa e usa sempre o padrão (bloqueia qualquer rede interna).
export async function criarRequisitarProtegido(resolverDns: ResolverDns, ipPermitido?: (ip: string) => boolean): Promise<Requisitar> {
  const http = await import("node:http");
  const https = await import("node:https");
  const zlib = await import("node:zlib");
  const lookup = lookupProtegido(resolverDns, ipPermitido);
  return (url, signal) => new Promise<RespostaPagina>((resolve, reject) => {
    const modulo = url.protocol === "https:" ? https : http;
    const req = modulo.request(url, {
      method: "GET", lookup, signal, agent: false, // sem reaproveitar conexão: cada salto passa pelo lookup
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "gzip, deflate, br" },
    }, (res) => {
      const location = res.headers.location;
      resolve({
        status: res.statusCode ?? 0,
        location: typeof location === "string" ? location : null,
        contentType: String(res.headers["content-type"] ?? ""),
        descartar: () => res.destroy(),
        // Lojas costumam mandar HTML compactado: descompacta e aplica o limite
        // ao conteúdo JÁ descompactado (protege contra "bomba de compressão").
        ler: () => new Promise<string>((ok, falha) => {
          const codificacao = String(res.headers["content-encoding"] ?? "").toLowerCase().trim();
          const descompactar = codificacao === "gzip" || codificacao === "x-gzip" ? zlib.createGunzip()
            : codificacao === "deflate" ? zlib.createInflate()
            : codificacao === "br" ? zlib.createBrotliDecompress()
            : null;
          if (!descompactar && codificacao && codificacao !== "identity") { res.destroy(); return ok(""); } // codificação desconhecida
          const fluxo = descompactar ? res.pipe(descompactar) : res;
          const partes: Buffer[] = []; let total = 0; let fim = false;
          const concluir = () => { if (!fim) { fim = true; ok(Buffer.concat(partes).toString("utf8")); } };
          fluxo.on("data", (pedaco: Buffer) => {
            if (fim) return;
            const resta = LIMITE_HTML_BYTES - total;
            partes.push(pedaco.length > resta ? pedaco.subarray(0, resta) : pedaco);
            total += Math.min(pedaco.length, resta);
            if (total >= LIMITE_HTML_BYTES) { concluir(); res.destroy(); descompactar?.destroy(); }
          });
          fluxo.on("end", concluir);
          fluxo.on("error", (e: Error) => (fim ? undefined : falha(e)));
          res.on("error", (e: Error) => (fim ? undefined : falha(e)));
        }),
      });
    });
    req.on("error", reject);
    req.end();
  });
}

export async function imagemDaPagina(urlPagina: string, deps: { requisitar: Requisitar; timeoutMs?: number }): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TEMPO_PAGINA_MS);
  try {
    let atual = urlPublicaPermitida(urlPagina);
    for (let salto = 0; atual && salto <= MAX_REDIRECIONAMENTOS; salto++) {
      const res = await deps.requisitar(atual, controller.signal);
      if (res.status >= 300 && res.status < 400) {
        res.descartar();
        atual = res.location ? urlPublicaPermitida(new URL(res.location, atual).href) : null;
        continue;
      }
      if (res.status < 200 || res.status >= 300 || !/text\/html|application\/xhtml/i.test(res.contentType)) { res.descartar(); return null; }
      const html = await res.ler();
      return html ? extrairImagemDoProduto(html, atual.href) : null;
    }
    return null;
  } catch {
    return null;
  } finally { clearTimeout(timer); }
}

/** Referências que podem receber imagem: só PRODUTO e comparáveis (alta/média). */
export function referenciaElegivelParaImagem(r: Pick<ReferenciaPreco, "tipo" | "comparabilidade">): boolean {
  return r.tipo === "produto" && r.comparabilidade !== "baixa";
}

/** Imagem por URL de referência (páginas em paralelo, cada uma com tempo curto). */
export async function imagensDasReferencias(
  refs: Pick<ReferenciaPreco, "url" | "tipo" | "comparabilidade">[],
  deps: { requisitar?: Requisitar; resolverDns?: ResolverDns; timeoutMs?: number } = {},
): Promise<Map<string, string>> {
  const urls = [...new Set(refs.filter(referenciaElegivelParaImagem).map(r => r.url))].slice(0, 8);
  const resultado = new Map<string, string>();
  if (!urls.length) return resultado;
  let requisitar = deps.requisitar;
  if (!requisitar) {
    try {
      let resolverDns = deps.resolverDns;
      if (!resolverDns) {
        const dns = await import("node:dns/promises");
        resolverDns = async (host) => (await dns.lookup(host, { all: true })).map(a => a.address);
      }
      requisitar = await criarRequisitarProtegido(resolverDns);
    } catch { return resultado; } // sem rede/DNS verificável, não lê nada
  }
  const imagens = await Promise.all(urls.map(u => imagemDaPagina(u, { requisitar: requisitar!, timeoutMs: deps.timeoutMs })));
  urls.forEach((u, i) => { if (imagens[i]) resultado.set(u, imagens[i]!); });
  return resultado;
}
