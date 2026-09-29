// Pré-venda final (2026-09-28) — coerência comercial do produto UNIVERSAL:
// item do menu = título da página (em todos os estados), ícones de um glifo,
// atalhos com o nome do destino, nomenclatura sem termo médico, superfícies
// sem dados fora do menu (reversível) e Catálogo e Pedidos demonstrável.
//
// node --test tests/pre-venda-coerencia.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const existe = p => fs.existsSync(new URL("../" + p, import.meta.url));
const shell = ler("app/components/AdminShellFrame.tsx");
const itensDe = bloco => [...bloco.matchAll(/\{ l: "([^"]+)",\s+h: "([^"]+)",\s+i: "([^"]+)" \}/g)].map(m => ({ l: m[1], h: m[2], i: m[3] }));
const menu = itensDe(shell.slice(shell.indexOf("export const navGrupos"), shell.indexOf("export const navForaDoMenuPreVenda")));
const ocultos = itensDe(shell.slice(shell.indexOf("export const navForaDoMenuPreVenda"), shell.indexOf("export const ROTAS_COM_SHELL")));
const titulosDaRota = h => {
  const arquivos = [`app${h}/page.tsx`, ...(h === "/dashboard" ? ["app/components/CasaDashboard.tsx"] : [])].filter(existe);
  return arquivos.flatMap(f => [...ler(f).matchAll(/<AdminShell[\s\S]{0,20}?title=\{?["']([^"']+)/g)].map(m => m[1]));
};

test("menu: ordem e rótulos finais da demonstração", () => {
  assert.deepEqual(menu.map(x => x.l), [
    "Visão Geral", "Oportunidades", "Dinheiro",
    "Clientes", "Orçamentos", "Follow-up Comercial", "Cobranças", "Catálogo e Pedidos", "Pesquisa de Preços", "Serviços contratados", "Receita Perdida",
    "Agenda", "Agenda Autônoma", "Chatbot IA", "WhatsApp",
    "Google Presença", "Reputação", "Meu Site", "Conteúdo IA",
    "Gerente Comercial", "Métricas", "Raio-X da Empresa", "Previsor de Faturamento", "Linha Econômica", "Ads e Atribuição",
  ]);
  assert.equal(new Set(menu.map(x => x.h)).size, menu.length);
});

test("menu ↔ página: cada item abre uma página com EXATAMENTE o mesmo título (carregando, erro e carregado)", () => {
  for (const { l, h } of menu) {
    const titulos = titulosDaRota(h);
    assert.ok(titulos.length > 0, `${h}: sem AdminShell title`);
    for (const t of titulos) assert.equal(t, l, `${h}: menu "${l}" ≠ título "${t}"`);
  }
});

test("menu: todo ícone é um único glifo (sem ZWJ) — o antigo Copiloto quebrava como '🤷‍♂️💼opiloto'", () => {
  for (const { l, i } of [...menu, ...ocultos]) {
    assert.ok(!i.includes("‍"), `${l}: ícone com ZWJ`);
    assert.equal([...i].filter(c => c !== "️").length, 1, `${l}: mais de um glifo`);
  }
  assert.equal(menu.find(x => x.h === "/copiloto").i, "💼");
});

test("fora do menu (reversível): NotaFácil e Fechamento Contábil — páginas intactas e com shell (Pesquisa de Preços voltou com busca real)", () => {
  assert.deepEqual(ocultos.map(x => x.h), ["/notafacil", "/fechamento-contabil"]);
  for (const { h } of ocultos) {
    assert.ok(!menu.some(x => x.h === h), `${h} não deveria estar no menu`);
    assert.ok(existe(`app${h}/page.tsx`), `${h}: página preservada`);
  }
  assert.match(shell, /\.\.\.navForaDoMenuPreVenda\.map\(\(i\) => i\.h\)/, "continuam recebendo o shell por link direto");
});

test("Gerente Comercial em todo lugar visível (nada de 'Copiloto' como nome de tela/atalho)", () => {
  const cop = ler("app/copiloto/page.tsx");
  assert.match(cop, /<AdminShell title="Gerente Comercial" /);
  // Decisão 2026-09-29: não há IA nesta superfície (regras determinísticas
  // sobre os motores existentes) — "AI" saiu do nome em todo texto visível.
  for (const f of ["app/components/CasaDashboard.tsx", "app/components/AdminShellFrame.tsx", "app/copiloto/page.tsx", "app/pedidos/page.tsx"]) {
    assert.doesNotMatch(ler(f).replace(/\/\/.*$/gm, ""), /Gerente Comercial (AI|IA)\b/, `${f}: "Gerente Comercial AI" residual`);
  }
  assert.match(cop, />Prioridades comerciais \(\{estado\.atencoes\.length\}\)<\/h2>/);
  for (const f of ["app/components/CasaDashboard.tsx", "app/components/FaixaExecutiva.tsx", "app/components/AdminShellFrame.tsx", "app/copiloto/page.tsx"]) {
    const visivel = ler(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(visivel, /["'>]\s*[^"'<>]*\bCopiloto\b[^"'<>]*["'<]/, `${f}: texto visível com "Copiloto"`);
  }
});

test("Visão Geral: cada atalho diz o nome da página de destino", () => {
  const casa = ler("app/components/CasaDashboard.tsx");
  for (const [href, texto] of [
    ["/copiloto", "Abrir Gerente Comercial →"], ["/financeiro", "Abrir Dinheiro →"], ["/receita-perdida", "Ver Receita Perdida →"],
    ["/previsor-faturamento", "Ver Previsor de Faturamento →"], ["/agendamentos", "Abrir agenda →"], ["/orcamentos", "Orçamentos →"],
    ["/oportunidades", "Oportunidades →"], ["/reputacao", "Ver Reputação →"], ["/google-presenca", "Ver Google Presença →"],
    ["/fechamento-contabil", "Ver Fechamento Contábil →"],
  ]) assert.ok(casa.includes(`href="${href}">${texto}</Link>`) || casa.includes(`href="${href}" aria-describedby="casa-ecommerce-descricao">${texto}</Link>`), `${href} → "${texto}"`);
  assert.match(casa, /href="\/pedidos" aria-describedby="casa-ecommerce-descricao">Catálogo e Pedidos →<\/Link>/);
  assert.match(casa, /sinal\.destinoAcao\.startsWith\("\/follow-up"\) \? "Abrir Follow-up Comercial"/);
  assert.doesNotMatch(casa, /Acompanhar clientes|Abrir financeiro|Ver valores em risco|Ver previsão →|Ver avaliações|Presença no Google|Interesses recebidos|E-commerce IA/);
  assert.match(ler("app/components/FaixaExecutiva.tsx"), /label: "Prioridades comerciais", valor: oportunidades,\s+destino: "\/copiloto"/);
});

test("Serviços contratados: nomenclatura universal na apresentação; rota, API, campos e motor preservados", () => {
  const p = ler("app/tratamentos/page.tsx");
  assert.match(p, /title="Serviços contratados"/);
  assert.match(p, /fetch\(`\/api\/tratamentos\?clinica_id=\$\{cid\}`/, "API preservada");
  assert.match(p, /tipo_tratamento/, "campo/contrato preservado");
  for (const antigo of ['title="Tratamentos"', "Tratamento registrado", "Tratamento atualizado", "Iniciar o tratamento", "+ Novo tratamento",
    "Carregando tratamentos", "tratamentos registrados", "Nenhum tratamento", ">Novo tratamento<", "Tratamento avulso", ">Tipo de tratamento<",
    "Tipo de tratamento é obrigatório", "Clareamento dental", "Registrar tratamento", "Interromper tratamento", "Um tratamento interrompido", "🩺"]) {
    assert.ok(!p.includes(antigo), `texto antigo visível: ${antigo}`);
  }
  for (const f of ["app/follow-up/page.tsx", "app/financeiro/page.tsx", "app/receita-perdida/page.tsx", "app/previsor-faturamento/page.tsx", "app/copiloto/page.tsx", "app/clientes/[id]/page.tsx", "app/components/CasaDashboard.tsx"]) {
    assert.doesNotMatch(ler(f), /'Tratamento (sem|com) retorno'|"Tratamentos sem retorno|🩺/, f);
  }
  assert.match(ler("lib/nucleo-inteligente.ts"), /destinoLabel: "Ver serviço contratado"/);
  assert.match(ler("lib/follow-up-comercial.ts"), /`Serviço \$\{t\.tipoTratamento\} interrompido há/);
});

test("Catálogo e Pedidos: sem 'IA' onde não há IA; catálogo na tela; item do catálogo é o padrão; avulso só alternativa", () => {
  const p = ler("app/pedidos/page.tsx");
  assert.match(p, /title="Catálogo e Pedidos"/);
  assert.doesNotMatch(p.replace(/\/\/.*$/gm, ""), /E-commerce IA/);
  assert.match(p, /from\('clinica_servicos'\)\.select\('id, nome, descricao, imagem_url, icone, ordem, preco_centavos, disponivel'\)\.eq\('clinica_id', cid\)/, "fonte canônica do catálogo");
  assert.match(p, /data-testid="catalogo"/);
  assert.match(p, /onClick=\{\(\) => abrirNovo\(c\.id\)\}[^>]*>\+ Adicionar ao pedido<\/button>/);
  assert.match(p, /title="Seu catálogo está vazio\."[^>]*actionLabel="\+ Novo item" onAction=\{abrirNovoItem\}/, "catálogo vazio se resolve aqui mesmo");
  assert.match(p, /<option value="" disabled>Escolha um item do catálogo…<\/option>/);
  assert.match(p, /<option value=\{AVULSO\}>Outro item \(fora do catálogo\)<\/option>/);
  assert.match(p, /servicoId: catalogoComPreco\.length > 0 \? '' : AVULSO/);
  assert.match(p, /Total: \{formatarValor\(totalEstimado\)\}/);
  assert.match(p, /fetch\('\/api\/pedidos', \{\s*method: 'POST'/, "mesma API de registro");
  assert.doesNotMatch(p, /estoque|fornecedor|\bSKU\b|checkout/i, "sem ERP/estoque/checkout");
  assert.match(ler("app/copiloto/page.tsx"), /<a href="\/pedidos">🛒 Catálogo e Pedidos →<\/a>/);
});

test("Receita Perdida: sem 'AI' no título (agregação determinística, sem IA)", () => {
  const p = ler("app/receita-perdida/page.tsx");
  assert.match(p, /<AdminShell title="Receita Perdida"/);
  assert.doesNotMatch(p, /title="Receita Perdida AI"/);
});

test("SQLs pendentes: propostos, fora das migrations, fail-closed (não executados nesta missão)", () => {
  const limpeza = ler("sql/saneamento-pendente/limpeza-teste-dono-tenant-oficial-v1.sql");
  const ativoL = limpeza.replace(/--.*$/gm, "");
  assert.match(limpeza, /NÃO APLICADO\. Exige GO\./);
  assert.equal((ativoL.match(/\bdelete from\b/gi) ?? []).length, 2);
  assert.doesNotMatch(ativoL, /\b(drop|truncate|alter|update)\b/i);
  const seed = ler("sql/saneamento-pendente/demo-precos-catalogo-black-crown-v1.sql");
  assert.match(seed.replace(/--.*$/gm, ""), /s\.preco_centavos is null;/);
  for (const f of ["limpeza-teste-dono-tenant-oficial-v1.sql", "demo-precos-catalogo-black-crown-v1.sql"])
    assert.ok(!existe(`supabase/migrations/${f}`));
});

test("Dinheiro e Linha Econômica: período explícito e associação sem prometer causa (decisões 2026-09-29)", () => {
  const fin = ler("app/financeiro/page.tsx");
  assert.match(fin, />Total recebido · todo o histórico</);
  assert.match(fin, /comprovado\{[^}]*\} \(cobranças e pedidos pagos\)/);
  assert.doesNotMatch(fin, />Recebido comprovado</);
  const le = ler("app/linha-economica/page.tsx");
  assert.match(le, /subtitle="Resultado associado às ações registradas no OrganizaPro — com base nos registros, sem afirmar a causa"/);
  assert.match(le, />Pago depois do vencimento\. A associação vem dos registros e não prova a causa do pagamento\.</);
  assert.doesNotMatch(le, /causalidade da IA|nunca causalidade inventada/);
});
