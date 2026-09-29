// Última milha pré-venda (2026-09-28) — coerência de navegação e nomenclatura:
// cada item do menu abre uma página com o MESMO nome; ícones do menu são um
// único glifo (sem sequência ZWJ, que quebrava "Copiloto" em alguns sistemas).
//
// node --test tests/pre-venda-coerencia.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const shell = ler("app/components/AdminShellFrame.tsx");
const itens = [...shell.matchAll(/\{ l: "([^"]+)",\s+h: "([^"]+)",\s+i: "([^"]+)" \}/g)].map(m => ({ l: m[1], h: m[2], i: m[3] }));

test("menu: todo ícone é um único glifo (sem ZWJ) — nada de '🧑‍💼' virando '🤷‍♂️💼opiloto'", () => {
  assert.ok(itens.length >= 25);
  for (const { l, i } of itens) {
    assert.ok(!i.includes("‍"), `${l}: ícone com ZWJ`);
    const semSeletor = [...i].filter(c => c !== "️");
    assert.equal(semSeletor.length, 1, `${l}: ícone com ${semSeletor.length} glifos`);
  }
});

test("menu: rótulos únicos, rotas únicas", () => {
  assert.equal(new Set(itens.map(x => x.l)).size, itens.length);
  assert.equal(new Set(itens.map(x => x.h)).size, itens.length);
});

test("menu ↔ página: mesmo nome nas superfícies que divergiam", () => {
  const menu = Object.fromEntries(itens.map(x => [x.h, x.l]));
  const pares = [
    ["/copiloto", "Gerente Comercial AI", "app/copiloto/page.tsx", 'title="Gerente Comercial AI"'],
    ["/pedidos", "Pedidos", "app/pedidos/page.tsx", 'title="Pedidos"'],
    ["/automacao", "WhatsApp", "app/automacao/page.tsx", 'title="WhatsApp"'],
    ["/conteudo", "Conteúdo IA", "app/conteudo/page.tsx", 'title="Conteúdo IA"'],
    ["/google-presenca", "Google Presença", "app/google-presenca/page.tsx", "Google Presença"],
    ["/dashboard", "Visão Geral", "app/components/CasaDashboard.tsx", '<AdminShell title="Visão Geral">'],
  ];
  for (const [rota, rotulo, arquivo, trecho] of pares) {
    assert.equal(menu[rota], rotulo, rota);
    assert.ok(ler(arquivo).includes(trecho), `${arquivo} deveria conter ${trecho}`);
  }
  const dash = ler("app/dashboard/page.tsx");
  assert.doesNotMatch(dash, /<AdminShell title="(Casa|Painel Executivo)">/, "carregamento/erro da Visão Geral com o mesmo nome");
  assert.doesNotMatch(ler("app/copiloto/page.tsx"), /title="Copiloto Administrativo"|E-commerce IA →|>Gerente Comercial AI \(/);
  assert.doesNotMatch(ler("app/raio-x/page.tsx"), /title="📊/);
});

test("atalhos internos usam o nome do destino (Visão Geral → Pedidos / Oportunidades / Prioridades comerciais)", () => {
  const casa = ler("app/components/CasaDashboard.tsx");
  assert.match(casa, /<Link href="\/pedidos"[^>]*>Pedidos →<\/Link>/);
  assert.match(casa, /<Link href="\/oportunidades">Oportunidades →<\/Link>/);
  assert.doesNotMatch(casa, /Interesses recebidos|>E-commerce IA →/);
  assert.match(ler("app/components/FaixaExecutiva.tsx"), /label: "Prioridades comerciais", valor: oportunidades,\s+destino: "\/copiloto"/);
});

test("Configurações: título só no shell (sem cabeçalho duplicado na página)", () => {
  const cfg = ler("app/configuracoes/page.tsx");
  assert.doesNotMatch(cfg, /<h1[^>]*>⚙️ Configurações da Empresa<\/h1>/);
  assert.equal((cfg.match(/title="Configurações da Empresa"/g) ?? []).length, 2);
});

test("Pedidos: catálogo vazio explica onde cadastrar (Site → Serviços) em vez de só '— Item avulso —'", () => {
  const p = ler("app/pedidos/page.tsx");
  assert.match(p, /from\('clinica_servicos'\)\.select\('id, nome, preco_centavos, disponivel'\)\.eq\('clinica_id', cid\)/, "fonte canônica do catálogo preservada");
  assert.match(p, /data-testid="catalogo-vazio"/);
  assert.match(p, /catalogo\.filter\(c => c\.disponivel !== false && c\.preco_centavos\)\.length === 0/);
  assert.match(p, /href="\/site\/servicos"/);
  assert.match(p, /E-commerce IA: pedidos do catálogo e do site/);
});

test("saneamento de dados de teste do tenant oficial: proposto, fora das migrations, fail-closed, sem dado pessoal", () => {
  const arq = "sql/saneamento-pendente/limpeza-teste-dono-tenant-oficial-v1.sql";
  assert.ok(!fs.existsSync(new URL("../supabase/migrations/limpeza-teste-dono-tenant-oficial-v1.sql", import.meta.url)));
  const sql = ler(arq);
  const ativo = sql.replace(/--.*$/gm, "");
  assert.match(sql, /NÃO APLICADO\. Exige GO\./);
  assert.equal((ativo.match(/raise exception 'ABORTADO/g) ?? []).length, 5);
  assert.equal((ativo.match(/\bdelete from\b/gi) ?? []).length, 2, "somente as 2 linhas-alvo");
  assert.match(ativo, /delete from public\.agendamentos where id = ag and clinica_id = tenant;/);
  assert.match(ativo, /delete from public\.pacientes where id = pac and clinica_id = tenant;/);
  assert.doesNotMatch(ativo, /\b(drop|truncate|alter|update)\b/i);
  assert.doesNotMatch(sql, /oportunidades_demanda\s+where|delete from public\.oportunidades/i, "contatos reais de terceiros preservados");
});

test("seed de demonstração (preços do catálogo demo): proposto, separado de código, só preenche NULL no tenant demo", () => {
  const sql = ler("sql/saneamento-pendente/demo-precos-catalogo-black-crown-v1.sql");
  const ativo = sql.replace(/--.*$/gm, "");
  assert.match(sql, /NÃO APLICADO\. Exige GO\. Não é correção de código: é DADO de demonstração\./);
  assert.match(ativo, /where s\.id = v\.id and s\.clinica_id = demo and s\.preco_centavos is null;/);
  assert.match(ativo, /raise exception 'ABORTADO: tenant demo não confere/);
  assert.doesNotMatch(ativo, /\b(delete|drop|truncate|alter|insert)\b/i);
});
