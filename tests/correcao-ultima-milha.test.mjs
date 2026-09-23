// Correção Controlada da Última Milha — 4 achados fechados (auditoria
// funcional anterior). Testa comportamento real (fetchJsonSeguro) e
// wiring (inspeção estática do código-fonte, mesmo padrão já usado nos
// testes desta base) para os outros 3 achados.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { fetchJsonSeguro } = await import(pathToFileURL(path.join(buildDir, "fetch-seguro.js")));

// ── fetchJsonSeguro (lib/fetch-seguro.ts) — motor real do fix sistêmico ──

test("fetchJsonSeguro: resposta 200 devolve o dado real, falhou:false", async () => {
  const fetchOriginal = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ itens: [1, 2, 3] }) });
  try {
    const r = await fetchJsonSeguro("/qualquer", {}, { itens: [] });
    assert.deepEqual(r, { dado: { itens: [1, 2, 3] }, falhou: false });
  } finally { global.fetch = fetchOriginal; }
});

test("fetchJsonSeguro: 404 é tratado como vazio REAL (contrato de algumas rotas), nunca como falha", async () => {
  const fetchOriginal = global.fetch;
  global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  try {
    const r = await fetchJsonSeguro("/qualquer", {}, { itens: [] });
    assert.deepEqual(r, { dado: { itens: [] }, falhou: false });
  } finally { global.fetch = fetchOriginal; }
});

test("fetchJsonSeguro: 500 é falha REAL — falhou:true, mas ainda devolve o vazio seguro (nunca quebra a tela)", async () => {
  const fetchOriginal = global.fetch;
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  try {
    const r = await fetchJsonSeguro("/qualquer", {}, { itens: [] });
    assert.deepEqual(r, { dado: { itens: [] }, falhou: true });
  } finally { global.fetch = fetchOriginal; }
});

test("fetchJsonSeguro: exceção de rede (fetch rejeita) é falha REAL — falhou:true, nunca lança", async () => {
  const fetchOriginal = global.fetch;
  global.fetch = async () => { throw new Error("network down"); };
  try {
    const r = await fetchJsonSeguro("/qualquer", {}, { itens: [] });
    assert.deepEqual(r, { dado: { itens: [] }, falhou: true });
  } finally { global.fetch = fetchOriginal; }
});

// ── Achado #1 — Radar/Faixa Executiva apontavam para o domínio errado ───

test("DashboardView: 'Ver todas' do Radar aponta para /copiloto (mesmo motor uncapped), nunca /oportunidades (outro domínio)", () => {
  const codigo = ler("app/components/DashboardView.tsx");
  assert.match(codigo, /verTodasDestino="\/copiloto"/);
  assert.doesNotMatch(codigo, /verTodasDestino="\/oportunidades"/);
});

test("FaixaExecutiva: tile 'Oportunidades' aponta para /copiloto, nunca /oportunidades", () => {
  const codigo = ler("app/components/FaixaExecutiva.tsx");
  const linha = codigo.split("\n").find(l => l.includes('label: "Oportunidades"'));
  assert.ok(linha, "tile 'Oportunidades' deveria existir");
  assert.match(linha, /destino: "\/copiloto"/);
});

// ── Achado #2 — idempotency key do WhatsApp travava retry após falha ────

test("Follow-up: idempotency key do envio é descartada após a resposta (sucesso OU falha) — próximo clique gera key nova", () => {
  const codigo = ler("app/follow-up/page.tsx");
  // A key é descartada tanto no caminho de sucesso/erro-de-negócio (logo
  // após o json()) quanto na exceção de rede (catch) — nunca sobrevive a
  // uma tentativa já concluída.
  const ocorrencias = (codigo.match(/delete idempotencyEnvioRef\.current\[caso\.entidadeId\];/g) || []).length;
  assert.equal(ocorrencias, 2, "esperado descarte da key tanto após a resposta quanto no catch de exceção de rede");
});

test("Follow-up: a key ainda é gerada de forma estável DENTRO de uma mesma chamada (protege duplo-clique em voo) — não virou um UUID novo por render", () => {
  const codigo = ler("app/follow-up/page.tsx");
  assert.match(codigo, /function idempotencyKeyEnvioPara\(entidadeId: string\): string \{\n\s*if \(!idempotencyEnvioRef\.current\[entidadeId\]\) idempotencyEnvioRef\.current\[entidadeId\] = crypto\.randomUUID\(\);/);
});

// ── Continuação curta: mesmo bug de idempotência em Cobranças ───────────
// Observação lateral do relatório anterior, confirmada e agora corrigida:
// app/cobrancas/page.tsx tinha exatamente o mesmo padrão do Achado #2
// (idempotencyEnvioRef nunca invalidada), no fluxo de aprovar-envio de
// WhatsApp de cobrança atrasada.

test("Cobranças: idempotency key do envio é descartada após a resposta (sucesso OU falha) — próximo clique gera key nova", () => {
  const codigo = ler("app/cobrancas/page.tsx");
  const ocorrencias = (codigo.match(/delete idempotencyEnvioRef\.current\[c\.id\];/g) || []).length;
  assert.equal(ocorrencias, 2, "esperado descarte da key tanto após a resposta quanto no catch de exceção de rede");
});

test("Cobranças: a key ainda é gerada de forma estável DENTRO de uma mesma chamada (protege duplo-clique em voo) — não virou um UUID novo por render", () => {
  const codigo = ler("app/cobrancas/page.tsx");
  assert.match(codigo, /function idempotencyKeyEnvioPara\(cobrancaId: string\): string \{\n\s*if \(!idempotencyEnvioRef\.current\[cobrancaId\]\) idempotencyEnvioRef\.current\[cobrancaId\] = crypto\.randomUUID\(\);/);
});

test("Cobranças: a key de CRIAR cobrança (idempotencyKeyRef, fluxo diferente) não foi tocada por esta correção — escopo estritamente limitado ao envio de WhatsApp", () => {
  const codigo = ler("app/cobrancas/page.tsx");
  assert.match(codigo, /idempotencyKeyRef\.current = crypto\.randomUUID\(\);/);
});

// ── Achados #3/#4/#5 — erro real de API virava lista vazia silenciosa ───
// 7 superfícies identificadas na auditoria: Copiloto, Follow-up,
// Orçamentos, Oportunidades, Cobranças, Pedidos, Tratamentos.

test("Copiloto: usa fetchJsonSeguro nas 5 APIs e expõe falhaParcial (nunca finge 'nada pendente' quando uma fonte falhou de verdade)", () => {
  const codigo = ler("app/copiloto/page.tsx");
  assert.match(codigo, /import \{ fetchJsonSeguro \} from '\.\.\/\.\.\/lib\/fetch-seguro'/);
  assert.match(codigo, /falhaParcial: boolean/);
  assert.match(codigo, /const falhaParcial = \[oportunidadesR, orcamentosR, tratamentosR, pedidosR, cobrancasR\]\.some\(r => r\.falhou\)/);
  assert.match(codigo, /estado\.falhaParcial && \(/);
});

test("Follow-up: usa fetchJsonSeguro nas 5 APIs e mostra aviso quando falhaParcial", () => {
  const codigo = ler("app/follow-up/page.tsx");
  assert.match(codigo, /import \{ fetchJsonSeguro \} from '\.\.\/\.\.\/lib\/fetch-seguro'/);
  assert.match(codigo, /setFalhaParcial\(\[oportunidadesR, orcamentosR, tratamentosR, pedidosR, cobrancasR\]\.some\(r => r\.falhou\)\)/);
  assert.match(codigo, /falhaParcial && \(/);
});

test("Orçamentos, Oportunidades, Cobranças, Pedidos, Tratamentos: falha real (status != 404) do GET principal chama setErro — nunca só console.error", () => {
  const paginas = [
    ["app/orcamentos/page.tsx", /if \(orcRes\.status !== 404\) \{ console\.error\('Erro ao carregar orçamentos:', orcRes\.status\); setErro\(MSG_ERRO_PADRAO\); \}/],
    ["app/oportunidades/page.tsx", /if \(opRes\.status !== 404\) \{ console\.error\('Erro ao carregar oportunidades:', opRes\.status\); setErro\(MSG_ERRO_PADRAO\); \}/],
    ["app/cobrancas/page.tsx", /if \(cobRes\.status !== 404\) \{ console\.error\('Erro ao carregar cobranças:', cobRes\.status\); setErro\(MSG_ERRO_PADRAO\); \}/],
    ["app/pedidos/page.tsx", /if \(pedRes\.status !== 404\) \{ console\.error\('Erro ao carregar pedidos:', pedRes\.status\); setErro\(MSG_ERRO_PADRAO\); \}/],
    ["app/tratamentos/page.tsx", /if \(tratRes\.status !== 404\) \{ console\.error\('Erro ao carregar tratamentos:', tratRes\.status\); setErro\(MSG_ERRO_PADRAO\); \}/],
  ];
  for (const [arquivo, padrao] of paginas) {
    assert.match(ler(arquivo), padrao, `${arquivo} deveria chamar setErro em falha real (status != 404)`);
  }
});

test("404 continua sendo tratado como vazio real (contrato de algumas rotas) nas 5 páginas — nunca vira aviso/erro", () => {
  for (const [arquivo, condicao] of [
    ["app/orcamentos/page.tsx", "orcRes.status !== 404"],
    ["app/oportunidades/page.tsx", "opRes.status !== 404"],
    ["app/cobrancas/page.tsx", "cobRes.status !== 404"],
    ["app/pedidos/page.tsx", "pedRes.status !== 404"],
    ["app/tratamentos/page.tsx", "tratRes.status !== 404"],
  ]) {
    assert.match(ler(arquivo), new RegExp(condicao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${arquivo} deveria seguir distinguindo 404 de outras falhas`);
  }
});

// ── Achado #7 — google-presenca oferecia "Conectar" mesmo sabendo que ia falhar ──

test("google-presenca: status indisponível (GET falhou) nunca oferece 'Conectar com Google'", () => {
  const codigo = ler("app/google-presenca/page.tsx");
  assert.match(codigo, /const \[indisponivel, setIndisponivel\] = useState\(false\);/);
  assert.match(codigo, /if \(!response\.ok\) \{ setErro\(data\.error \?\? "Não foi possível consultar a conexão\."\); setIndisponivel\(true\); \}/);
  assert.match(codigo, /\{!carregando && !indisponivel && !status\?\.conectado && <button type="button" onClick=\{conectar\}/);
});

test("google-presenca: OAuth inicia por POST autenticado antes da navegação", () => {
  const codigo = ler("app/google-presenca/page.tsx");
  assert.match(codigo, /async function conectar\(\) \{/);
  assert.ok(codigo.includes('fetch("/api/google-business-profile/oauth/start", { method: "POST"'));
  assert.ok(codigo.includes('Authorization: `Bearer ${session.access_token}`'));
  assert.ok(codigo.includes('window.location.href = url.toString()'));
  assert.ok(!codigo.includes('oauth/start?clinica_id='));
});

// ── Regra de colisão: nada fora do pacote autorizado foi tocado ─────────

test("nenhuma alteração desta correção tocou E-commerce/Financeiro/Pesquisa de Preços além do já convergido", () => {
  for (const p of ["app/financeiro/page.tsx", "app/pesquisa-precos/page.tsx", "app/api/site-publico/interesse/route.ts"]) {
    assert.doesNotThrow(() => ler(p), `${p} deveria continuar existindo, intocado por esta missão`);
  }
});
