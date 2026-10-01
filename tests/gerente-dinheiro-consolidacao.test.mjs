// Consolidação Gerente Comercial + Dinheiro (sem excluir telas, rotas,
// motores ou itens do menu).
//   Gerente Comercial = dono de "o que preciso fazer agora?";
//   Dinheiro          = dono da visão financeira consolidada;
//   Follow-up         = executa o contato (capacidades intactas).
//
// node --test tests/gerente-dinheiro-consolidacao.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const semComentarios = s => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const gerente = ler("app/copiloto/page.tsx");
const dinheiro = ler("app/financeiro/page.tsx");
const followUp = ler("app/follow-up/page.tsx");

test("Gerente: saem os resumos financeiros repetidos (Receita Perdida e Previsor)", () => {
  const c = semComentarios(gerente);
  assert.doesNotMatch(c, /📉 Receita Perdida|📈 Previsor de Faturamento/);
  assert.doesNotMatch(c, /gerarPrevisorFaturamento|estado\.previsor|estado\.receitaPerdida/);
  assert.doesNotMatch(c, /router\.push\('\/receita-perdida'\)|router\.push\('\/previsor-faturamento'\)/);
  // um acesso discreto para quem procura valores
  assert.match(gerente, /data-testid="gerente-dinheiro"[\s\S]{0,200}href="\/financeiro"/);
});

test("Gerente: permanece a priorização comercial com motivo, impacto e próxima ação", () => {
  assert.match(gerente, /Prioridades comerciais \(\{estado\.atencoes\.length\}\)/);
  assert.match(gerente, /<dt>Motivo<\/dt>/);
  assert.match(gerente, /<dt>Próxima ação<\/dt>/);
  assert.match(gerente, /<dt>Impacto<\/dt>/);
  assert.match(gerente, /Abrir ação recomendada →/);
  // o impacto de cada prioridade continua vindo do motor real de receita em risco
  assert.match(gerente, /const receitaPerdida = agregarReceitaPerdida\(/);
  assert.match(gerente, /coordenarGerenteComercial\(sinais, receitaPerdida, casosAgenda\)/);
});

test("Gerente: permanecem compromissos passados sem desfecho e o acesso contextual ao Follow-up", () => {
  assert.match(gerente, /estado\.atrasados\.slice\(0, 3\)/);
  assert.match(gerente, /sem desfecho — revisar na agenda/);
  assert.match(gerente, /estado\.followUpsPendentes\.map/);
  assert.match(gerente, /router\.push\('\/follow-up'\)/);
  assert.match(gerente, /donoDoFluxo === 'follow-up'/);
});

test("Follow-up: capacidades preservadas (registrar contato, aprovar envio, governança/auditoria no servidor)", () => {
  assert.match(followUp, /onClick=\{\(\) => registrarContato\(caso\)\}/);
  assert.match(followUp, /onClick=\{\(\) => aprovarEnvio\(caso\)\}/);
  assert.match(followUp, /fetch\('\/api\/follow-up\/tentativa'/);
  assert.match(followUp, /fetch\('\/api\/follow-up\/aprovar-envio'/);
  const tentativa = ler("app/api/follow-up/tentativa/route.ts");
  assert.match(tentativa, /Já existe uma tentativa registrada hoje para este caso/, "idempotência diária");
  assert.match(tentativa, /prepararRegistroAuditoria\(/, "auditoria");
  assert.match(ler("app/api/follow-up/aprovar-envio/route.ts"), /aprovar|aprovado/i);
});

test("Dinheiro: os 5 números continuam e cada um abre o seu detalhe", () => {
  for (const [rotulo, href] of [["A receber", "/cobrancas"], ["Atrasado", "/cobrancas"], ["Total recebido", "/linha-economica"], ["Previsto", "/previsor-faturamento"], ["Em risco", "/receita-perdida"]]) {
    const re = new RegExp(`router\\.push\\('${href.replace("/", "\\/")}'\\)\\} aria-label="${rotulo}`);
    assert.match(dinheiro, re, rotulo);
  }
  assert.match(dinheiro, />Total recebido · todo o histórico</);
  assert.match(dinheiro, /resumo\.receitaPerdida\.totalConhecido/);
  assert.match(dinheiro, /resumo\.previsor\.totalEsperado30Dias/);
});

test("Dinheiro: Receita Perdida, Previsor e Linha Econômica acessíveis como detalhes, com o que cada um responde", () => {
  assert.match(dinheiro, /data-testid="dinheiro-detalhes"/);
  assert.match(dinheiro, /label: 'Receita Perdida',\s*href: '\/receita-perdida',[^}]*descricao: 'Detalhe do dinheiro em risco, item a item'/);
  assert.match(dinheiro, /label: 'Previsor de Faturamento', href: '\/previsor-faturamento',[^}]*descricao: 'Detalhe do que deve entrar nos próximos 30 dias'/);
  assert.match(dinheiro, /label: 'Linha Econômica',\s*href: '\/linha-economica',[^}]*descricao: 'Origem e prova da receita confirmada'/);
  // as três páginas e seus motores continuam existindo
  for (const p of ["app/receita-perdida/page.tsx", "app/previsor-faturamento/page.tsx", "app/linha-economica/page.tsx", "lib/receita-perdida.ts", "lib/previsor-faturamento.ts", "lib/linha-economica.ts"]) {
    assert.ok(fs.existsSync(new URL("../" + p, import.meta.url)), p);
  }
});

test("Dinheiro: 'próxima ação' vira resumo dos maiores riscos (top 3), sem competir com o Gerente", () => {
  assert.match(dinheiro, /⚠ Maiores valores em risco/);
  assert.doesNotMatch(dinheiro, /🎯 Próxima ação financeira/);
  assert.match(dinheiro, /\.slice\(0, 3\)/);
  assert.match(dinheiro, /data-testid="dinheiro-risco-rodape"[\s\S]*?router\.push\('\/receita-perdida'\)[\s\S]*?router\.push\('\/copiloto'\)/);
});

test("Escopo: menu lateral, APIs e Follow-up não foram tocados por esta etapa", () => {
  const shell = ler("app/components/AdminShellFrame.tsx");
  for (const item of ["Dinheiro", "Follow-up Comercial", "Receita Perdida", "Gerente Comercial", "Previsor de Faturamento", "Linha Econômica"]) {
    assert.match(shell, new RegExp(`l: "${item}"`), item);
  }
});
