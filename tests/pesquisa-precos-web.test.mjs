// Pesquisa de Preços — busca REAL na web (2026-09-28). Prova, sem rede nem
// banco reais: validação anti-fabricação das referências, resumo honesto
// (faixa/mediana só com base suficiente; serviço exige cidade), falhas do
// provedor e a rota (sessão, isolamento entre negócios, cota, sem escrita).
//
// node --test tests/pesquisa-precos-web.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fixture, request, tenant } from "./helpers/p1-fixture.mjs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const plain = x => JSON.parse(JSON.stringify(x));
const lib = () => fixture().load("lib/pesquisa-precos-web.ts");

// Resposta no formato real da API Responses (web_search_call + message).
function respostaResponses({ consultadas = [], refs = [], texto } = {}) {
  return {
    output: [
      { type: "web_search_call", action: { sources: consultadas.map(url => ({ type: "url", url })) } },
      { type: "message", content: [{ type: "output_text", text: texto ?? JSON.stringify({ referencias: refs }), annotations: [] }] },
    ],
  };
}
const ref = (o) => ({ titulo: "Pneu 90/90-18 X", preco_reais: 200, url: "https://loja-a.com.br/pneu-x", tipo: "produto", localidade: null, comparabilidade: "alta", diferenca: null, ...o });

test("anti-fabricação: só entra referência de site realmente consultado; preço/URL/título inválidos e duplicadas são descartados", () => {
  const { extrairReferencias } = lib();
  const r = plain(extrairReferencias(respostaResponses({
    consultadas: ["https://www.loja-a.com.br/pneu-x", "https://loja-b.com.br/lista"],
    refs: [
      ref({}),                                                           // página consultada
      ref({ url: "https://loja-b.com.br/produto-que-nao-estava-na-lista", preco_reais: 210 }), // mesmo site, página não listada
      ref({ url: "https://site-inventado.com/pneu", preco_reais: 150 }), // site nunca consultado
      ref({ preco_reais: 0.5 }), ref({ preco_reais: "200" }),             // preço inválido
      ref({ url: "nao-e-url" }), ref({ titulo: "  " }),
      ref({}),                                                           // duplicada
    ],
  }), { tipo: "produto" }));
  assert.deepEqual(r.referencias.map(x => [x.fonte, x.precoCentavos, x.confirmacao]), [
    ["loja-a.com.br", 20000, "pagina_consultada"],
    ["loja-b.com.br", 21000, "site_consultado"],
  ]);
  const desc = Object.fromEntries(r.descartadas.map(d => [d.motivo, d.quantidade]));
  assert.deepEqual(desc, { site_nao_consultado: 1, preco_invalido: 2, url_invalida: 1, titulo_ausente: 1, duplicada: 1 });
  assert.equal(r.fontesConsultadas, 2);
  assert.equal(r.respostaInterpretavel, true);
});

test("resposta sem JSON ou sem busca: nenhuma referência é inventada", () => {
  const { extrairReferencias } = lib();
  const semJson = plain(extrairReferencias(respostaResponses({ consultadas: ["https://a.com/x"], texto: "Não encontrei preços." }), { tipo: "produto" }));
  assert.equal(semJson.referencias.length, 0);
  assert.equal(semJson.respostaInterpretavel, false);
  const semBusca = plain(extrairReferencias({ output: [{ type: "message", content: [{ text: JSON.stringify({ referencias: [ref({})] }) }] }] }, { tipo: "produto" }));
  assert.equal(semBusca.referencias.length, 0, "sem páginas consultadas, nada é aceito");
});

const R = (fonte, centavos, o = {}) => ({ titulo: "x", precoCentavos: centavos, url: `https://${fonte}/p${centavos}`, fonte, tipo: "produto", localidade: null, comparabilidade: "alta", diferenca: null, confirmacao: "pagina_consultada", mesmaLocalidade: null, ...o });

test("produto: faixa e mediana só com ≥3 referências de ≥2 fontes; 'baixa' fica fora; posição do seu preço sem recomendar", () => {
  const { resumirReferencias } = lib();
  const refs = [R("a.com", 17999), R("a.com", 22990), R("b.com", 20990), R("c.com", 23999), R("d.com", 99900, { comparabilidade: "baixa" })];
  const s = plain(resumirReferencias(refs, { tipo: "produto", seuPrecoCentavos: 15000 }));
  assert.deepEqual([s.consideradas, s.fontesDistintas, s.minimoCentavos, s.maximoCentavos, s.medianaCentavos, s.confiavel, s.posicaoSeuPreco],
    [4, 3, 17999, 23999, 21990, true, "abaixo"]);
  assert.equal(plain(resumirReferencias(refs, { tipo: "produto", seuPrecoCentavos: 21000 })).posicaoSeuPreco, "dentro");
  assert.equal(plain(resumirReferencias(refs, { tipo: "produto", seuPrecoCentavos: 30000 })).posicaoSeuPreco, "acima");
  const poucas = plain(resumirReferencias([R("a.com", 10000), R("a.com", 12000)], { tipo: "produto", seuPrecoCentavos: 11000 }));
  assert.equal(poucas.confiavel, false);
  assert.equal(poucas.posicaoSeuPreco, null, "sem base suficiente não posiciona o preço");
  assert.match(poucas.motivo, /use apenas como indício/);
});

test("serviço/mão de obra: sem cidade não conclui; com cidade só conta preço da mesma cidade", () => {
  const { resumirReferencias, mesmaLocalidade } = lib();
  const semCidade = plain(resumirReferencias([R("a.com", 3000)], { tipo: "servico", localidade: "" }));
  assert.equal(semCidade.medianaCentavos, null);
  assert.match(semCidade.motivo, /informe a cidade/);
  assert.equal(mesmaLocalidade("Londrina/PR", "Londrina, PR"), true);
  assert.equal(mesmaLocalidade("Curitiba/PR", "Londrina, PR"), false);
  assert.equal(mesmaLocalidade(null, "Londrina, PR"), false);
  const mo = { tipo: "servico", composicao: "mao_de_obra" }; // só preço de mão de obra entra na faixa
  const refs = [R("a.com", 2500, { ...mo, mesmaLocalidade: true }), R("b.com", 2000, { ...mo, mesmaLocalidade: true }),
    R("c.com", 3000, { ...mo, mesmaLocalidade: true }), R("d.com", 20000, { ...mo, mesmaLocalidade: false })];
  const s = plain(resumirReferencias(refs, { tipo: "servico", localidade: "Londrina, PR" }));
  assert.deepEqual([s.consideradas, s.minimoCentavos, s.maximoCentavos, s.medianaCentavos, s.confiavel], [3, 2000, 3000, 2500, true]);
});

test("provedor: sem chave não chama; erro HTTP → 502; timeout → 504; chamada usa web_search real com páginas consultadas", async () => {
  const { executarBuscaWeb, MODELO_BUSCA_WEB } = lib();
  let chamadas = 0;
  const semChave = plain(await executarBuscaWeb({ apiKey: undefined, termo: "Pneu", tipo: "produto", fetchImpl: async () => { chamadas++; } }));
  assert.equal(semChave.status, 503); assert.equal(chamadas, 0);
  assert.equal(plain(await executarBuscaWeb({ apiKey: "k", termo: "Pneu", tipo: "produto", fetchImpl: async () => ({ ok: false, status: 500 }) })).status, 502);
  const lento = await executarBuscaWeb({ apiKey: "k", termo: "Pneu", tipo: "produto", timeoutMs: 20,
    fetchImpl: (_u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("abort")))) });
  assert.equal(lento.status, 504);
  let enviado = null;
  const ok = await executarBuscaWeb({ apiKey: "SEGREDO_TESTE", termo: "Troca de pneu", tipo: "servico", localidade: "Londrina, PR",
    fetchImpl: async (url, init) => { enviado = { url, body: JSON.parse(init.body), auth: init.headers.Authorization }; return { ok: true, json: async () => respostaResponses({}) }; } });
  assert.equal(ok.ok, true);
  assert.equal(enviado.url, "https://api.openai.com/v1/responses");
  assert.equal(enviado.body.model, MODELO_BUSCA_WEB);
  assert.equal(enviado.body.tools[0].type, "web_search");
  assert.equal(enviado.body.tools[0].user_location.city, "Londrina, PR");
  assert.deepEqual(enviado.body.include, ["web_search_call.action.sources"]);
  assert.match(enviado.body.input, /SERVIÇO \/ MÃO DE OBRA: "Troca de pneu" em Londrina, PR/);
  assert.match(enviado.body.input, /Nunca invente preço, loja ou link/);
  assert.ok(!JSON.stringify(plain(ok)).includes("SEGREDO_TESTE"), "chave nunca volta no resultado");
});

// ── Rota: sessão, isolamento entre negócios, cota e nenhuma escrita ─────────
const OUTRO = "99999999-9999-4999-8999-999999999999";
function rota(o = {}) {
  const f = fixture({
    httpBody: respostaResponses({ consultadas: ["https://loja-a.com.br/pneu-x", "https://loja-b.com.br/pneu-y", "https://loja-c.com.br/pneu-z"],
      refs: [ref({}), ref({ url: "https://loja-b.com.br/pneu-y", preco_reais: 230 }), ref({ url: "https://loja-c.com.br/pneu-z", preco_reais: 180 })] }),
    ...o.fixture,
    responder: (q, get) => {
      if (q.table === "clinica_servicos" && q.action === "select") {
        const meu = get("id") === "item-meu" && get("clinica_id") === tenant;
        return { data: meu ? { id: "item-meu", nome: "Pneu 90/90-18", preco_centavos: 19900 } : null, error: null };
      }
      return undefined;
    },
  });
  return { f, POST: body => f.load("app/api/pesquisa-precos/busca-web/route.ts").POST(request(body, o.token ?? "session")) };
}
const escritasFora = f => f.queries.filter(q => ["insert", "update", "upsert", "delete"].includes(q.action) && q.table !== "eventos_dominio");

test("rota: sem sessão 401, sem chamar o provedor", async () => {
  const { f, POST } = rota({ token: "invalida" });
  assert.equal((await POST({ termo: "Pneu 90/90-18", tipo: "produto" })).status, 401);
  assert.equal(f.calls.length, 0);
});

test("rota: sucesso devolve referências validadas + resumo com 'seu preço' do catálogo do PRÓPRIO negócio; não grava nada", async () => {
  const { f, POST } = rota();
  const r = await POST({ termo: "Pneu 90/90-18", tipo: "produto", servico_id: "item-meu", clinica_id: OUTRO });
  assert.equal(r.status, 200);
  const b = plain(r.body);
  assert.equal(b.referencias.length, 3);
  assert.deepEqual([b.resumo.consideradas, b.resumo.minimoCentavos, b.resumo.maximoCentavos, b.resumo.medianaCentavos, b.resumo.seuPrecoCentavos, b.resumo.posicaoSeuPreco],
    [3, 18000, 23000, 20000, 19900, "dentro"]);
  assert.equal(b.provedor.nome, "OpenAI (busca na web)");
  assert.ok(f.queries.some(q => q.table === "clinica_servicos" && q.filters.some(([k, v]) => k === "clinica_id" && v === tenant)), "catálogo lido filtrado pelo negócio da sessão");
  assert.ok(!f.queries.some(q => q.filters.some(([, v]) => v === OUTRO)), "clinica_id do body ignorado");
  assert.equal(escritasFora(f).length, 0, "só a cota (eventos_dominio) é gravada");
  assert.equal(f.calls.filter(c => c.url === "https://api.openai.com/v1/responses").length, 1);
});

test("rota: item do catálogo de outro negócio → 400, sem chamar o provedor", async () => {
  const { f, POST } = rota();
  const r = await POST({ termo: "Pneu", tipo: "produto", servico_id: "item-de-outro-negocio" });
  assert.equal(r.status, 400);
  assert.equal(f.calls.length, 0);
});

test("rota: validações e cota — entrada inválida 400; cota indisponível 429; sem chave 503; nada chama o provedor", async () => {
  for (const body of [{ termo: "x", tipo: "produto" }, { termo: "Pneu", tipo: "outro" }, { termo: "Pneu", tipo: "servico", localidade: "x".repeat(81) }]) {
    const { f, POST } = rota();
    assert.equal((await POST(body)).status, 400, JSON.stringify(body));
    assert.equal(f.calls.length, 0);
  }
  const semCota = rota({ fixture: { insertError: true } });
  assert.equal((await semCota.POST({ termo: "Pneu", tipo: "produto" })).status, 429);
  assert.equal(semCota.f.calls.length, 0);
  const semChave = rota({ fixture: { env: { OPENAI_API_KEY: "" } } });
  assert.equal((await semChave.POST({ termo: "Pneu", tipo: "produto" })).status, 503);
});

test("tela: busca integrada à Pesquisa de Preços existente; honesta sobre IA; registrar usa as rotas existentes; nunca altera preço de venda", () => {
  const p = ler("app/pesquisa-precos/page.tsx");
  assert.equal((p.match(/<AdminShell title="Pesquisa de Preços"/g) || []).length, 2);
  assert.match(p, /Busca real na internet feita por IA \(OpenAI, com as páginas consultadas\)/);
  assert.match(p, /fetch\("\/api\/pesquisa-precos\/busca-web"/);
  for (const r of ["/api/pesquisa-precos/itens", "/api/pesquisa-precos/fontes", "/api/pesquisa-precos/observacoes"]) assert.ok(p.includes(`enviar("${r}"`), r);
  assert.match(p, /evidencia_referencia: ref\.url/);
  assert.match(p, /Seu preço/); assert.match(p, /Faixa observada/); assert.match(p, /Mediana observada/); assert.match(p, /Referências consideradas/);
  assert.match(p, /não uma recomendação automática/);
  assert.doesNotMatch(p, /clinica_servicos|api\/pedidos|api\/orcamentos|preco_centavos.*update/);
  assert.match(p, /new URLSearchParams\(window\.location\.search\)/, "recebe o item vindo do Catálogo");
  const cat = ler("app/pedidos/page.tsx");
  assert.match(cat, /href=\{`\/pesquisa-precos\?termo=\$\{encodeURIComponent\(c\.nome\)\}&servico_id=\$\{encodeURIComponent\(c\.id\)\}`\}[^>]*>Pesquisar preço<\/a>/);
  const api = ler("app/api/pesquisa-precos/busca-web/route.ts");
  assert.doesNotMatch(api, /body\.clinica_id|searchParams\.get\("clinica_id"\)/);
  assert.doesNotMatch(api, /\.(insert|update|upsert|delete)\(/, "rota de busca não grava");
});
