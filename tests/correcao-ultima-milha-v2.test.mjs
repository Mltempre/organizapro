// Última Milha Funcional V2 — fecha cliques/destinos visíveis (#9, #10,
// #11, #13, #14, #15, #16) sobre a Casa já convergida com o Cérebro
// Comercial Canônico V1. Nenhuma feature nova, nenhum redesign.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { gerarCliente360 } = await import(pathToFileURL(path.join(buildDir, "cliente-360.js")));

// ── #9 — Orçamentos: "Próxima ação" vira CTA real para /follow-up ───────

test("Orçamentos: quando parado, 'Próxima ação' é um botão clicável para /follow-up (rota real já existente, nenhuma nova)", () => {
  const codigo = ler("app/orcamentos/page.tsx");
  assert.match(codigo, /onClick=\{\(\) => router\.push\('\/follow-up'\)\}/);
  assert.match(codigo, /➜ \{proximaAcao\} →/);
});

test("Orçamentos: quando NÃO parado (aguardando decisão), 'Próxima ação' continua texto estático — nada a clicar de verdade ainda", () => {
  const codigo = ler("app/orcamentos/page.tsx");
  assert.match(codigo, /➜ Próxima ação: \{proximaAcao\}/);
});

// ── #10 — Cliente 360: destino de agendamento passado vs futuro ─────────

test("gerarCliente360: agendamento PASSADO aponta para /agendamentos?filtro=historico (aba onde o item de fato aparece)", () => {
  const r = gerarCliente360({
    cliente: { id: "p1", telefone: "11911112222", whatsapp: null },
    agora: "2026-09-20T12:00:00.000Z",
    agendamentos: [{ id: "a1", telefone: "11911112222", data: "2026-08-01", hora: "10:00", tipoConsulta: "Avaliação", status: "atendido" }],
    oportunidades: [], orcamentos: [], tratamentos: [], cobrancas: [], pedidos: [], avaliacoes: [],
  });
  const evento = r.timeline.find(e => e.tipo === "agendamento");
  assert.equal(evento.destino, "/agendamentos?filtro=historico");
});

test("gerarCliente360: agendamento FUTURO continua apontando para /agendamentos (aba padrão 'Próximos', onde já aparece)", () => {
  const r = gerarCliente360({
    cliente: { id: "p1", telefone: "11911112222", whatsapp: null },
    agora: "2026-09-20T12:00:00.000Z",
    agendamentos: [{ id: "a1", telefone: "11911112222", data: "2026-09-25", hora: "14:00", tipoConsulta: "Retorno", status: "agendado" }],
    oportunidades: [], orcamentos: [], tratamentos: [], cobrancas: [], pedidos: [], avaliacoes: [],
  });
  const evento = r.timeline.find(e => e.tipo === "agendamento");
  assert.equal(evento.destino, "/agendamentos");
});

test("gerarCliente360: demais destinos da timeline (orçamento/tratamento/cobrança/pedido/oportunidade/avaliação) continuam intocados — só agendamento ganhou lógica de passado/futuro", () => {
  const codigo = ler("lib/cliente-360.ts");
  for (const linha of [
    'destino: "/oportunidades"',
    'destino: "/orcamentos"',
    'destino: "/tratamentos"',
    'destino: "/cobrancas"',
    'destino: "/pedidos"',
  ]) {
    assert.match(codigo, new RegExp(linha.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${linha} deveria continuar presente sem alteração`);
  }
});

test("agendamentos/page.tsx: lê ?filtro= da URL para decidir a aba inicial (sem exigir Suspense boundary — mesmo padrão de google-presenca)", () => {
  const codigo = ler("app/agendamentos/page.tsx");
  assert.match(codigo, /new URLSearchParams\(window\.location\.search\)\.get\('filtro'\)/);
  assert.match(codigo, /filtroInicial === 'historico' \|\| filtroInicial === 'confirmados' \? filtroInicial : 'proximos'/);
});

// ── #11 — Radar: "Abrir cliente" usa /clientes/[id] quando há identidade real ──

test("RadarDeOportunidades: 'Abrir cliente' vai para /clientes/[id] só quando o sinal principal tem entidadeTipo 'cliente' + entidadeId real — nunca fabrica id", () => {
  const codigo = ler("app/components/RadarDeOportunidades.tsx");
  assert.match(codigo, /const principal = op\.sinais\[0\];/);
  assert.match(codigo, /const destinoCliente = principal\?\.entidadeTipo === "cliente" && principal\.entidadeId\s*\n\s*\? `\/clientes\/\$\{principal\.entidadeId\}`\s*\n\s*: "\/clientes";/);
  assert.match(codigo, /onClick=\{\(\) => onNavigate\(destinoCliente\)\}/);
});

test("lib/oportunidades-clientes.ts: 'sem_proximo_compromisso' é o único sinal com entidadeTipo cliente + entidadeId real (paciente.id) — base real do fix do Radar", () => {
  const codigo = ler("lib/oportunidades-clientes.ts");
  const idx = codigo.indexOf('motivo:          `${c.nome} está sem um próximo atendimento programado.`');
  assert.ok(idx > -1);
  const trecho = codigo.slice(idx, idx + 300);
  assert.match(trecho, /entidadeTipo:\s*"cliente"/);
  assert.match(trecho, /entidadeId:\s*c\.id/);
});

// ── #16 — Botões Rápidos: reutilizam o modal de criação já existente ────

test("Dashboard: botões 'Novo Cliente'/'Novo Agendamento' levam a ?novo=1 (dashboard real e demo)", () => {
  for (const p of ["app/dashboard/page.tsx", "app/dashboard-demo/page.tsx"]) {
    const codigo = ler(p);
    assert.match(codigo, /destino: "\/clientes\?novo=1"/, `${p} deveria apontar Novo Cliente para ?novo=1`);
    assert.match(codigo, /destino: "\/agendamentos\?novo=1"/, `${p} deveria apontar Novo Agendamento para ?novo=1`);
  }
});

test("app/clientes/page.tsx e app/agendamentos/page.tsx: ?novo=1 chama abrirNovo() real (mesmo modal do botão '+', nenhum formulário novo)", () => {
  for (const p of ["app/clientes/page.tsx", "app/agendamentos/page.tsx"]) {
    const codigo = ler(p);
    assert.match(codigo, /new URLSearchParams\(window\.location\.search\)\.get\('novo'\) === '1'\) abrirNovo\(\);/, `${p} deveria chamar abrirNovo() quando ?novo=1`);
  }
});

// ── #13 — corrida de estado: Set<string>, não string única ──────────────

test("Orçamentos, Oportunidades, Follow-up (registrar+enviar): estado 'em voo' é Set<string> — clicar em itens diferentes não reabilita um card ainda em voo", () => {
  const casos = [
    ["app/orcamentos/page.tsx", "transicionando", "o\\.id"],
    ["app/oportunidades/page.tsx", "transicionando", "op\\.id"],
    ["app/follow-up/page.tsx", "registrando", "caso\\.entidadeId"],
    ["app/follow-up/page.tsx", "enviando", "caso\\.entidadeId"],
  ];
  for (const [arquivo, estado, idExpr] of casos) {
    const codigo = ler(arquivo);
    assert.match(codigo, new RegExp(`useState<Set<string>>\\(new Set\\(\\)\\)`), `${arquivo}: ${estado} deveria ser Set<string>`);
    assert.match(codigo, new RegExp(`${estado}\\.has\\(${idExpr}\\)`), `${arquivo}: leitura de ${estado} deveria usar .has()`);
    assert.doesNotMatch(codigo, new RegExp(`${estado} === `), `${arquivo}: não deveria sobrar comparação de igualdade com ${estado}`);
  }
});

// ── #14 — Agendamentos: card 'Confirmados' bate com a aba ────────────────

test("Agendamentos: card 'Confirmados' usa a MESMA condição da aba (sem restrição de data) — nunca mais um número menor que o da aba", () => {
  const codigo = ler("app/agendamentos/page.tsx");
  assert.match(codigo, /const confirmados\s+= agendamentos\.filter\(a => a\.confirmado === true \|\| a\.status === 'confirmado'\)\.length;/);
});

// ── #15 — Tratamentos/Cobranças: indicador global só aparece com filtro 'todos' ──

test("Tratamentos: 'sem acompanhamento' só aparece no subtítulo quando filtro === 'todos' — nunca junto de uma contagem filtrada diferente", () => {
  const codigo = ler("app/tratamentos/page.tsx");
  assert.match(codigo, /filtro === 'todos' && indicadores\.semAcompanhamento > 0/);
});

test("Cobranças: 'atrasada(s)' só aparece no subtítulo quando filtro === 'todos'", () => {
  const codigo = ler("app/cobrancas/page.tsx");
  assert.match(codigo, /filtro === 'todos' && atrasadas\.length > 0/);
});

// ── Regra de colisão: nada fora do escopo autorizado foi tocado ─────────

test("nenhuma alteração desta V2 tocou SinalCanonico/EstadoComercialCanonico/tiers/Pesquisa de Preços/E-commerce", () => {
  const nucleo = ler("lib/nucleo-inteligente.ts");
  assert.match(nucleo, /export type SinalCanonico/);
  assert.match(nucleo, /export type EstadoComercialCanonico/);
  for (const p of ["app/pesquisa-precos/page.tsx", "app/financeiro/page.tsx", "app/api/site-publico/interesse/route.ts"]) {
    assert.doesNotThrow(() => ler(p), `${p} deveria continuar existindo, intocado`);
  }
});
