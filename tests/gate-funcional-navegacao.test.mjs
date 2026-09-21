// Gate Funcional da Navegação V1 — verificação estática. Prova a causa
// raiz encontrada na auditoria funcional E2E (sidebar remontava a cada
// navegação porque AdminShell.tsx era instanciado dentro de cada
// page.tsx, sem layout.tsx compartilhado) e as duas classes de bug real
// confirmadas ao vivo via console do navegador headless:
// 1) "Maximum update depth exceeded" — loop infinito no useEffect sem
//    array de dependências do shim AdminShell.tsx (era o indicador
//    vermelho "1 Issue" relatado pelo Capitão).
// 2) Página em branco (sem erro, sem empty state) quando o usuário
//    autenticado não tem clinica_id vinculado, em receita-perdida/
//    previsor-faturamento/linha-economica.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (codigo) => codigo.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

const adminShell = ler("app/components/AdminShell.tsx");
const adminShellFrame = ler("app/components/AdminShellFrame.tsx");
const shellGate = ler("app/components/ShellGate.tsx");
const rootLayout = ler("app/layout.tsx");
const googlePresenca = ler("app/google-presenca/page.tsx");
const notafacil = ler("app/notafacil/page.tsx");
const receitaPerdida = ler("app/receita-perdida/page.tsx");
const previsorFaturamento = ler("app/previsor-faturamento/page.tsx");
const linhaEconomica = ler("app/linha-economica/page.tsx");

// ── Causa raiz: sidebar persistente via layout, não remontada por página ──

test("app/layout.tsx (raiz real do Next.js, nunca desmonta entre navegações) usa ShellGate envolvendo {children}", () => {
  assert.match(rootLayout, /import ShellGate from "\.\/components\/ShellGate"/);
  assert.match(rootLayout, /<ShellGate>\{children\}<\/ShellGate>/);
});

test("ShellGate decide pela rota atual (usePathname), nunca por estado de autenticação — decisão puramente estrutural", () => {
  assert.match(shellGate, /usePathname/);
  assert.doesNotMatch(shellGate, /supabase\.auth/);
});

test("ROTAS_COM_SHELL é derivada de navGrupos (única fonte de verdade) — nunca uma segunda lista hardcoded duplicando o menu", () => {
  assert.match(adminShellFrame, /export const ROTAS_COM_SHELL[\s\S]{0,80}navGrupos\.flatMap/);
});

test("AdminShell.tsx (shim por página) NUNCA renderiza a sidebar (<aside>) — só existe em AdminShellFrame.tsx", () => {
  assert.doesNotMatch(semComentarios(adminShell), /<aside/);
  assert.match(adminShellFrame, /<aside/);
});

test("AdminShell.tsx continua com a mesma assinatura pública (title, subtitle, actionLabel, actionOnClick, children) — nenhuma página precisou mudar", () => {
  assert.match(adminShell, /title: string;/);
  assert.match(adminShell, /subtitle\?: string;/);
  assert.match(adminShell, /actionLabel\?: string;/);
  assert.match(adminShell, /actionOnClick\?: \(\) => void;/);
  assert.match(adminShell, /children: ReactNode;/);
});

// ── Bug real #1: loop infinito ("Maximum update depth exceeded") ────────

test("AdminShell.tsx: o useEffect que empurra o header via Context tem array de dependências (nunca roda em todo render) — regressão do loop infinito confirmado ao vivo (indicador vermelho '1 Issue')", () => {
  const idxEffect = adminShell.indexOf("useEffect(() => {");
  const trecho = adminShell.slice(idxEffect, idxEffect + 400);
  assert.match(trecho, /setHeader\(\{ title, subtitle, actionLabel, actionOnClick \}\)/);
  assert.match(trecho, /\}, \[title, subtitle, actionLabel, actionOnClick\]\);/);
});

test("AdminShellFrame.tsx: setHeader descarta atualização quando o conteúdo é idêntico (defesa em profundidade contra o mesmo loop, mesmo se o shim regredir)", () => {
  assert.match(adminShellFrame, /atual\.title === novo\.title/);
  assert.match(adminShellFrame, /\? atual\s*\n?\s*: novo/);
});

// ── Bug real #2: página em branco quando clinica_id ausente ─────────────

test("receita-perdida/previsor-faturamento/linha-economica: quando não há clinica_id vinculado, define uma mensagem de erro real — nunca deixa erro E resumo vazios ao mesmo tempo (tela em branco)", () => {
  for (const [nome, codigo] of [["receita-perdida", receitaPerdida], ["previsor-faturamento", previsorFaturamento], ["linha-economica", linhaEconomica]]) {
    const idx = codigo.indexOf("if (!cid)");
    const trecho = codigo.slice(idx, idx + 120);
    assert.match(trecho, /setErro\(/, `${nome}: !cid deveria definir uma mensagem de erro`);
  }
});

test("receita-perdida/previsor-faturamento/linha-economica: o render só mostra Feedback OU o conteúdo — nunca fica sem nenhum dos dois quando carregando=false", () => {
  for (const [nome, codigo] of [["receita-perdida", receitaPerdida], ["previsor-faturamento", previsorFaturamento], ["linha-economica", linhaEconomica]]) {
    assert.match(codigo, /\{!carregando && erro && <Feedback/, `${nome}: deveria ter um caminho de erro visível`);
  }
});

// ── Google Presença obrigatório na navegação (shell oficial) ────────────

test("google-presenca usa o shell oficial (AdminShell) — antes desta missão não usava nenhum", () => {
  assert.match(googlePresenca, /import AdminShell from "\.\.\/components\/AdminShell"/);
  assert.match(googlePresenca, /<AdminShell title="Google Presença"/);
});

test("google-presenca continua na navegação lateral (grupo Presença)", () => {
  assert.match(adminShellFrame, /h: "\/google-presenca"/);
});

test("google-presenca: nenhum <main> aninhado dentro do shell (AdminShellFrame já fornece o <main> da área de conteúdo)", () => {
  assert.doesNotMatch(semComentarios(googlePresenca), /<main/);
});

// ── NotaFácil também estava sem shell (achado adicional da auditoria) ───

test("notafacil usa o shell oficial (AdminShell) — mesma classe de bug do google-presenca, encontrada na mesma auditoria", () => {
  assert.match(notafacil, /import AdminShell from "\.\.\/components\/AdminShell"/);
  assert.match(notafacil, /<AdminShell title="NotaFácil Inteligente"/);
});

test("notafacil: nenhum <main> aninhado dentro do shell", () => {
  assert.doesNotMatch(semComentarios(notafacil), /<main/);
});

// ── Nenhuma rota real ficou sem cobertura de shell (staff pages) ────────

test("toda página que já usava <AdminShell> antes desta missão continua usando (nenhuma regressão de remoção)", () => {
  const paginasEsperadas = [
    "app/dashboard/page.tsx", "app/clientes/page.tsx", "app/oportunidades/page.tsx",
    "app/orcamentos/page.tsx", "app/cobrancas/page.tsx", "app/agendamentos/page.tsx",
    "app/tratamentos/page.tsx", "app/pedidos/page.tsx", "app/follow-up/page.tsx",
    "app/agenda-autonoma/page.tsx", "app/chatbot/page.tsx", "app/automacao/page.tsx",
    "app/reputacao/page.tsx", "app/site/page.tsx", "app/conteudo/page.tsx",
    "app/metricas/page.tsx", "app/raio-x/page.tsx", "app/previsor-faturamento/page.tsx",
    "app/linha-economica/page.tsx", "app/receita-perdida/page.tsx", "app/configuracoes/page.tsx",
  ];
  for (const p of paginasEsperadas) {
    assert.match(ler(p), /AdminShell/, `${p} deveria continuar usando AdminShell`);
  }
});
