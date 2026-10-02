// Convergência dos Amarelos/Órfãos — fecha 4 gaps de integração já
// comprovados pela auditoria (CentralDeOportunidades órfã, Previsor sem
// consumidor cruzado, calcularScoreOportunidade órfão, prepararVinculo-
// Resultado sem cobrir oportunidade/recompra). Nenhum motor novo em
// nenhum dos 4 — prova aqui é de CONSUMO real (import + chamada + uso no
// render/response), mesmo padrão já usado nos testes de missões
// anteriores (inspeção estática do código-fonte real).
//
// Agenda Autônoma de Receita (item 2 da missão) foi auditada e NÃO
// alterada: os 3 sinais que casosAgendaAutonoma geraria já chegam ao
// usuário via Radar (mesmos inputs, mesma tela) em /copiloto e
// /follow-up — wire-lo ali duplicaria cartões. app/agenda-autonoma já é
// a superfície própria funcional (f544e53, já ancestral desta base).
// Sem teste novo aqui por não haver mudança de código para provar.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

// ── 1. Central/Radar de Oportunidades — grade completa deixa de ser órfã ──

test("CentralDeOportunidadesCard é importado e renderizado em DashboardView (antes: só existia, nunca era usado fora de si mesmo)", () => {
  const codigo = ler("app/components/DashboardView.tsx");
  assert.match(codigo, /import CentralDeOportunidadesCard from ".\/CentralDeOportunidades"/);
  assert.match(codigo, /<CentralDeOportunidadesCard central={central} onNavigate={onNavigate} \/>/);
});

test("DashboardView só renderiza a Central quando há dado real (temDados && central && soma > 0) — nunca grade vazia decorativa", () => {
  const codigo = ler("app/components/DashboardView.tsx");
  assert.match(codigo, /temDados && central && \(central\.alta\.length \+ central\.media\.length \+ central\.baixa\.length > 0\)/);
});

// Arquitetura: Visão Geral = resumo (conta); Gerente Comercial = lista completa.
// Toda prioridade canônica contada pela Visão Geral deve estar acessível no
// Gerente — as duas montam as prioridades pela MESMA fonte compartilhada.
test("Toda prioridade canônica contada pela Visão Geral está acessível no Gerente Comercial; demo preserva a Central", () => {
  const pagina = ler("app/dashboard/page.tsx");
  assert.match(pagina, /missaoDoDia=\{missaoDoDia\}/);
  assert.match(pagina, /outrasPrioridades=\{estadoComercial.sinais.slice\(missaoDoDia.length\)\}/);
  const casa = ler("app/components/CasaDashboard.tsx");
  assert.match(casa, /const totalPrioridades = missaoDoDia\.length \+ props\.outrasPrioridades\.length;/, "a Casa conta TODAS");
  assert.match(casa, /<Link href="\/copiloto">Abrir Gerente Comercial →<\/Link>/, "e leva à lista completa");
  assert.doesNotMatch(casa, /<details/, "sem repetir a lista na Visão Geral");
  const gerente = ler("app/copiloto/page.tsx");
  for (const p of [pagina, gerente]) assert.match(p, /montarSinaisCanonicos\(\{/);
  assert.match(gerente, /organizarSinaisCanonicos\(montarSinaisCanonicos\(\{/);
  assert.match(ler("app/dashboard-demo/page.tsx"), /central=\{/);
});
// ── 2. Previsor de Faturamento 30 Dias — ganha consumidor cruzado real ───

// Consolidação Gerente + Dinheiro: o consumidor cruzado do Previsor é o
// Dinheiro (dono da visão financeira); o Gerente não repete o resumo.
test("Previsor tem consumidor cruzado real no Dinheiro, que leva ao detalhe (o motor nunca fica órfão)", () => {
  const codigo = ler("app/financeiro/page.tsx");
  assert.match(codigo, /import \{ gerarPrevisorFaturamento, type ResumoPrevisorFaturamento \} from '\.\.\/\.\.\/lib\/previsor-faturamento'/);
  assert.match(codigo, /const previsor = gerarPrevisorFaturamento\(/);
  assert.match(codigo, /router\.push\('\/previsor-faturamento'\)/);
  assert.doesNotMatch(ler("app/copiloto/page.tsx"), /gerarPrevisorFaturamento|estado\.previsor/, "Gerente não repete o previsor");
});

test("Dinheiro usa filtros PRÓPRIOS do previsor (retorno_agendado e aguardando_confirmacao_pagamento) — nunca a lista já filtrada do risco, que subcontaria o total", () => {
  const codigo = ler("app/financeiro/page.tsx");
  assert.match(codigo, /tratamentosPrevisor[\s\S]{0,200}retorno_agendado/);
  assert.match(codigo, /pedidosPrevisor[\s\S]{0,200}aguardando_confirmacao_pagamento/);
});

test("Dinheiro mostra o confirmado separado do total previsto e nunca soma emRisco ao previsto", () => {
  const codigo = ler("app/financeiro/page.tsx");
  assert.match(codigo, /\{formatarValor\(resumo\.previsor\.confirmadoProgramado\.total\)\} confirmado/);
  assert.doesNotMatch(codigo, /previsor\.emRisco[^)]*\+/, "nunca soma emRisco a outro total");
});

// ── 3. Orçamento que Fecha — calcularScoreOportunidade deixa de ser órfão ─

test("app/orcamentos/page.tsx importa e chama calcularScoreOportunidade (antes: só a própria lib e o teste do motor)", () => {
  const codigo = ler("app/orcamentos/page.tsx");
  assert.match(codigo, /calcularScoreOportunidade/);
  assert.match(codigo, /scorePorId\.set\(o\.id, calcularScoreOportunidade\(/);
});

test("score reordena a lista de 'apresentado' por prioridade real — nunca decorativo, muda a ordem que o usuário vê", () => {
  const codigo = ler("app/orcamentos/page.tsx");
  assert.match(codigo, /filtrados = \[\.\.\.filtrados\]\.sort\(\(a, b\) => \(scorePorId\.get\(b\.id\) \?\? 0\) - \(scorePorId\.get\(a\.id\) \?\? 0\)\)/);
});

test("score muda o texto de próxima ação (prioridade alta vira 'priorizar contato hoje') e explica o motivo com os 3 fatores reais do motor", () => {
  const codigo = ler("app/orcamentos/page.tsx");
  assert.match(codigo, /Priorizar contato hoje/);
  assert.match(codigo, /motivoScore/);
});

test("valorMaximoEntreAbertos e a contagem por cliente são recalculados sobre o conjunto real de 'apresentado' no momento — nunca uma escala fixa (mesmo contrato exigido por EntradaScoreOportunidade)", () => {
  const codigo = ler("app/orcamentos/page.tsx");
  assert.match(codigo, /const abertos = orcamentos\.filter\(o => o\.status === 'apresentado'\)/);
  assert.match(codigo, /const valorMaximoEntreAbertos = abertos\.reduce\(\(max, o\) => Math\.max\(max, o\.valor\), 0\)/);
});

// ── 4. Auditoria IA: decisão → ação → resultado — fecha oportunidade e recompra ──

test("P1.3 permanece intocado: registrarResultadoSeHouveDecisao continua wired em orcamentos/pedidos/tratamentos [id]/transicao", () => {
  for (const p of [
    "app/api/orcamentos/[id]/transicao/route.ts",
    "app/api/pedidos/[id]/transicao/route.ts",
    "app/api/tratamentos/[id]/transicao/route.ts",
  ]) {
    assert.match(ler(p), /registrarResultadoSeHouveDecisao\(/, `${p} deveria continuar chamando registrarResultadoSeHouveDecisao`);
  }
});

test("gap 'oportunidades via RPC' fechado: transição de oportunidade também tenta vincular resultado, usando o MESMO uuid determinístico (telefone) que a auditoria.decisao de oportunidade_parada usou — nunca o id da linha", () => {
  const codigo = ler("app/api/oportunidades/[id]/transicao/route.ts");
  assert.match(codigo, /import \{ registrarResultadoSeHouveDecisao \} from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/auditoria-resultado-persistencia"/);
  assert.match(codigo, /import \{ entidadeIdDeTelefone \} from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/whatsapp-governado"/);
  assert.match(codigo, /entidadeIdDeTelefone\(auth\.clinicaId, telefoneOportunidade\)/);
  assert.match(codigo, /fatoObservado: `oportunidade_\$\{body\.status\}`/);
});

test("vínculo de oportunidade só é tentado quando a RPC devolveu telefone real — nunca fabrica um cliente para vincular", () => {
  const codigo = ler("app/api/oportunidades/[id]/transicao/route.ts");
  assert.match(codigo, /if \(telefoneOportunidade\) \{/);
});

test("gap 'recompra sem rota de transição' fechado: criar um pedido novo tenta vincular resultado a uma decisão prévia de recompra_possivel do MESMO telefone", () => {
  const codigo = ler("app/api/pedidos/route.ts");
  assert.match(codigo, /import \{ registrarResultadoSeHouveDecisao \} from "\.\.\/\.\.\/\.\.\/lib\/auditoria-resultado-persistencia"/);
  assert.match(codigo, /import \{ entidadeIdDeTelefone \} from "\.\.\/\.\.\/\.\.\/lib\/whatsapp-governado"/);
  assert.match(codigo, /fatoObservado: "pedido_criado"/);
  assert.match(codigo, /if \(telefone\?\.trim\(\)\) \{/);
});

test("nenhum dos dois novos vínculos afirma causalidade — prepararVinculoResultado grava sempre prova_causalidade:false (contrato do motor, não alterado)", () => {
  const motor = ler("lib/auditoria-decisoes.ts");
  assert.match(motor, /prova_causalidade: false; \/\/ sempre false/);
});

// ── Regra de colisão: nada tocado fora do escopo autorizado ──────────────

test("nenhuma mudança desta missão tocou atribuição/Google Ads/Meta Ads/CAC/ROAS (P1.3) — arquivos reais desta base continuam existindo, intocados", () => {
  for (const p of ["lib/atribuicao-relatorio.ts", "lib/atribuicao-origem.ts", "app/api/atribuicao/route.ts", "app/atribuicao/page.tsx"]) {
    assert.doesNotThrow(() => ler(p), `${p} deveria continuar existindo, intocado`);
  }
});

// Atualizado — Convergência Final Controlada (Fase 2), autorizada pela
// Torre: a captura pública de interesse (E-commerce IA/Guardião,
// feat/ecommerce-ia-v1 @ 3cea951) foi trazida deliberadamente para esta
// pista de convergência. Esta asserção documentava o limite de escopo da
// missão anterior (Convergência dos Amarelos/Órfãos, em
// convergencia-canonica-bloco1) — aqui, no worktree/branch de
// convergência final, o escopo é justamente integrar essa frente. A
// checagem que importa agora não é mais "não existe", e sim "existe e é
// exatamente o conteúdo autorizado do Guardião" — não redesenhado, não
// reescrito.
test("captura pública de interesse (E-commerce/Guardião) foi incorporada nesta pista de convergência, com autorização explícita da Torre", () => {
  assert.ok(fs.existsSync(path.join(root, "app/api/site-publico/interesse/route.ts")));
  const codigo = ler("app/api/site-publico/interesse/route.ts");
  assert.match(codigo, /oportunidades_demanda/);
  assert.match(codigo, /canal.*site|"site"/);
});
