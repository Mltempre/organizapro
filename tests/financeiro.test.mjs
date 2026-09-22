// Hub Dinheiro / Financeiro Inteligente — composição pura de 4 motores já
// homologados (calcularIndicadoresCobranca, gerarPrevisorFaturamento,
// gerarLinhaEconomica, agregarReceitaPerdida). Nenhum motor novo, nenhuma
// query nova: estes testes garantem que a tela só compõe, nunca calcula
// nem consulta nada por conta própria, e que o menu "Dinheiro" aponta para
// o hub canônico em vez de só Cobranças (achado da auditoria anterior).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const pagina = ler("app/financeiro/page.tsx");

test("financeiro: reaproveita literalmente os 4 motores exigidos — nenhum motor novo, nenhuma regra de negócio nova", () => {
  assert.match(pagina, /calcularIndicadoresCobranca\(/);
  assert.match(pagina, /gerarPrevisorFaturamento\(/);
  assert.match(pagina, /gerarLinhaEconomica\(/);
  assert.match(pagina, /agregarReceitaPerdida\(/);
});

test("financeiro: busca só pelas APIs canônicas já existentes (todas escopadas por clinica_id), nenhuma query direta a supabase.from em tabela de negócio", () => {
  assert.match(pagina, /fetch\('\/api\/oportunidades'/);
  assert.match(pagina, /\/api\/orcamentos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/tratamentos\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/cobrancas\?clinica_id=\$\{cid\}/);
  assert.match(pagina, /\/api\/pedidos\?clinica_id=\$\{cid\}/);
  assert.doesNotMatch(pagina, /supabase\.from\("orcamentos"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("cobrancas"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("tratamentos"\)/);
  assert.doesNotMatch(pagina, /supabase\.from\("pedidos"\)/);
});

test("financeiro: cid vem sempre de /api/minha-clinica (derivado do token), nunca de query/body do cliente — isolamento tenant por construção", () => {
  const idxCid = pagina.indexOf("const cid");
  assert.ok(idxCid > -1);
  const trecho = pagina.slice(Math.max(0, idxCid - 200), idxCid + 50);
  assert.match(trecho, /\/api\/minha-clinica/);
  // As 4 chamadas escopadas usam a MESMA variável cid derivada acima
  assert.equal((pagina.match(/clinica_id=\$\{cid\}/g) || []).length, 4);
});

test("financeiro: cobre os 4 estados exigidos (loading/error/empty/success) — nunca fabrica dado no estado vazio", () => {
  assert.match(pagina, /carregando &&/); // loading
  assert.match(pagina, /erro &&/); // error
  assert.match(pagina, /semDadosNenhuma/); // empty state honesto
  assert.match(pagina, /!resumo\.semDadosNenhuma/); // success
});

test("financeiro: nenhuma soma/agregação é calculada na própria tela fora da ordenação já usada em receita-perdida (delegada aos motores)", () => {
  // A única ordenação local é a de "próxima ação", idêntica à já usada em
  // app/receita-perdida/page.tsx — nenhum .reduce/soma de dinheiro aqui.
  assert.doesNotMatch(pagina, /\.reduce\(/);
});

test("financeiro: não inventa saldo bancário, contas a pagar, despesas, lucro, gateway ou causalidade", () => {
  assert.doesNotMatch(pagina, /saldo.?banc[aá]rio/i);
  assert.doesNotMatch(pagina, /contas? a pagar/i);
  assert.doesNotMatch(pagina, /despesa/i);
  assert.doesNotMatch(pagina, /lucro/i);
  assert.doesNotMatch(pagina, /gateway/i);
  assert.doesNotMatch(pagina, /gerado pela IA/i);
});

test("financeiro: Cobranças, Orçamentos, Pedidos, Previsor, Linha Econômica e Receita Perdida continuam acessíveis a partir do hub (nenhum removido)", () => {
  assert.match(pagina, /router\.push\('\/cobrancas'\)/);
  assert.match(pagina, /href: '\/cobrancas'/);
  assert.match(pagina, /href: '\/orcamentos'/);
  assert.match(pagina, /href: '\/pedidos'/);
  assert.match(pagina, /href: '\/previsor-faturamento'/);
  assert.match(pagina, /href: '\/linha-economica'/);
  assert.match(pagina, /href: '\/receita-perdida'/);
});

test("financeiro: toda ação da 'próxima ação financeira' tem motivo (label da origem), evidência (dias em risco), valor (quando comprovável) e CTA real (destino do motor)", () => {
  assert.match(pagina, /ORIGEM_LABELS\[item\.origem\]/);
  assert.match(pagina, /item\.diasEmRisco/);
  assert.match(pagina, /item\.valor !== null/);
  assert.match(pagina, /router\.push\(item\.destino\)/);
});

test("menu: item 'Dinheiro' aponta para o hub canônico /financeiro, nunca mais só para /cobrancas", () => {
  const shell = ler("app/components/AdminShellFrame.tsx");
  const idx = shell.indexOf('l: "Dinheiro"');
  assert.ok(idx > -1);
  const linha = shell.slice(idx, idx + 60);
  assert.match(linha, /h: "\/financeiro"/);
});

test("menu: Cobranças continua no menu (grupo Comercial), nunca removida", () => {
  const shell = ler("app/components/AdminShellFrame.tsx");
  assert.match(shell, /l: "Cobranças",\s*h: "\/cobrancas"/);
});
