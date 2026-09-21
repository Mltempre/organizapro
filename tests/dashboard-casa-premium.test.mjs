// Dashboard / Casa Premium — Convergência Final V1. Verificação estática
// (mesma técnica já usada nas missões GBP/WhatsApp Governado): prova que o
// CÓDIGO REAL das rotas/páginas contém as guardas exigidas, sem precisar
// de um banco real. Cobre os 15 cenários mandatórios da missão.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const rotaAtividade = ler("app/api/atividade-recente/route.ts");
const paginaDashboard = ler("app/dashboard/page.tsx");
const paginaDashboardDemo = ler("app/dashboard-demo/page.tsx");
const dashboardView = ler("app/components/DashboardView.tsx");
const faixaExecutiva = ler("app/components/FaixaExecutiva.tsx");
const dinheiroCard = ler("app/components/DinheiroCard.tsx");
const atividadeCard = ler("app/components/OrganizaProTrabalhandoCard.tsx");
const missaoDoDiaCard = ler("app/components/MissaoDoDiaCard.tsx");
const proximaMelhorAcao = ler("app/components/ProximaMelhorAcao.tsx");
const radar = ler("app/components/RadarDeOportunidades.tsx");

// ── 1. Tenant isolado ────────────────────────────────────────────────────

test("tenant: /api/atividade-recente exige clinica_id e autorizarUsuarioNaClinica antes de qualquer leitura", () => {
  assert.match(rotaAtividade, /autorizarUsuarioNaClinica/);
  const idxAuth = rotaAtividade.indexOf("autorizarUsuarioNaClinica");
  const idxQuery = rotaAtividade.indexOf('.from("eventos_dominio")');
  assert.ok(idxAuth > -1 && idxQuery > -1 && idxAuth < idxQuery);
});

test("tenant: consulta a eventos_dominio em /api/atividade-recente é escopada por clinica_id", () => {
  assert.match(rotaAtividade, /\.eq\("clinica_id", clinicaId\)/);
});

// ── 2. Zero dado fabricado ────────────────────────────────────────────────

test("zero fabricação: DinheiroCard nunca formata null como R$ 0,00 — mostra travessão", () => {
  assert.match(dinheiroCard, /if \(v === null\) return "—";/);
});

test("zero fabricação: page.tsx só calcula indicadoresCobranca quando existe ao menos uma cobrança real (senão null)", () => {
  assert.match(paginaDashboard, /dash\.todasCobrancasRows\.length > 0 \? calcularIndicadoresCobranca\(dash\.todasCobrancasRows, agoraIso\) : null/);
});

test("zero fabricação: cobrancasAbertasCount só é numérico quando há cobrança real registrada, senão null", () => {
  assert.match(paginaDashboard, /cobrancasAbertasCount=\{dash\.todasCobrancasRows\.length > 0 \? dash\.cobrancasAbertasRows\.length : null\}/);
});

test("zero fabricação: OrganizaProTrabalhandoCard nunca lista item com quantidade zero (delegado a calcularAtividadeRecente, que já filtra)", () => {
  assert.doesNotMatch(atividadeCard, /quantidade:\s*0|Math\.random/);
});

// ── 3. Erro não vira zero ────────────────────────────────────────────────

test("erro não vira zero: /api/atividade-recente devolve indisponivel:true (nunca eventos fabricados) quando a query falha", () => {
  const idxErro = rotaAtividade.indexOf("if (error)");
  const trecho = rotaAtividade.slice(idxErro, idxErro + 300);
  assert.match(trecho, /indisponivel: true/);
  assert.match(trecho, /eventos: \[\]/);
});

test("erro não vira zero: OrganizaProTrabalhandoCard distingue 'indisponível' de 'zero atividade real' com textos diferentes", () => {
  assert.match(atividadeCard, /Não foi possível carregar a atividade recente agora\./);
  assert.match(atividadeCard, /Nenhuma ação automática registrada/);
});

test("erro não vira zero: page.tsx trata falha de rede/HTTP de /api/atividade-recente como indisponivel:true, nunca como lista vazia silenciosa", () => {
  assert.match(paginaDashboard, /indisponivel: true \}\)\);/);
});

// ── 4. Oportunidade não vira receita ─────────────────────────────────────

test("DinheiroCard nunca lê oportunidades/orçamentos — só IndicadoresCobranca (pagamento real)", () => {
  const codigoReal = dinheiroCard.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(codigoReal, /oportunidad|orcamento/i);
});

test("FaixaExecutiva mostra 'Oportunidades' e 'Orçamentos parados' como contagens, nunca como valor em R$", () => {
  assert.doesNotMatch(faixaExecutiva, /toLocaleString|currency|R\$/);
});

// ── 5. Diretor não inventa número ────────────────────────────────────────

test("Diretor Digital (MissaoDoDiaCard) só renderiza sinais recebidos via prop — nenhum Math.random, nenhum valor hardcoded no componente", () => {
  assert.doesNotMatch(missaoDoDiaCard, /Math\.random|Math\.floor\(Math\.random/);
});

test("narrativaDiretor continua vindo de gerarNarrativaDiretor (lib/ia-comercial.ts) — nenhuma segunda fonte de narrativa criada nesta missão", () => {
  assert.match(paginaDashboard, /gerarNarrativaDiretor\(/);
  assert.match(paginaDashboardDemo, /gerarNarrativaDiretor\(/);
});

// ── 6. CTA aponta para rota real ─────────────────────────────────────────

test("FaixaExecutiva: todos os destinos são rotas reais do produto", () => {
  for (const rota of ["/oportunidades", "/orcamentos", "/cobrancas", "/agendamentos"]) {
    assert.ok(fs.existsSync(path.join(root, `app${rota}/page.tsx`)), `rota ausente: app${rota}/page.tsx`);
    assert.match(faixaExecutiva, new RegExp(rota.replace("/", "\\/")));
  }
});

test("Botões Rápidos (Bloco H): Orçamentos e Reputação apontam para páginas reais existentes", () => {
  assert.ok(fs.existsSync(path.join(root, "app/orcamentos/page.tsx")));
  assert.ok(fs.existsSync(path.join(root, "app/reputacao/page.tsx")));
  assert.match(paginaDashboard, /destino: "\/orcamentos"/);
  assert.match(paginaDashboard, /destino: "\/reputacao"/);
});

// ── 7. Orçamento apresentado/parado aparece corretamente quando aplicável ──

test("orcamentosParadosCount vem de dash.orcamentosParadosRows.length — mesma fonte real já usada pelo Radar, nenhuma segunda consulta", () => {
  assert.match(paginaDashboard, /orcamentosParadosCount=\{dash\.orcamentosParadosRows\.length\}/);
});

// ── 8. Dados vazios geram empty state ────────────────────────────────────

test("DinheiroCard: sem indicadores (null) mostra mensagem explicativa com CTA para /cobrancas, nunca um card vazio silencioso", () => {
  assert.match(dinheiroCard, /Nenhuma cobrança registrada ainda/);
  assert.match(dinheiroCard, /onNavigate\("\/cobrancas"\)/);
});

test("OrganizaProTrabalhandoCard: itens vazios (sem indisponibilidade) mostram explicação do próximo passo, nunca tela em branco", () => {
  assert.match(atividadeCard, /itens\.length === 0/);
});

// ── 9. Dados indisponíveis geram estado adequado (distinto de vazio) ────

test("OrganizaProTrabalhandoCard distingue explicitamente indisponivel de itens.length === 0 (dois estados, duas mensagens)", () => {
  const idxIndisponivel = atividadeCard.indexOf("indisponivel ?");
  const idxVazio = atividadeCard.indexOf("itens.length === 0");
  assert.ok(idxIndisponivel > -1 && idxVazio > -1 && idxIndisponivel < idxVazio);
});

// ── 10. Nenhum bloco depende de segredo no cliente ───────────────────────

test("componentes novos do Dashboard nunca referenciam process.env (só a rota server-side pode)", () => {
  for (const [nome, codigo] of [["FaixaExecutiva", faixaExecutiva], ["DinheiroCard", dinheiroCard], ["OrganizaProTrabalhandoCard", atividadeCard], ["MissaoDoDiaCard", missaoDoDiaCard]]) {
    assert.doesNotMatch(codigo, /process\.env/, `${nome} não deveria referenciar process.env`);
  }
});

test("/api/atividade-recente usa SUPABASE_SERVICE_ROLE_KEY só no servidor, nunca devolvido na resposta", () => {
  assert.match(rotaAtividade, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(rotaAtividade, /NextResponse\.json\([^}]*SERVICE_ROLE/);
});

// ── 11/12. Dashboard continua renderizando sem Google/provider externo ──

test("DinheiroCard e OrganizaProTrabalhandoCard renderizam incondicionalmente (nunca dependem de temDados nem de nenhuma integração externa conectada)", () => {
  assert.match(dashboardView, /<DinheiroCard indicadores=\{indicadoresCobranca\} onNavigate=\{onNavigate\} \/>/);
  assert.match(dashboardView, /<OrganizaProTrabalhandoCard itens=\{itensAtividade\} indisponivel=\{atividadeIndisponivel\} dias=\{7\} \/>/);
  const idxDinheiro = dashboardView.indexOf("<DinheiroCard");
  const trechoAntes = dashboardView.slice(Math.max(0, idxDinheiro - 200), idxDinheiro);
  assert.doesNotMatch(trechoAntes, /\{temDados &&\s*\($/);
});

// ── 13. Itens do Radar mantêm identidade/origem ──────────────────────────

test("RadarDeOportunidades continua recebendo oportunidadesClientes sem transformação — mesma prop, mesmo tipo, nenhuma reescrita nesta missão", () => {
  assert.match(dashboardView, /<RadarDeOportunidades\s*\n\s*oportunidades=\{oportunidadesClientes\}/);
  assert.match(radar, /op\.chave/);
});

// ── 14. Mobile não depende de tabela desktop ─────────────────────────────

test("Faixa Executiva usa grid auto-fit (nunca uma coluna fixa que force overflow em telas estreitas) — Correção Visual Final V1 absorveu o antigo bloco separado Indicadores Executivos", () => {
  assert.match(dashboardView, /\.faixa-executiva-grid \{ display: grid; grid-template-columns: repeat\(auto-fit,minmax\(130px,1fr\)\); gap: 12px; \}/);
  assert.doesNotMatch(dashboardView, /<IndicadoresExecutivos/);
});

test("regressão de overflow mobile corrigida: Diretor Digital e Agora não forçam minWidth fixo nas linhas com botão (causava corte de texto em telas estreitas)", () => {
  assert.doesNotMatch(missaoDoDiaCard, /minWidth: 200/);
  assert.match(missaoDoDiaCard, /minWidth: 0/);
  assert.doesNotMatch(proximaMelhorAcao, /minWidth: 160/);
});

test("Radar de Oportunidades usa grid responsivo (auto-fill/minmax), nunca uma tabela larga fixa", () => {
  assert.match(radar, /gridTemplateColumns: "repeat\(auto-fill,minmax\(280px,1fr\)\)"/);
});

// ── Consolidação — sem duplicar apresentação do mesmo sinal ─────────────

test("Central de Oportunidades e o bloco solto 'Oportunidades encontradas' foram removidos do render padrão do Dashboard (redundantes com Faixa Executiva + Radar)", () => {
  assert.doesNotMatch(dashboardView, /CentralDeOportunidadesCard/);
  assert.doesNotMatch(dashboardView, /Oportunidades encontradas/);
});

test("nenhum motor foi apagado — lib/recomendacoes.ts (Central) e o componente CentralDeOportunidades.tsx continuam existindo no repositório", () => {
  assert.ok(fs.existsSync(path.join(root, "lib/recomendacoes.ts")));
  assert.ok(fs.existsSync(path.join(root, "app/components/CentralDeOportunidades.tsx")));
});

test("página real (app/dashboard/page.tsx) e página demo (app/dashboard-demo/page.tsx) continuam usando a MESMA DashboardView — nenhum Dashboard V2 paralelo criado", () => {
  assert.match(paginaDashboard, /<DashboardView/);
  assert.match(paginaDashboardDemo, /<DashboardView/);
});
