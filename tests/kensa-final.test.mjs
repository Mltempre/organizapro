// KENSA FINAL (2026-09-27) — regressões das correções de tela encontradas
// navegando a conta demo. As correções de motor têm testes próprios
// (previsor-faturamento, motor-cobranca.convergencia).
//
// node --test tests/kensa-final.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("Copiloto: 'atrasados' vêm de consulta própria (data < hoje, agendado) — igual à Casa; nunca filtrados da agenda de hoje", () => {
  const copiloto = ler("app/copiloto/page.tsx");
  const casa = ler("app/dashboard/page.tsx");
  assert.match(copiloto, /\.lt\('data', hoje\)\.eq\('status', 'agendado'\)\.order\('data', \{ ascending: false \}\)\.order\('hora'\)\.limit\(20\)/);
  assert.match(casa, /\.lt\("data", hoje\)\.eq\("status", "agendado"\)/);
  assert.match(copiloto, /atrasados: \(atrasadosRes\.data \?\? \[\]\) as AgItem\[\]/);
  assert.doesNotMatch(copiloto, /agendaHoje\.filter\(a => a\.data < hoje/, "filtro impossível removido");
  assert.match(copiloto, /\|\| !!atrasadosRes\.error;/, "falha da consulta entra na visão parcial");
  assert.doesNotMatch(copiloto, /compromisso em atraso \(\{a\.data\}\)/, "data ISO crua não é exibida");
});

test("Métricas: agendado com data passada é 'Sem desfecho', nunca somado a cancelados", () => {
  const m = ler("app/metricas/page.tsx");
  assert.match(m, /const semDesfecho = ags\.filter\(a => a\.status === 'agendado' && a\.data < hoje\)\.length/);
  const cancelados = m.slice(m.indexOf("const cancelados"), m.indexOf("const semDesfecho"));
  assert.doesNotMatch(cancelados, /agendado/, "cancelados não inclui agendado vencido");
  assert.match(m, /label: 'Sem desfecho \(data passada\)'/);
  assert.match(m, /label: 'Cancelados e faltas'/);
});

test("Cliente 360: falha de fonte vira aviso de visão parcial — nunca histórico vazio silencioso", () => {
  const c = ler("app/clientes/[id]/page.tsx");
  assert.doesNotMatch(c, /r\.ok \? r\.json\(\) : \{/, "padrão que engolia falha removido");
  assert.equal((c.match(/fetchJsonSeguro</g) ?? []).length, 6);
  assert.match(c, /setFalhaParcial\(!!agendamentosRes\.error \|\| !!avaliacoesRes\.error/);
  assert.match(c, /resumo && falhaParcial && <Feedback type="aviso"/);
  assert.match(c, /if \(!cid\) \{ setErro\(/, "sem negócio identificado mostra erro, não tela em branco");
});

test("Pesquisa de Preços: falha de carga não mostra 'nenhum item' nem formulário; tipos de fonte legíveis", () => {
  const p = ler("app/pesquisa-precos/page.tsx");
  assert.match(p, /setCargaFalhou\(true\)/);
  assert.match(p, /\{cargaFalhou \? <section/);
  assert.match(p, /Tentar novamente/);
  assert.match(p, /cotacao: "Cotação"/);
  assert.doesNotMatch(p, /tipo\.replaceAll\("_", " "\)/);
});

test("Receita Perdida/Oportunidades: status exibido por rótulo da fonte única — nunca o enum", () => {
  const lib = ler("lib/oportunidades-demanda.ts");
  assert.match(lib, /export const ROTULO_STATUS_OPORTUNIDADE: Record<OportunidadeStatus, string>/);
  const rp = ler("app/receita-perdida/page.tsx");
  assert.doesNotMatch(rp, /status: \{op\.status\}/);
  assert.match(rp, /ROTULO_STATUS_OPORTUNIDADE\[op\.status\]/);
  assert.match(ler("app/oportunidades/page.tsx"), /label: ROTULO_STATUS_OPORTUNIDADE\.em_contato/);
});

test("Textos: plural/acentos/termos corrigidos (itens, parciais, passaram, Avaliações, sem jargão técnico)", () => {
  assert.match(ler("app/financeiro/page.tsx"), /'item' : 'itens'\} com valor comprovado/);
  assert.match(ler("app/receita-perdida/page.tsx"), /'item' : 'itens'\} com valor comprovado/);
  assert.match(ler("app/linha-economica/page.tsx"), /'parciais' : 'parcial'/);
  assert.match(ler("lib/recomendacoes.ts"), /plural \? "s passaram" : " passou"/);
  const auto = ler("app/automacao/page.tsx");
  assert.match(auto, /'Avaliações enviadas'/);
  assert.doesNotMatch(auto, /label: '(Avaliacoes|Consultas Confirmadas)/);
  assert.match(auto, /subtitle="Histórico de automações e envios"/);
  assert.doesNotMatch(ler("app/api/atribuicao/route.ts"), /Homologação de banco/);
  assert.match(ler("lib/follow-up-comercial.ts"), /Oportunidade aberta sem interação há/);
  assert.match(ler("app/agendamentos/page.tsx"), /label:'Confirmaram presença'/);
});

test("Sessão ausente leva ao login (NotaFácil e Google Presença) — nunca 'negócio não vinculado'", () => {
  const n = ler("app/notafacil/page.tsx");
  assert.match(n, /if \(!session\) \{ window\.location\.replace\("\/login"\); return; \}/);
  assert.ok(n.indexOf('window.location.replace("/login")') < n.indexOf('from("clinica_usuarios")'));
  assert.match(ler("app/google-presenca/page.tsx"), /if \(!session\) \{ window\.location\.replace\("\/login"\); return; \}/);
});

test("Atrasados levam à aba Histórico da Agenda (onde aparecem) e não soterram as prioridades do Copiloto", () => {
  const rec = ler("lib/recomendacoes.ts");
  const bloco = rec.slice(rec.indexOf('id: "compromissos-atrasados"'), rec.indexOf('id: "clientes-sem-movimentacao"'));
  assert.match(bloco, /destino: "\/agendamentos\?filtro=historico"/);
  const copiloto = ler("app/copiloto/page.tsx");
  assert.match(copiloto, /estado\.atrasados\.slice\(0, 3\)\.map/);
  assert.match(copiloto, /estado\.atrasados\.length > 3 &&/);
  const secao = copiloto.slice(copiloto.indexOf("estado.atrasados.slice(0, 3)"), copiloto.indexOf("estado.pendentesConfirmacao.map"));
  assert.doesNotMatch(secao, /router\.push\('\/agendamentos'\)/, "nenhum atalho de atraso abre a aba Próximos (vazia para eles)");
});

test("Telas financeiras com falha de carga oferecem 'Tentar novamente' (mesmo padrão de Casa/Copiloto)", () => {
  for (const p of ["financeiro", "receita-perdida", "previsor-faturamento", "linha-economica"]) {
    assert.match(ler(`app/${p}/page.tsx`), /\{!carregando && erro && <button onClick=\{carregar\}>Tentar novamente<\/button>\}/, p);
  }
});

test("Cliente 360: timeline sem enum cru (status/canal)", () => {
  const lib = ler("lib/cliente-360.ts");
  assert.doesNotMatch(lib, /\(\$\{a\.status\}\)/);
  assert.doesNotMatch(lib, /via \$\{o\.canal\}`/);
});

test("Automação: cards não mostram 0 durante carregamento nem após falha (zero falso)", () => {
  assert.match(ler("app/automacao/page.tsx"), /\{carregando \|\| erro \? '—' : c\.valor\}/);
});
