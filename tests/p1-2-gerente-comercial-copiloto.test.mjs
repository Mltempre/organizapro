// P1.2 — Gerente Comercial AI (fechar a cadeia sinal→ação) + Copiloto
// Administrativo AI V1.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { adaptarOportunidadesClientes } = await import(pathToFileURL(path.join(buildDir, "nucleo-inteligente.js")));

// ── Gerente Comercial AI: cadeia sinal → ação nunca termina em lugar nenhum ──

function sinalBase(tipo) {
  return { chave: "11911112222", nome: "Ana", telefone: "11911112222", prioridade: "alta", motivoPrincipal: "m", acaoSugerida: "a", tempoDecorrido: "hoje", sinais: [{ tipo }] };
}

test("confirmação pendente hoje: CTA aponta para /agendamentos (compromisso real), nunca mais para /clientes (destino genérico que não abre o compromisso)", () => {
  const r = adaptarOportunidadesClientes([sinalBase("confirmacao_pendente")]);
  assert.equal(r[0].destino, "/agendamentos");
});

test("cancelamento sem reagendamento: CTA aponta para /agendamentos (reagendar o horário), nunca mais para /clientes", () => {
  const r = adaptarOportunidadesClientes([sinalBase("cancelamento_sem_reagendamento")]);
  assert.equal(r[0].destino, "/agendamentos");
});

test("todo tipo de sinal do Radar/Smart Commerce tem CTA real (destino não-vazio) — nenhuma recomendação termina em lugar nenhum", () => {
  const tipos = ["orcamento_parado", "cobranca_atrasada", "tratamento_sem_retorno", "pedido_nao_concluido", "recompra_possivel", "confirmacao_pendente", "cancelamento_sem_reagendamento", "sem_proximo_compromisso"];
  for (const tipo of tipos) {
    const r = adaptarOportunidadesClientes([sinalBase(tipo)]);
    assert.ok(r[0].destino && r[0].destino.length > 0, `tipo ${tipo} deveria ter um destino real`);
  }
});

// ── Copiloto Administrativo AI: composição, nunca motor novo ─────────────

test("Copiloto: reaproveita literalmente os motores reais (gerarOportunidadesClientes, organizarSinaisCanonicos, gerarFollowUpsComerciais, agregarReceitaPerdida) — nenhuma regra de negócio nova", () => {
  const codigo = ler("app/copiloto/page.tsx");
  assert.match(codigo, /gerarOportunidadesClientes/);
  assert.match(codigo, /organizarSinaisCanonicos/);
  assert.match(codigo, /gerarFollowUpsComerciais/);
  assert.match(codigo, /agregarReceitaPerdida/);
  assert.match(codigo, /adaptarOportunidadesDemanda/);
});

test("Copiloto: mesmo padrão de tenant já estabelecido (/api/minha-clinica, erro 'Negócio não vinculado ao usuário')", () => {
  const codigo = ler("app/copiloto/page.tsx");
  assert.match(codigo, /api\/minha-clinica/);
  assert.match(codigo, /Negócio não vinculado ao usuário\./);
});

test("Copiloto: cobre os 4 estados exigidos (loading/error/empty/success) — nunca fabrica dado no estado vazio", () => {
  const codigo = ler("app/copiloto/page.tsx");
  assert.match(codigo, /carregando &&/); // loading
  assert.match(codigo, /erro &&/); // error
  assert.match(codigo, /totalItens === 0/); // empty
  assert.match(codigo, /totalItens > 0/); // success
  assert.match(codigo, /Nada pedindo atenção agora/);
});

test("Copiloto: cada item das seções reais tem CTA para a superfície operacional correta (/agendamentos, /follow-up, /receita-perdida, ou o destino real do sinal)", () => {
  const codigo = ler("app/copiloto/page.tsx");
  assert.match(codigo, /router\.push\('\/agendamentos'\)/);
  assert.match(codigo, /router\.push\('\/follow-up'\)/);
  assert.match(codigo, /router\.push\('\/receita-perdida'\)/);
  assert.match(codigo, /router\.push\(sinal\.destino!\)/);
});

test("Copiloto: só conta follow-ups cujo dono do fluxo é o próprio follow-up — nunca duplica ação já gerenciada pelo Cobrador Digital/Agenda Autônoma", () => {
  const codigo = ler("app/copiloto/page.tsx");
  assert.match(codigo, /donoDoFluxo === 'follow-up'/);
});

test("Copiloto: item de navegação real em Inteligência (AdminShellFrame) — nunca 'existe no código' sem estar no menu", () => {
  const adminShellFrame = ler("app/components/AdminShellFrame.tsx");
  assert.match(adminShellFrame, /h: "\/copiloto"/);
});

// ── Item 7 (não fazer agora): sem dado fabricado, sem novo motor ─────────

test("Copiloto: nenhum array/lista de dados de exemplo hardcoded (nunca fabrica cliente, dinheiro, oportunidade ou recomendação)", () => {
  const codigo = ler("app/copiloto/page.tsx");
  assert.doesNotMatch(codigo, /nome:\s*['"](?!.*\$\{)[A-ZÀ-Ú][a-zà-ú]+['"]/, "nenhum nome de cliente literal deveria aparecer no código");
});
