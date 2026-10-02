// Pesquisa de Preços — Inteligência de Mão de Obra V1.
// Fixtures de TESTE no formato real da API Responses (não são preços reais
// de mercado): provam as regras — só preço de mão de obra entra na faixa,
// mesma cidade, evidência fraca não forma faixa, posição neutra do preço.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  extrairReferencias, resumirReferencias, montarConsultaBuscaWeb, classificarComposicao, sanitizarFatores, composicaoEntraNaConta, MSG_SERVICO_EVIDENCIA_FRACA,
} from "../lib/pesquisa-precos-web.ts";
import { fixture, request } from "./helpers/p1-fixture.mjs";

const CIDADE = "Londrina, PR";
function resposta(refs, fatores = []) {
  return {
    output: [
      { type: "web_search_call", action: { sources: refs.map(r => ({ type: "url", url: r.url })) } },
      { type: "message", content: [{ type: "output_text", text: JSON.stringify({ referencias: refs, fatores }), annotations: [] }] },
    ],
  };
}
let n = 0;
const ref = (titulo, preco, o = {}) => ({
  titulo, preco_reais: preco, url: `https://fonte${o.fonte ?? ++n}.com.br/servico-${++n}`, tipo: "servico",
  localidade: "Londrina/PR", comparabilidade: "alta", diferenca: null, composicao: "mao_de_obra", ...o,
});
const analisar = (refs, o = {}) => {
  const ex = extrairReferencias(resposta(refs, o.fatores), { tipo: "servico", localidade: CIDADE });
  return { ex, resumo: resumirReferencias(ex.referencias, { tipo: "servico", localidade: CIDADE, seuPrecoCentavos: o.seu ?? null }) };
};

test("1. instalação de ar-condicionado 12000 BTUs: faixa só com mão de obra da cidade; aparelho+instalação fica fora", () => {
  const { ex, resumo } = analisar([
    ref("Instalação de ar-condicionado split 12000 BTUs", 350, { fonte: "a" }),
    ref("Instalação split 12.000 BTUs — mão de obra", 420, { fonte: "b" }),
    ref("Serviço de instalação de ar condicionado 12000", 500, { fonte: "c" }),
    ref("Instalação de split até 12000 BTUs", 450, { fonte: "a" }),
    ref("Ar condicionado Split 12000 BTUs + instalação", 2899, { fonte: "d" }),                 // modelo disse mão de obra, mas é aparelho+instalação
    ref("Instalação split 12000 BTUs", 300, { fonte: "e", localidade: "São Paulo/SP" }),          // outra cidade
  ], { fatores: ["distância entre condensadora e evaporadora", "altura/andaime", "R$ 100 por metro extra", "infraestrutura existente"] });
  const mistura = ex.referencias.find(r => r.precoCentavos === 289900);
  assert.equal(mistura.composicao, "mao_de_obra_e_material", "aparelho + instalação nunca vira preço puro de mão de obra");
  assert.deepEqual([resumo.consideradas, resumo.fontesDistintas, resumo.minimoCentavos, resumo.maximoCentavos, resumo.medianaCentavos, resumo.confiavel],
    [4, 3, 35000, 50000, 43500, true]);
  assert.deepEqual(ex.fatores, ["distância entre condensadora e evaporadora", "altura/andaime", "infraestrutura existente"], "fator com valor é descartado");
  assert.doesNotMatch(resumo.motivo, /preço correto"?\s*$/);
  assert.match(resumo.motivo, /Não é um "preço correto"/);
});

test("2. instalação/troca de box: box completo com vidro + instalação não se mistura com 'somente instalação'", () => {
  const { ex, resumo } = analisar([
    ref("Instalação de box de banheiro (somente mão de obra)", 180, { fonte: "a" }),
    ref("Mão de obra para instalação de box frontal", 220, { fonte: "b" }),
    ref("Instalador de box — instalação", 200, { fonte: "c" }),
    ref("Box de vidro temperado 8 mm 1,40 x 1,90", 890, { fonte: "d", composicao: "mao_de_obra_e_material", comparabilidade: "media", diferenca: "inclui o vidro" }),
  ]);
  assert.equal(ex.referencias.find(r => r.precoCentavos === 89000).composicao, "mao_de_obra_e_material");
  assert.deepEqual([resumo.consideradas, resumo.minimoCentavos, resumo.maximoCentavos, resumo.medianaCentavos], [3, 18000, 22000, 20000]);
});

test("3. troca de óleo de motocicleta — somente mão de obra: especificação vai à busca; óleo incluso fica fora", () => {
  const prompt = montarConsultaBuscaWeb({ termo: "Troca de óleo de motocicleta", tipo: "servico", localidade: CIDADE, especificacao: "somente mão de obra" });
  assert.match(prompt, /Especificação informada pelo profissional: "somente mão de obra"/);
  const { resumo } = analisar([
    ref("Troca de óleo moto — mão de obra", 30, { fonte: "a" }),
    ref("Serviço de troca de óleo (cliente leva o óleo)", 25, { fonte: "b" }),
    ref("Mão de obra troca de óleo motocicleta", 35, { fonte: "c" }),
    ref("Troca de óleo com óleo incluso", 70, { fonte: "d", composicao: "mao_de_obra_e_material" }),
  ]);
  assert.deepEqual([resumo.consideradas, resumo.minimoCentavos, resumo.maximoCentavos, resumo.medianaCentavos], [3, 2500, 3500, 3000]);
});

test("4. poucas referências: NÃO forma faixa; mostra a mensagem e mantém as referências individuais", () => {
  const { ex, resumo } = analisar([
    ref("Montagem de guarda-roupa 6 portas", 250, { fonte: "a" }),
    ref("Montagem de guarda-roupa", 300, { fonte: "a" }),
  ], { seu: 28000 });
  assert.equal(ex.referencias.length, 2, "referências seguem listadas para conferência");
  assert.deepEqual([resumo.minimoCentavos, resumo.maximoCentavos, resumo.medianaCentavos, resumo.confiavel, resumo.posicaoSeuPreco], [null, null, null, false, null]);
  assert.ok(resumo.motivo.startsWith(MSG_SERVICO_EVIDENCIA_FRACA));
  assert.match(resumo.motivo, /Encontrei 2 referências de 1 fonte/);
  const nenhuma = analisar([ref("Câmera + instalação", 600, { composicao: "mao_de_obra_e_material" })]).resumo;
  assert.equal(nenhuma.medianaCentavos, null);
  assert.ok(nenhuma.motivo.startsWith(MSG_SERVICO_EVIDENCIA_FRACA));
});

test("5. referência que mistura produto + instalação: classificação conservadora", () => {
  for (const t of ["Ar condicionado 12000 + instalação", "Kit câmeras com instalação", "Instalação inclusa na compra do box", "Instalação com material incluso", "Troca de kit relação com peças inclusas"]) {
    assert.equal(classificarComposicao("mao_de_obra", t, null), "mao_de_obra_e_material", t);
  }
  for (const t of ["Instalação de ar-condicionado 12000 BTUs", "Limpeza e instalação de split", "Mão de obra troca de kit relação"]) {
    assert.equal(classificarComposicao("mao_de_obra", t, null), "mao_de_obra", t);
  }
  assert.equal(classificarComposicao(undefined, "Instalação de câmera", null), "indefinida", "sem declaração não entra na faixa");
  // caso REAL da validação: anúncio de venda do box marcado pelo modelo como mão de obra
  assert.equal(classificarComposicao("mao_de_obra", "Box para Banheiro em Londrina | Melhor Preço | Vidraçaria Londrina", null), "indefinida");
  assert.equal(classificarComposicao("mao_de_obra", "Point Lub — Troca de Óleo em Londrina | Carro e Moto", null), "mao_de_obra", "título de serviço segue aceito");
  assert.equal(classificarComposicao("mao_de_obra", "Instalador de box em Londrina", null), "mao_de_obra");
  assert.equal(classificarComposicao("produto", "Câmera IP", null), "produto");
  assert.equal(classificarComposicao("mao_de_obra", "Instalação de box", "preço com vidro incluso"), "mao_de_obra_e_material", "diferença também conta");
});

const tresFontes = [
  ref("Instalação de câmera de segurança (por ponto)", 150, { fonte: "a" }),
  ref("Instalação de câmera — mão de obra", 200, { fonte: "b" }),
  ref("Serviço de instalação de câmera", 250, { fonte: "c" }),
];
test("6. seu preço ABAIXO da faixa", () => {
  const { resumo } = analisar(tresFontes, { seu: 10000 });
  assert.equal(resumo.posicaoSeuPreco, "abaixo");
});
test("7. seu preço DENTRO da faixa", () => {
  const { resumo } = analisar(tresFontes, { seu: 20000 });
  assert.deepEqual([resumo.posicaoSeuPreco, resumo.seuPrecoCentavos, resumo.minimoCentavos, resumo.maximoCentavos, resumo.medianaCentavos], ["dentro", 20000, 15000, 25000, 20000]);
});
test("8. seu preço ACIMA da faixa", () => {
  const { resumo } = analisar(tresFontes, { seu: 40000 });
  assert.equal(resumo.posicaoSeuPreco, "acima");
});

test("serviço sem cidade continua sem conclusão (preço de outra região não representa o mercado)", () => {
  const ex = extrairReferencias(resposta(tresFontes), { tipo: "servico", localidade: "" });
  const resumo = resumirReferencias(ex.referencias, { tipo: "servico", localidade: "", seuPrecoCentavos: 20000 });
  assert.equal(resumo.medianaCentavos, null);
  assert.match(resumo.motivo, /informe a cidade/);
});

test("fatores: só texto, até 5, sem valores; IA nunca dá preço sem fonte", () => {
  assert.deepEqual(sanitizarFatores(["metragem", "R$ 50 por ponto", "3 metros de tubulação", "acesso difícil", "", 7, "x".repeat(200), "deslocamento", "material", "região", "urgência"]),
    ["metragem", "acesso difícil", "deslocamento", "material", "região"]);
  assert.deepEqual(sanitizarFatores("não é lista"), []);
  const prompt = montarConsultaBuscaWeb({ termo: "Instalação de box", tipo: "servico", localidade: CIDADE });
  assert.match(prompt, /"composicao": mao_de_obra = o preço é SÓ do serviço; mao_de_obra_e_material = inclui aparelho, peça, vidro, material ou produto junto/);
  assert.match(prompt, /"fatores": até 5 fatores [^\n]*SEM valores nem números/);
  assert.match(prompt, /Nunca invente preço, loja ou link/);
});

test("modo PRODUTO inalterado: prompt idêntico e referências sem composição/fatores", () => {
  const p = montarConsultaBuscaWeb({ termo: "Pneu 90/90-18", tipo: "produto", especificacao: "ignorada em produto" });
  assert.equal(p, [
    'Pesquise na web preços atuais no Brasil do PRODUTO: "Pneu 90/90-18". Priorize lojas e anúncios com o mesmo modelo/especificação.',
    'Responda SOMENTE com JSON válido (sem texto antes ou depois) no formato {"referencias":[{"titulo":"...","preco_reais":123.45,"url":"https://...","tipo":"produto","localidade":null,"comparabilidade":"alta","diferenca":null}]}.',
    "Regras: inclua apenas ofertas cujo preço você viu na página; use o preço exatamente como exibido (à vista, em reais); \"url\" é a página onde o preço aparece;",
    "\"comparabilidade\": alta = mesmo item/serviço; media = parecido com diferença relevante (descreva em \"diferenca\"); baixa = só relacionado;",
    "\"localidade\": cidade/UF da oferta quando a página informar, senão null. Nunca invente preço, loja ou link; se não encontrar, devolva {\"referencias\":[]}; no máximo 8.",
  ].join("\n"));
  const ex = extrairReferencias(resposta([{ titulo: "Pneu", preco_reais: 200, url: "https://loja.com.br/p", tipo: "produto", comparabilidade: "alta" }]), { tipo: "produto" });
  assert.equal("composicao" in ex.referencias[0], false);
  assert.deepEqual(ex.fatores, []);
  const r = resumirReferencias([{ ...ex.referencias[0] }, { ...ex.referencias[0], fonte: "b.com.br", url: "https://b.com.br/p" }], { tipo: "produto" });
  assert.equal(r.medianaCentavos, 20000, "produto com poucas referências mantém o comportamento aprovado (indício)");
});

// ── Rota: especificação e "seu preço" só em serviço; nada é gravado ────────
function rota(refsServico) {
  const f = fixture({ httpBody: resposta(refsServico) });
  return { f, POST: body => f.load("app/api/pesquisa-precos/busca-web/route.ts").POST(request(body, "session")) };
}
const plain = v => JSON.parse(JSON.stringify(v));

test("rota (serviço): usa especificação e o preço informado; devolve fatores e origem do preço; não grava", async () => {
  const { f, POST } = rota(tresFontes);
  const r = await POST({ termo: "Instalação de câmera", tipo: "servico", localidade: CIDADE, especificacao: "4 câmeras, cabeamento existente", seu_preco_reais: "180.5" });
  assert.equal(r.status, 200);
  const b = plain(r.body);
  assert.equal(b.seuPrecoOrigem, "informado");
  assert.equal(b.resumo.seuPrecoCentavos, 18050);
  assert.equal(b.resumo.posicaoSeuPreco, "dentro");
  assert.equal(b.consulta.especificacao, "4 câmeras, cabeamento existente");
  assert.ok(Array.isArray(b.fatores));
  const chamada = f.calls.find(c => c.url === "https://api.openai.com/v1/responses");
  assert.match(JSON.parse(chamada.init.body).input, /Especificação informada pelo profissional: "4 câmeras, cabeamento existente"/);
  assert.equal(f.queries.filter(q => ["insert", "update", "upsert", "delete"].includes(q.action) && q.table !== "eventos_dominio").length, 0);
});

test("rota: valida especificação e preço; produto ignora esses campos", async () => {
  assert.equal((await rota(tresFontes).POST({ termo: "Instalação", tipo: "servico", localidade: CIDADE, seu_preco_reais: -5 })).status, 400);
  assert.equal((await rota(tresFontes).POST({ termo: "Instalação", tipo: "servico", localidade: CIDADE, especificacao: "x".repeat(301) })).status, 400);
  const { f, POST } = rota([]);
  const p = await POST({ termo: "Pneu 90/90-18", tipo: "produto", especificacao: "não usar", seu_preco_reais: 999 });
  assert.equal(p.status, 200);
  assert.equal(plain(p.body).seuPrecoOrigem, null, "produto não aceita preço digitado");
  assert.doesNotMatch(JSON.parse(f.calls.find(c => c.url === "https://api.openai.com/v1/responses").init.body).input, /não usar/);
});

test("tela: campos de serviço, composição visível, motivo de 'fora da conta' e fatores; nada de 'preço correto'", () => {
  const p = fs.readFileSync(new URL("../app/pesquisa-precos/page.tsx", import.meta.url), "utf8");
  assert.match(p, /busca\.tipo === "servico" && <>/);
  assert.match(p, /Especificação do serviço \(opcional\)/);
  assert.match(p, /Seu preço para este serviço \(opcional, R\$\)/);
  assert.match(p, /Inclui produto\/material — fora da conta/);
  assert.match(p, /Somente mão de obra/);
  assert.match(p, /data-testid="fatores-servico"/);
  assert.match(p, /não uma recomendação automática/);
  assert.doesNotMatch(p, /preço correto|preço de mercado|preço ideal|preço recomendado/i);
});

test("escopo: mão de obra + material usa só referências com material; indefinido nunca inclui venda de produto", () => {
  const ex = extrairReferencias(resposta([
    ref("Instalação de box com vidro incluso", 900, { fonte: "a", composicao: "mao_de_obra_e_material" }),
    ref("Instalação de box com material", 1000, { fonte: "b", composicao: "mao_de_obra_e_material" }),
    ref("Instalação de box + vidro", 1100, { fonte: "c", composicao: "mao_de_obra_e_material" }),
    ref("Instalação de box — mão de obra", 300, { fonte: "d" }),
  ]), { tipo: "servico", localidade: CIDADE });
  const r = (escopo) => resumirReferencias(ex.referencias, { tipo: "servico", localidade: CIDADE, escopo });
  assert.deepEqual([r("mao_de_obra_e_material").consideradas, r("mao_de_obra_e_material").minimoCentavos], [3, 90000]);
  assert.equal(r("mao_de_obra").consideradas, 1);
  assert.equal(r("mao_de_obra").medianaCentavos, null, "uma referência não forma faixa");
  assert.equal(r("indefinido").consideradas, 4);
  assert.equal(composicaoEntraNaConta("produto", "indefinido"), false);
  assert.equal(composicaoEntraNaConta("indefinida", "indefinido"), false);
  assert.match(montarConsultaBuscaWeb({ termo: "box", tipo: "servico", localidade: CIDADE, escopo: "mao_de_obra" }), /SOMENTE a mão de obra/);
  assert.match(montarConsultaBuscaWeb({ termo: "box", tipo: "servico", localidade: CIDADE, escopo: "mao_de_obra_e_material" }), /INCLUEM material/);
});

test("escopo: tela e rota expõem a escolha e a resposta em linguagem simples", () => {
  const page = fs.readFileSync("app/pesquisa-precos/page.tsx", "utf8");
  const rota = fs.readFileSync("app/api/pesquisa-precos/busca-web/route.ts", "utf8");
  assert.match(page, /O que o preço deve incluir/);
  assert.match(page, /escopo: busca\.escopo/);
  assert.match(page, /Quanto estão cobrando/);
  assert.match(rota, /ESCOPOS_SERVICO\.includes/);
});
