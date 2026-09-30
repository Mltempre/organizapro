// "← Voltar" — histórico de navegação INTERNA do OrganizaPro: cada clique
// volta exatamente um passo da sequência percorrida nesta aba. Regra pura
// (lib/navegacao-voltar.ts) + ligação única no shell persistente.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { destinoVoltar, registrarVisita, rotaInternaValida, nomeDaTela, lerPilha, LIMITE_PILHA } from "../lib/navegacao-voltar.ts";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const shell = ler("app/components/AdminShellFrame.tsx");
const menu = [...shell.matchAll(/\{ l: "([^"]+)",\s+h: "([^"]+)"/g)].map(m => ({ l: m[1], h: m[2] }));
const ROTAS = [...menu.map(i => i.h), "/configuracoes", "/dashboard-demo"];

// Simula a aba como o shell faz: abrir tela registra a anterior; Voltar
// usa o topo da pilha e NÃO registra a chegada (não empilha de volta).
function aba() {
  let pilha = [], atual = null;
  return {
    abrir(rota) { pilha = registrarVisita(pilha, atual, rota, ROTAS); atual = rota; },
    voltar() {
      const r = destinoVoltar(atual, pilha, ROTAS);
      if (r.destino) { pilha = r.pilha; atual = r.destino; }
      return r.destino;
    },
    get atual() { return atual; },
  };
}

test("exemplo 1: Visão Geral → Oportunidades → Follow-up → Orçamentos: cada ← volta uma etapa", () => {
  const a = aba();
  for (const r of ["/dashboard", "/oportunidades", "/follow-up", "/orcamentos"]) a.abrir(r);
  assert.equal(a.voltar(), "/follow-up");
  assert.equal(a.voltar(), "/oportunidades");
  assert.equal(a.voltar(), "/dashboard");
  assert.equal(a.voltar(), null, "sem mais histórico: nenhum destino inventado");
  assert.equal(a.atual, "/dashboard");
});

test("exemplo 2: Clientes → Orçamentos → Pesquisa de Preços → Catálogo", () => {
  const a = aba();
  for (const r of ["/clientes", "/orcamentos", "/pesquisa-precos?termo=Pneu&servico_id=abc", "/pedidos"]) a.abrir(r);
  assert.equal(a.voltar(), "/pesquisa-precos?termo=Pneu&servico_id=abc", "volta com a mesma consulta aberta");
  assert.equal(a.voltar(), "/orcamentos");
  assert.equal(a.voltar(), "/clientes");
  assert.equal(a.voltar(), null);
});

test("vale também na Visão Geral quando há histórico anterior", () => {
  const a = aba();
  for (const r of ["/clientes", "/dashboard"]) a.abrir(r);
  assert.equal(a.voltar(), "/clientes");
});

test("revisitar uma tela não pula nem inventa etapas (como um histórico real)", () => {
  const a = aba();
  for (const r of ["/dashboard", "/clientes", "/dashboard", "/copiloto"]) a.abrir(r);
  assert.deepEqual([a.voltar(), a.voltar(), a.voltar(), a.voltar()], ["/dashboard", "/clientes", "/dashboard", null]);
});

test("voltar e seguir por outro caminho: a nova sequência substitui o que ficou à frente", () => {
  const a = aba();
  for (const r of ["/dashboard", "/clientes", "/orcamentos"]) a.abrir(r);
  assert.equal(a.voltar(), "/clientes");
  a.abrir("/cobrancas");
  assert.equal(a.voltar(), "/clientes");
  assert.equal(a.voltar(), "/dashboard");
});

test("sem histórico (acesso direto / aba nova): nenhum destino fixo, nenhum 'pai'", () => {
  for (const h of ROTAS) assert.equal(destinoVoltar(h, [], ROTAS).destino, null, h);
});

test("nunca sai do OrganizaPro: externos e páginas públicas não entram no histórico", () => {
  for (const ruim of ["https://golpe.com/x", "//golpe.com", "/\\golpe.com", "javascript:alert(1)", "/login", "/empresa/slug", "/", "", null]) {
    assert.equal(rotaInternaValida(ruim, ROTAS), false, String(ruim));
  }
  assert.deepEqual(lerPilha(JSON.stringify(["https://golpe.com", "/login", "//x.com", "/pedidos"]), ROTAS), ["/pedidos"]);
  assert.equal(destinoVoltar("/estoque", ["https://golpe.com", "//x.com"], ROTAS).destino, null);
  assert.deepEqual(lerPilha("{quebrado", ROTAS), []);
  const a = aba();
  a.abrir("/login"); a.abrir("/clientes");
  assert.equal(a.voltar(), null, "/login não vira destino");
});

test("recarregar a mesma tela não cria etapa; histórico tem limite", () => {
  const a = aba();
  for (const r of ["/pedidos", "/pedidos", "/pedidos?x=1"]) a.abrir(r);
  assert.equal(a.voltar(), null);
  const b = aba();
  for (let i = 0; i < 120; i++) b.abrir(i % 2 ? "/clientes" : "/pedidos");
  assert.ok(destinoVoltar("/pedidos", [], ROTAS).pilha.length <= LIMITE_PILHA);
});

test("rótulo acessível diz para onde volta", () => {
  assert.equal(nomeDaTela("/pedidos", menu), "Catálogo e Pedidos");
  assert.equal(nomeDaTela("/clientes/abc", menu), "Clientes");
  assert.equal(nomeDaTela("/dashboard", menu), "Visão Geral");
});

test("shell: UMA seta no canto direito do cabeçalho, em todas as telas, sem destino fixo", () => {
  const cabecalho = shell.slice(shell.indexOf('className="ash-header"'), shell.indexOf("</header>"));
  assert.equal((cabecalho.match(/className="ash-voltar"/g) || []).length, 1, "uma única seta");
  assert.ok(cabecalho.indexOf('className="ash-voltar"') > cabecalho.indexOf('className="ash-action-btn"'), "à direita, depois da ação da tela");
  assert.doesNotMatch(shell, /mostrarVoltar|paiCanonico|INICIO/);
  assert.match(cabecalho, /aria-disabled=\{alvoVoltar\.destino \? undefined : true\}/);
  assert.match(cabecalho, /<span aria-hidden="true">←<\/span>\s*<span className="ash-voltar-texto">Voltar<\/span>/);
  assert.doesNotMatch(shell, /router\.back\(|history\.back\(|history\.go\(|document\.referrer/);
  assert.match(shell, /if \(!destino\) return; \/\/ sem histórico interno/);
  assert.match(shell, /\.ash-voltar \{[^}]*color: #e3c05c;/);
  assert.match(shell, /overflow-x: hidden;[\s\S]{0,400}overflow-x: clip;/, "cabeçalho fixo no topo durante a rolagem");
});

test("nenhuma página tem botão Voltar próprio", () => {
  assert.doesNotMatch(ler("app/pesquisa-precos/page.tsx"), /pp-voltar|veioDoCatalogo/);
});
