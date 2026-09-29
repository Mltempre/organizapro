// Catálogo Comercial Universal (2026-09-28) — um só cadastro de itens
// (produtos e/ou serviços) administrado em Catálogo e Pedidos, com a MESMA
// regra de persistência usada por Meu Site → Serviços. Sem migration, sem
// IA, sem estoque/SKU/checkout. Coerente para qualquer tipo de negócio.
//
// node --test tests/catalogo-comercial.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fixture } from "./helpers/p1-fixture.mjs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const semComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const TENANT = "11111111-1111-4111-8111-111111111111";

// db simulado para clinica_servicos: registra toda escrita.
function catalogoFake(o = {}) {
  const f = fixture({
    responder: (q) => {
      if (q.table !== "clinica_servicos") return undefined;
      if (q.action === "insert") return o.erroPrincipal ? { data: null, error: { code: "XX000" } } : { data: { id: "item-novo" }, error: null };
      if (q.action === "update") {
        const ehPreco = q.value && "preco_centavos" in q.value;
        if (ehPreco && o.erroPreco) return { data: null, error: { code: "42703" } };
        if (!ehPreco && o.erroPrincipal) return { data: null, error: { code: "XX000" } };
        return { data: null, error: null };
      }
      return { data: [], error: null };
    },
  });
  return { f, lib: f.load("lib/catalogo-comercial.ts") };
}
// Objetos vindos do vm do harness têm outro protótipo: compara por conteúdo.
const plain = x => JSON.parse(JSON.stringify(x));
const escritas = f => f.queries.filter(q => q.table === "clinica_servicos" && ["insert", "update"].includes(q.action));

// ── Três negócios diferentes, mesma regra (nenhum nicho no código) ──────────
const CENARIOS = {
  barbearia: [
    { nome: "Corte", preco: "45,00", disponivel: true },
    { nome: "Barba", preco: "", disponivel: true },
  ],
  "loja de roupas": [
    { nome: "Camiseta", preco: "59,90", disponivel: true },
    { nome: "Calça", preco: "149,90", disponivel: false },
  ],
  "motopeças/oficina": [
    { nome: "Pneu", preco: "1.250,00", disponivel: true },
    { nome: "Óleo", preco: "38,50", disponivel: true },
    { nome: "Troca de óleo", preco: "80", disponivel: true },
  ],
};

test("universal: barbearia, loja de roupas e motopeças usam a mesma regra — vendável = disponível com preço", () => {
  const { lib } = catalogoFake();
  const esperado = {
    barbearia: ["Corte"],
    "loja de roupas": ["Camiseta"],
    "motopeças/oficina": ["Pneu", "Óleo", "Troca de óleo"],
  };
  for (const [negocio, itens] of Object.entries(CENARIOS)) {
    const vendaveis = itens
      .map(i => ({ nome: i.nome, disponivel: i.disponivel, preco_centavos: lib.parsePrecoParaCentavos(i.preco) }))
      .filter(lib.itemVendavel).map(i => i.nome);
    assert.deepEqual(vendaveis, esperado[negocio], negocio);
  }
  assert.equal(lib.parsePrecoParaCentavos("1.250,00"), 125000);
  assert.equal(lib.parsePrecoParaCentavos("59,90"), 5990);
  assert.equal(lib.parsePrecoParaCentavos("80"), 8000);
  assert.equal(lib.parsePrecoParaCentavos(""), null);
  assert.equal(lib.parsePrecoParaCentavos("0"), null);
  assert.equal(lib.parsePrecoParaCentavos("-5"), null);
  assert.equal(lib.formatarCentavosParaInput(5990), "59,90");
});

test("universal: nenhum nicho no código do catálogo/pedidos (Barba, Camiseta, Pneu são dados do negócio, nunca regra)", () => {
  const lib = semComentarios(ler("lib/catalogo-comercial.ts"));
  const pag = semComentarios(ler("app/pedidos/page.tsx"));
  for (const nicho of ["barba", "barbearia", "camiseta", "calça", "pneu", "óleo", "oficina", "clínica", "dente", "consulta", "tratamento clínico"]) {
    assert.ok(!lib.toLowerCase().includes(nicho), `lib com nicho: ${nicho}`);
  }
  // Na tela, nichos só podem aparecer como EXEMPLO de placeholder (misturando segmentos).
  const semPlaceholders = pag.replace(/placeholder="[^"]*"/g, "");
  for (const nicho of ["barba", "camiseta", "pneu", "óleo", "oficina", "tooth", "clinica_servicos"]) {
    assert.ok(!semPlaceholders.toLowerCase().includes(nicho) || nicho === "clinica_servicos" && /from\('clinica_servicos'\)/.test(semPlaceholders) && (semPlaceholders.match(/clinica_servicos/g) || []).length === 1, `tela com nicho/termo interno visível: ${nicho}`);
  }
  assert.match(pag, /placeholder="Produto ou serviço — ex\.: Camiseta, Troca de óleo, Corte"/);
});

// ── Regra única de persistência ─────────────────────────────────────────────
test("novo item: salvamento principal (sem preço) + preço/disponibilidade em chamada separada, ambos filtrados pelo negócio", async () => {
  const { f, lib } = catalogoFake();
  const r = await lib.salvarItemCatalogo(f.db, { clinicaId: TENANT, ordemNova: 7, form: { ...lib.FORM_ITEM_VAZIO, nome: "  Camiseta ", descricao: "Algodão", preco: "59,90", disponivel: true, imagem_url: "https://img/x.png" } });
  assert.deepEqual(plain(r), { ok: true, id: "item-novo", avisoPreco: "" });
  const [principal, preco] = escritas(f);
  assert.equal(principal.action, "insert");
  assert.deepEqual(plain(principal.value), { clinica_id: TENANT, icone: "tooth", imagem_url: "https://img/x.png", nome: "Camiseta", descricao: "Algodão", ordem: 7 });
  assert.ok(!("preco_centavos" in principal.value), "preço nunca vai no salvamento principal");
  assert.deepEqual(plain(preco.value), { preco_centavos: 5990, disponivel: true });
  assert.deepEqual(plain(preco.filters), [["id", "item-novo"], ["clinica_id", TENANT]]);
});

test("editar item: update por id E negócio; ícone/visual do site preservado; indisponível e sem preço são estados válidos", async () => {
  const { f, lib } = catalogoFake();
  const item = { id: "i1", icone: "gem", imagem_url: null, nome: "Troca de óleo", descricao: null, ordem: 2, preco_centavos: 8000, disponivel: true };
  const form = { ...lib.formularioDoItem(item), preco: "", disponivel: false };
  const r = await lib.salvarItemCatalogo(f.db, { clinicaId: TENANT, itemId: "i1", form });
  assert.equal(r.ok, true);
  const [principal, preco] = escritas(f);
  assert.equal(principal.action, "update");
  assert.equal(principal.value.icone, "gem", "ícone escolhido em Meu Site não é sobrescrito");
  assert.deepEqual(plain(principal.filters), [["id", "i1"], ["clinica_id", TENANT]]);
  assert.deepEqual(plain(preco.value), { preco_centavos: null, disponivel: false });
});

test("falhas: nome vazio não grava; erro principal não tenta preço; erro de preço vira aviso sem desfazer o item", async () => {
  const a = catalogoFake();
  assert.deepEqual(plain(await a.lib.salvarItemCatalogo(a.f.db, { clinicaId: TENANT, form: { ...a.lib.FORM_ITEM_VAZIO, nome: "   " } })), { ok: false, erro: "Informe o nome do item." });
  assert.equal(escritas(a.f).length, 0);

  const b = catalogoFake({ erroPrincipal: true });
  const rb = await b.lib.salvarItemCatalogo(b.f.db, { clinicaId: TENANT, form: { ...b.lib.FORM_ITEM_VAZIO, nome: "Pneu", preco: "10" } });
  assert.equal(rb.ok, false);
  assert.equal(escritas(b.f).length, 1, "sem segunda chamada");

  const c = catalogoFake({ erroPreco: true });
  const rc = await c.lib.salvarItemCatalogo(c.f.db, { clinicaId: TENANT, form: { ...c.lib.FORM_ITEM_VAZIO, nome: "Pneu", preco: "10" } });
  assert.equal(rc.ok, true);
  assert.match(rc.avisoPreco, /Preço\/disponibilidade ainda não pôde ser salvo/);
});

test("uma só regra: Catálogo e Pedidos e Meu Site → Serviços usam lib/catalogo-comercial; nenhuma cópia da persistência nas telas", () => {
  const pedidos = semComentarios(ler("app/pedidos/page.tsx"));
  const site = semComentarios(ler("app/site/servicos/page.tsx"));
  for (const [nome, codigo] of [["pedidos", pedidos], ["site/servicos", site]]) {
    assert.match(codigo, /salvarItemCatalogo\(supabase, \{ clinicaId/, nome);
    assert.match(codigo, /enviarImagemItem\(/, nome);
    assert.doesNotMatch(codigo, /\.update\(\{ preco_centavos/, `${nome}: preço gravado fora do módulo`);
    assert.doesNotMatch(codigo, /from\(["']clinica_servicos["']\)\.insert\(/, `${nome}: insert fora do módulo`);
  }
  assert.doesNotMatch(pedidos, /from\('clinica_servicos'\)\.(update|delete)/, "pedidos só lê o catálogo diretamente");
});

test("Catálogo e Pedidos: administra o catálogo aqui (novo/editar/imagem/preço/disponível) sem mandar para Meu Site", () => {
  const p = ler("app/pedidos/page.tsx");
  assert.doesNotMatch(p, /href="\/site\/servicos"|router\.push\('\/site\/servicos'\)/, "não depende de Meu Site para administrar");
  for (const trecho of [">+ Novo item</button>", "'Editar item' : 'Novo item'", ">Nome do item *</label>", ">Descrição</label>", ">Imagem (opcional)</label>", ">Preço</label>",
    "Disponível para venda (aparece nos pedidos e no site)", "{c.preco_centavos ? 'Editar' : 'Definir preço'}", ">Indisponível</span>"]) {
    assert.ok(p.includes(trecho), trecho);
  }
  assert.match(p, /\{vendavel && \(\s*<button[^>]*onClick=\{\(\) => abrirNovo\(c\.id\)\}/, "Adicionar ao pedido só para item vendável");
  assert.match(p, /data-testid="fluxo-pedido"/);
  for (const etapa of ["'Catálogo'", "'Montar pedido'", "'Total'", "'Registrar'", "'Acompanhar status'"]) assert.ok(p.includes(etapa), etapa);
  assert.match(p, /Pedidos registrados aqui alimentam os sinais de pedido parado e de recompra no Gerente Comercial AI, no Follow-up Comercial e na Receita Perdida\./);
  assert.doesNotMatch(semComentarios(p), /catálogo[^.]*\bIA\b|gerad[oa] por IA|operad[oa] por IA/i, "não atribui o catálogo a IA");
});

test("pedido preservado: item do catálogo vai só com id + quantidade (preço calculado no servidor); avulso segue como exceção", () => {
  const p = ler("app/pedidos/page.tsx");
  assert.match(p, /\? \{ servico_id: l\.servicoId, quantidade: Number\(l\.quantidade\) \}/);
  assert.match(p, /idempotency_key: idempotencyKeyRef\.current/);
  assert.match(p, /<option value=\{AVULSO\}>Outro item \(fora do catálogo\)<\/option>/);
  assert.match(p, /fetch\(`\/api\/pedidos\/\$\{pedido\.id\}\/transicao`/, "estados pelo motor existente");
  const api = ler("app/api/pedidos/route.ts");
  assert.match(api, /valorFoiManipulado|capturarValorItem|catalogoPorId/, "API continua calculando o preço do catálogo");
  assert.doesNotMatch(p, /estoque|fornecedor|\bSKU\b|checkout|gateway/i);
});

test("Meu Site continua consumindo o MESMO catálogo na vitrine (nenhum segundo catálogo)", () => {
  const vitrine = ler("app/empresa/[slug]/_components/Servicos.tsx");
  assert.match(vitrine, /s\.disponivel !== false/);
  assert.match(vitrine, /preco_centavos/);
  const pub = ler("app/empresa/[slug]/_components/PedidoPublico.tsx");
  assert.match(pub, /servico\.disponivel !== false/);
  const tabelas = [...new Set([...ler("app/pedidos/page.tsx").matchAll(/from\('([a-z_]+)'\)/g)].map(m => m[1]))];
  assert.deepEqual(tabelas.sort(), ["clinica_servicos", "pacientes"]);
});

// ── Fechamento comercial (2026-09-29): Orçamento montado com o catálogo ───
// Produto + mão de obra no mesmo orçamento, sem tabela/rota/motor novo: a
// tela só compõe descrição e valor e envia à MESMA API de orçamentos.
test("orçamento do catálogo: produto + mão de obra nos 4 cenários, total pela soma dos preços cadastrados", () => {
  const { lib } = catalogoFake();
  const casos = [
    { negocio: "oficina", linhas: [["Pneu 90/90-18", 22990, 1], ["Mão de obra — troca de pneu", 2500, 1]], descricao: "1× Pneu 90/90-18 + 1× Mão de obra — troca de pneu", total: 25490 },
    { negocio: "câmeras", linhas: [["Câmera Intelbras VHD 1220 B", 20551, 4], ["Instalação e configuração", 45000, 1]], descricao: "4× Câmera Intelbras VHD 1220 B + 1× Instalação e configuração", total: 127204 },
    { negocio: "vidraçaria", linhas: [["Box vidro temperado 8 mm", 89000, 1], ["Instalação de box", 70000, 1]], descricao: "1× Box vidro temperado 8 mm + 1× Instalação de box", total: 159000 },
    { negocio: "móveis", linhas: [["Sofá retrátil 3 lugares", 224153, 1]], descricao: "1× Sofá retrátil 3 lugares", total: 224153 },
  ];
  for (const c of casos) {
    const r = plain(lib.comporOrcamentoDoCatalogo(c.linhas.map(([nome, preco_centavos, quantidade]) => ({ nome, preco_centavos, quantidade }))));
    assert.deepEqual(r, { descricao: c.descricao, totalCentavos: c.total }, c.negocio);
  }
  // Linha inválida nunca entra no total (sem preço, quantidade 0/fracionada, nome vazio).
  const r = plain(lib.comporOrcamentoDoCatalogo([
    { nome: "Óleo", preco_centavos: 3850, quantidade: 2 },
    { nome: "Sem preço", preco_centavos: 0, quantidade: 1 },
    { nome: "Zero", preco_centavos: 1000, quantidade: 0 },
    { nome: "Fração", preco_centavos: 1000, quantidade: 1.5 },
    { nome: "  ", preco_centavos: 1000, quantidade: 1 },
  ]));
  assert.deepEqual(r, { descricao: "2× Óleo", totalCentavos: 7700 });
  assert.deepEqual(plain(lib.comporOrcamentoDoCatalogo([])), { descricao: "", totalCentavos: 0 });
});

test("Orçamentos usa o catálogo único e a MESMA API — sem cadastro paralelo, sem escrita no catálogo", () => {
  const p = ler("app/orcamentos/page.tsx");
  const codigo = semComentarios(p);
  assert.match(codigo, /from '\.\.\/\.\.\/lib\/catalogo-comercial'/);
  assert.match(codigo, /supabase\.from\('clinica_servicos'\)\.select\('id, nome, preco_centavos, disponivel'\)\.eq\('clinica_id', cid\)/);
  assert.match(codigo, /\.filter\(itemVendavel\)/, "só itens disponíveis com preço");
  assert.doesNotMatch(codigo, /from\('[a-z_]+'\)[^;]*\.(insert|update|upsert|delete)\(/, "a tela não escreve em tabela nenhuma diretamente");
  const tabelas = [...new Set([...codigo.matchAll(/from\('([a-z_]+)'\)/g)].map(m => m[1]))];
  assert.deepEqual(tabelas.sort(), ["clinica_servicos", "pacientes"]);
  // Mesmo contrato da API de orçamentos (procedimento + valor), nada novo no body.
  assert.match(codigo, /fetch\('\/api\/orcamentos', \{\s*method: 'POST'/);
  assert.match(codigo, /procedimento: form\.procedimento\.trim\(\),\s*valor: valorNumerico,/);
  assert.doesNotMatch(codigo, /itens: form\.itens|servico_id/, "itens não viajam para a API de orçamentos");
  assert.match(p, /data-testid="orcamento-itens-catalogo"/);
  assert.match(p, />Itens do catálogo \(opcional\)</);
  assert.match(p, /Combine produtos e mão de obra\./);
  assert.match(p, /<a href="\/pedidos"[^>]*>Cadastrar em Catálogo e Pedidos<\/a>/);
  assert.doesNotMatch(p, /Consultoria mensal|'Serviço é obrigatório\.'/);
  // Motor e rotas de orçamento intocados por esta frente.
  assert.doesNotMatch(ler("app/api/orcamentos/route.ts"), /catalogo|clinica_servicos/);
});
