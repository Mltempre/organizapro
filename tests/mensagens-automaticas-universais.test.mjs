// Mensagens Automáticas (lembrete, confirmação, avaliação, reagendamento)
// chegam ao cliente final de qualquer negócio — mecânica, loja, barbearia,
// clínica. Nenhum texto padrão desse fluxo pode assumir vertical de saúde.
// Cobre os padrões da tela de Configurações e os fallbacks do webhook Z-API
// (usados quando o negócio não salvou um modelo próprio).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const webhook = ler("../app/api/webhook/zapi/route.ts");
const config = ler("../app/configuracoes/page.tsx");
const TERMOS_SAUDE = /consulta|cl[ií]nica|paciente|conv[eê]nio/i;

function constante(fonte, nome) {
  const m = fonte.match(new RegExp(`const ${nome} =\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  assert.ok(m, `${nome} não encontrado`);
  return JSON.parse(`"${m[1]}"`);
}

// Mesma interpolação do webhook (função interpolar) — só para provar que as
// variáveis continuam resolvendo.
function interpolar(t, v) {
  return t.replace(/\{nome\}|\{\{paciente_nome\}\}/g, v.nome).replace(/\{data\}|\{\{data\}\}/g, v.data)
    .replace(/\{horario\}|\{\{hora\}\}/g, v.horario).replace(/\{clinica_nome\}|\{\{clinica_nome\}\}/g, v.clinica_nome);
}

test("fallbacks do webhook são universais e mantêm as variáveis", () => {
  const confirmacao = constante(webhook, "MSG_CONFIRMACAO_PADRAO");
  const reagendamento = constante(webhook, "MSG_REAGENDAMENTO_PADRAO");
  assert.doesNotMatch(confirmacao, TERMOS_SAUDE);
  assert.doesNotMatch(reagendamento, TERMOS_SAUDE);
  assert.match(confirmacao, /Seu compromisso do dia \*\{data\}\* às \*\{horario\}\* está confirmado/);
  assert.match(reagendamento, /Vamos reagendar seu compromisso/);
  const final = interpolar(confirmacao, { nome: "Ana", data: "01/10/2026", horario: "09:00", clinica_nome: "Oficina Silva" });
  assert.match(final, /Perfeito, Ana!.*01\/10\/2026.*09:00/s);
  assert.doesNotMatch(final, /\{[a-z_]+\}/);
});

test("nome do negócio ausente cai em termo universal (variável {clinica_nome} preservada)", () => {
  assert.match(webhook, /clinica_nome: clinicaConfig\?\.nome_clinica \|\| "nossa empresa"/);
  assert.doesNotMatch(webhook, /"nossa cl[ií]nica"/);
  assert.ok(webhook.includes(".replace(/\\{clinica_nome\\}|\\{\\{clinica_nome\\}\\}/g, vars.clinica_nome)"));
});

test("cron de lembrete: padrão e reserva do nome do negócio são universais", () => {
  const cron = ler("../app/api/cron/lembretes/route.ts");
  assert.doesNotMatch(constante(cron, "TEMPLATE_PADRAO"), /consulta|paciente|conv[eê]nio/i);
  assert.match(cron, /nomeClinica = clinicaInfo\?\.nome \|\| "nossa empresa"/);
  assert.doesNotMatch(cron, /"sua cl[ií]nica"/);
});

test("padrões da tela de Configurações não usam linguagem de saúde", () => {
  for (const k of ["msg_lembrete", "msg_confirmacao", "msg_avaliacao", "msg_reagendamento"]) {
    const m = config.match(new RegExp(`${k}:\\s*\\n\\s*'([^']*)'`));
    assert.ok(m, k);
    assert.doesNotMatch(m[1], TERMOS_SAUDE, k);
  }
});
