// Casa Premium — Correção Visual Final V1. Verificação estática: prova
// que a lateral foi reorganizada em grupos com rotas reais (nenhuma
// inventada), que a Home ficou objetivamente mais enxuta (Radar resumido
// = 3 + link, blocos redundantes removidos), que o mobile continua com
// UMA única barra lateral (drawer), e que nenhum score/índice foi
// fabricado. A seção "Prioridade do Dia = 1 item" desta missão foi
// deliberadamente revertida pela P1 IMEDIATO (Reintegrar a Inteligência)
// — ver comentário mais abaixo.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

// Gate Funcional da Navegação V1: a sidebar/nav foi extraída de AdminShell.tsx
// (agora um shim leve) para AdminShellFrame.tsx (chrome persistente, montada
// uma única vez via ShellGate em app/layout.tsx) — testes de estrutura da
// navegação passam a ler o novo arquivo.
const adminShell = ler("app/components/AdminShellFrame.tsx");
const dashboardView = ler("app/components/DashboardView.tsx");
const missaoDoDiaCard = ler("app/components/MissaoDoDiaCard.tsx");
const radar = ler("app/components/RadarDeOportunidades.tsx");

// ── Lateral agrupada — nenhuma rota inventada ────────────────────────────

test("AdminShell: navegação agrupada em exatamente 5 áreas (Início/Comercial/Operação/Presença/Inteligência)", () => {
  for (const titulo of ["Início", "Comercial", "Operação", "Presença", "Inteligência"]) {
    assert.match(adminShell, new RegExp(`titulo: "${titulo}"`), `grupo ausente: ${titulo}`);
  }
  const totalGrupos = (adminShell.match(/titulo: "/g) ?? []).length;
  assert.equal(totalGrupos, 5);
});

test("AdminShell: TODA rota citada na navegação lateral corresponde a uma page.tsx real (nenhuma rota inventada)", () => {
  const hrefs = [...adminShell.matchAll(/h: "(\/[a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 20, "esperava pelo menos 20 itens de navegação (5 grupos + configurações)");
  const unicos = new Set(hrefs);
  for (const href of unicos) {
    const caminho = path.join(root, "app", href.replace(/^\//, ""), "page.tsx");
    assert.ok(fs.existsSync(caminho), `rota sem page.tsx real: ${href}`);
  }
});

test("AdminShell: páginas antes reais mas ausentes de qualquer menu (Follow-up, Google Presença, Agenda Autônoma, Previsor de Faturamento, Linha Econômica, NotaFácil) agora estão alcançáveis pela lateral", () => {
  for (const href of ["/follow-up", "/google-presenca", "/agenda-autonoma", "/previsor-faturamento", "/linha-economica", "/notafacil"]) {
    assert.match(adminShell, new RegExp(`h: "${href.replace("/", "\\/")}"`), `${href} deveria estar na navegação agora`);
  }
});

test("AdminShell: continua UMA única barra lateral (aside), com drawer/hamburger responsivo em mobile — nunca duas sidebars simultâneas", () => {
  const codigoReal = adminShell.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  const totalAside = (codigoReal.match(/<aside/g) ?? []).length;
  assert.equal(totalAside, 1, "deveria haver exatamente um <aside> (uma única barra lateral)");
  assert.match(adminShell, /@media \(max-width: 767px\)/);
  assert.match(adminShell, /transform: translateX\(-100%\)/);
  assert.match(adminShell, /ash-hamburger/);
});

// ── Home muito mais enxuta ────────────────────────────────────────────────
//
// P1 IMEDIATO — Reintegrar a Inteligência (superscede as duas asserções
// originais desta seção): a decisão de produto da Correção Visual Final
// V1 de reduzir este bloco a 1 sinal ("Prioridade do Dia") foi revertida
// deliberadamente — a auditoria confirmou que isso escondia a Missão do
// Dia/Próxima Melhor Ação, que a P1 exige reintegrar. O bloco volta a se
// chamar "Diretor Digital" (título padrão de MissaoDoDiaCard) e a
// receber a lista completa de sinais (top-3, já limitado dentro de
// gerarMissaoDoDia — nunca um novo slice aqui), agora com o pulso da
// Central de Oportunidades (contagemPorTier) reconectado.

test("Diretor Digital: Home passa a lista completa de missaoDoDia (já limitada a 3 por gerarMissaoDoDia), nunca um slice(0,1) novo", () => {
  assert.match(dashboardView, /sinais=\{missaoDoDia\}/);
  assert.doesNotMatch(dashboardView, /sinais=\{missaoDoDia\.slice/);
});

test("Diretor Digital: recebe o pulso da Central de Oportunidades (contagemPorTier) — reconecta a Central sem duplicar a grade completa", () => {
  const idx = dashboardView.indexOf("<MissaoDoDiaCard");
  const trecho = dashboardView.slice(idx, idx + 300);
  assert.match(trecho, /contagemPorTier=\{contagemPorTier\}/);
});

test("Radar de Oportunidades: Home passa limite={3} e verTodasDestino real — resumo, não o motor inteiro", () => {
  const idx = dashboardView.indexOf("<RadarDeOportunidades");
  const trecho = dashboardView.slice(idx, idx + 300);
  assert.match(trecho, /limite=\{3\}/);
  assert.match(trecho, /verTodasDestino="\/oportunidades"/);
});

test("RadarDeOportunidades: com limite, mostra só os N primeiros (ordem já calculada preservada) e um link 'Ver todas' quando há mais", () => {
  assert.match(radar, /const exibidas = limite \? oportunidades\.slice\(0, limite\) : oportunidades;/);
  assert.match(radar, /restantes > 0 && verTodasDestino/);
});

test("Home não renderiza mais: Resumo da IA, Foco do Dia/Próximos 7 Dias, Lembretes, Objetivos do Dia, Agora/Próxima Melhor Ação, Diretor Digital completo (DiretorDigitalCard)", () => {
  // Comentários explicando O QUE foi removido (e por quê) podem mencionar
  // esses nomes em prosa — só o JSX/render real precisa estar livre deles.
  const codigoReal = dashboardView.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  for (const termo of ["💬 Resumo da IA", "🎯 Foco do Dia", "📆 Próximos 7 Dias", "⚠️ Lembretes", "✅ Objetivos do Dia", "<ProximaMelhorAcao", "<DiretorDigitalCard"]) {
    assert.doesNotMatch(codigoReal, new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `"${termo}" não deveria mais aparecer na Home`);
  }
});

// Atualizado — Convergência dos Amarelos/Órfãos: ao contrário dos demais
// itens desta lista (cuja remoção era redundância de UX real, com a
// função já reintegrada em outro lugar), Central de Oportunidades tinha
// virado uma capacidade real sem NENHUMA superfície — o pulso mostrava
// "🔴 3" sem nenhum jeito de saber o quê ou agir. Volta a renderizar,
// gated por ter item real (nunca grade vazia decorativa).
test("CentralDeOportunidadesCard voltou a renderizar na Home, só quando há oportunidade real (mesmo dado que já gerava o pulso do Diretor Digital)", () => {
  assert.match(dashboardView, /<CentralDeOportunidadesCard central={central} onNavigate={onNavigate} \/>/);
});

test("nenhum motor foi apagado: ProximaMelhorAcao.tsx, DiretorDigitalCard.tsx e CentralDeOportunidades.tsx continuam no repositório", () => {
  for (const arquivo of ["app/components/ProximaMelhorAcao.tsx", "app/components/DiretorDigitalCard.tsx", "app/components/CentralDeOportunidades.tsx", "app/components/IndicadoresExecutivos.tsx"]) {
    assert.ok(fs.existsSync(path.join(root, arquivo)), `${arquivo} não deveria ter sido apagado`);
  }
});

// ── Métrica única — proibido inventar score ──────────────────────────────

test("nenhum 'Índice OrganizaPro' ou score 0-100 decorativo foi criado — a única métrica executiva principal é ocupacaoPct, já real e determinística", () => {
  for (const arquivo of [dashboardView]) {
    assert.doesNotMatch(arquivo, /[íi]ndice organizapro/i);
    assert.doesNotMatch(arquivo, /score.{0,20}0.{0,3}100/i);
  }
});

// ── Faixa Executiva consolidada (Bloco C) ────────────────────────────────

test("FaixaExecutiva agora inclui avaliacoesPendentes (5º indicador) — consolidação com o antigo bloco Indicadores Executivos", () => {
  const faixaExecutiva = ler("app/components/FaixaExecutiva.tsx");
  assert.match(faixaExecutiva, /avaliacoesPendentes: number;/);
  assert.match(faixaExecutiva, /destino: "\/reputacao"/);
});
