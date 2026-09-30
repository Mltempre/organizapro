// "← Voltar" — padrão global de navegação das telas internas do OrganizaPro.
// Regra pura (lib/navegacao-voltar.ts) + ligação única no shell persistente
// (app/components/AdminShellFrame.tsx), cobrindo todas as telas do menu.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  destinoVoltar, registrarVisita, paiCanonico, mostrarVoltar, rotaInternaValida, nomeDaTela, lerPilha, LIMITE_PILHA,
} from "../lib/navegacao-voltar.ts";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const shell = ler("app/components/AdminShellFrame.tsx");
const menu = [...shell.matchAll(/\{ l: "([^"]+)",\s+h: "([^"]+)"/g)].map(m => ({ l: m[1], h: m[2] }));
const ROTAS = [...menu.map(i => i.h), "/configuracoes", "/dashboard-demo"];

// Simula a navegação como o shell faz: a cada tela, registra a anterior.
function navegar(caminhos) {
  let pilha = [], anterior = null;
  for (const c of caminhos) { pilha = registrarVisita(pilha, anterior, c, ROTAS); anterior = c; }
  return pilha;
}

test("menu lido do shell tem as telas esperadas", () => {
  for (const h of ["/dashboard", "/oportunidades", "/financeiro", "/clientes", "/orcamentos", "/follow-up", "/cobrancas", "/pedidos", "/estoque",
    "/pesquisa-precos", "/tratamentos", "/receita-perdida", "/agendamentos", "/agenda-autonoma", "/chatbot", "/automacao", "/google-presenca",
    "/reputacao", "/site", "/conteudo", "/copiloto", "/metricas", "/raio-x", "/previsor-faturamento", "/linha-economica", "/atribuicao"]) {
    assert.ok(menu.some(i => i.h === h), h);
  }
});

test("Catálogo e Pedidos → Pesquisa de Preços → Voltar → Catálogo e Pedidos", () => {
  const pilha = navegar(["/dashboard", "/pedidos", "/pesquisa-precos?termo=Pneu&servico_id=abc"]);
  const r = destinoVoltar("/pesquisa-precos?termo=Pneu&servico_id=abc", pilha, ROTAS);
  assert.equal(r.destino, "/pedidos"); assert.equal(r.origem, "historico");
});

test("Visão Geral → Gerente Comercial → Voltar → Visão Geral", () => {
  const r = destinoVoltar("/copiloto", navegar(["/dashboard", "/copiloto"]), ROTAS);
  assert.equal(r.destino, "/dashboard");
});

test("voltar em sequência percorre o caminho feito, sem pular nem repetir", () => {
  const pilha = navegar(["/dashboard", "/clientes", "/clientes/123", "/orcamentos?status=apresentado"]);
  const a = destinoVoltar("/orcamentos?status=apresentado", pilha, ROTAS);
  assert.equal(a.destino, "/clientes/123");
  const b = destinoVoltar("/clientes/123", a.pilha, ROTAS);
  assert.equal(b.destino, "/clientes");
  const c = destinoVoltar("/clientes", b.pilha, ROTAS);
  assert.equal(c.destino, "/dashboard");
  assert.equal(destinoVoltar("/dashboard", c.pilha, ROTAS).origem, "pai");
});

test("acesso direto pela URL (sem origem): pai canônico, nunca fora do produto", () => {
  assert.equal(destinoVoltar("/pesquisa-precos", [], ROTAS).destino, "/pedidos");
  assert.equal(destinoVoltar("/estoque", [], ROTAS).destino, "/pedidos");
  assert.equal(destinoVoltar("/agenda-autonoma", [], ROTAS).destino, "/agendamentos");
  assert.equal(destinoVoltar("/clientes/abc", [], ROTAS).destino, "/clientes");
  assert.equal(destinoVoltar("/site/servicos", [], ROTAS).destino, "/site");
  for (const h of ROTAS.filter(h => !["/pesquisa-precos", "/estoque", "/agenda-autonoma"].includes(h))) {
    assert.equal(destinoVoltar(h, [], ROTAS).destino, "/dashboard", h);
  }
});

test("origem externa ou pública nunca vira destino", () => {
  for (const ruim of ["https://golpe.com/x", "//golpe.com", "/\\golpe.com", "javascript:alert(1)", "/login", "/empresa/slug", "/", "", null]) {
    assert.equal(rotaInternaValida(ruim, ROTAS), false, String(ruim));
  }
  const pilha = lerPilha(JSON.stringify(["https://golpe.com", "/login", "//x.com", "/pedidos"]), ROTAS);
  assert.deepEqual(pilha, ["/pedidos"], "pilha adulterada é saneada");
  assert.equal(destinoVoltar("/estoque", ["https://golpe.com"], ROTAS).destino, "/pedidos");
  assert.deepEqual(lerPilha("{quebrado", ROTAS), []);
});

test("recarregar a mesma tela não empilha; pilha tem limite", () => {
  assert.deepEqual(navegar(["/pedidos", "/pedidos", "/pedidos?x=1"]), []);
  const muitas = navegar(Array.from({ length: 80 }, (_, i) => (i % 2 ? "/clientes" : "/pedidos")));
  assert.ok(muitas.length <= LIMITE_PILHA);
});

test("Voltar aparece em todas as telas internas, exceto a Visão Geral (ponto de partida)", () => {
  assert.equal(mostrarVoltar("/dashboard"), false);
  for (const h of ROTAS.filter(h => h !== "/dashboard")) assert.equal(mostrarVoltar(h), true, h);
  for (const h of ["/clientes/abc", "/site/faq"]) assert.equal(mostrarVoltar(h), true, h);
});

test("rótulo acessível diz para onde volta", () => {
  assert.equal(nomeDaTela("/pedidos", menu), "Catálogo e Pedidos");
  assert.equal(nomeDaTela("/clientes/abc", menu), "Clientes");
  assert.equal(nomeDaTela("/dashboard", menu), "Visão Geral");
  assert.equal(paiCanonico("/qualquer"), "/dashboard");
});

test("ligação única no shell: link real, sem history.back, sessionStorage, estilo dourado", () => {
  assert.match(shell, /import \{\s*CHAVE_ATUAL, CHAVE_PILHA, CHAVE_VOLTANDO, caminhoDe, destinoVoltar, lerPilha, mostrarVoltar, nomeDaTela, registrarVisita,\s*\} from "\.\.\/\.\.\/lib\/navegacao-voltar";/);
  assert.match(shell, /\{mostrarVoltar\(pathname\) && \(\s*<a\s+href=\{alvoVoltar\.destino\}\s+className="ash-voltar"/);
  assert.match(shell, /aria-label=\{`Voltar para \$\{nomeAlvoVoltar \?\? "a tela anterior"\}`\}/);
  assert.match(shell, /<span aria-hidden="true">←<\/span>\s*<span className="ash-voltar-texto">Voltar<\/span>/);
  assert.doesNotMatch(shell, /router\.back\(|history\.back\(|history\.go\(|document\.referrer/);
  assert.match(shell, /sessionStorage\.setItem\(CHAVE_PILHA/);
  assert.match(shell, /\.ash-voltar \{[^}]*color: #e3c05c;/);
  assert.match(shell, /\.ash-voltar:hover \{/);
  assert.match(shell, /\.ash-voltar:focus-visible \{/);
  assert.match(shell, /overflow-x: hidden;[\s\S]{0,400}overflow-x: clip;/, "cabeçalho sticky passa a grudar");
});

test("nenhuma página mantém um Voltar próprio de navegação (padrão é do shell)", () => {
  const pesquisa = ler("app/pesquisa-precos/page.tsx");
  assert.doesNotMatch(pesquisa, /pp-voltar|veioDoCatalogo/);
});
