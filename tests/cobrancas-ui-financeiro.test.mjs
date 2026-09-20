// Financeiro/Cobrador AI V1 — guarda estática de que a UI /cobrancas
// reutiliza o motor canônico (nunca reimplementa priorização, indicadores
// ou máquina de estados dentro do componente) + testes puros da
// priorização usada pelo painel "Precisa de atenção agora".

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const normalizar = (s) => s.replace(/\r\n/g, "\n");

const pagina = normalizar(readFileSync(path.join(root, "app/cobrancas/page.tsx"), "utf8"));

test("/cobrancas importa o motor canônico real, nunca reimplementa a máquina de estados", () => {
  assert.match(pagina, /from '\.\.\/\.\.\/lib\/motor-cobranca'/);
  assert.match(pagina, /estaAtrasada, diasAtraso, calcularScoreCobranca, calcularIndicadoresCobranca/);
  // Nenhuma constante local repetindo os estados — usa StatusCobranca importado.
  assert.doesNotMatch(pagina, /"pendente"\s*\|\s*"em_cobranca"\s*\|\s*"pago"\s*\|\s*"cancelada"/);
});

test("/cobrancas usa só as APIs já construídas — nenhuma query direta a public.cobrancas", () => {
  assert.match(pagina, /fetch\(`\/api\/cobrancas\?clinica_id=\$\{cid\}`/);
  assert.match(pagina, /fetch\(`\/api\/cobrancas\/\$\{c\.id\}\/transicao`/);
  assert.doesNotMatch(pagina, /supabase\.from\(['"]cobrancas['"]\)/);
});

test("/cobrancas: indicadores financeiros vêm de calcularIndicadoresCobranca sobre o dado já buscado, nunca uma segunda consulta", () => {
  assert.match(pagina, /calcularIndicadoresCobranca\(cobrancas, agora\)/);
});

test("AdminShell: item de navegação de Cobranças aponta para /cobrancas", () => {
  const shell = normalizar(readFileSync(path.join(root, "app/components/AdminShell.tsx"), "utf8"));
  assert.match(shell, /h:\s*"\/cobrancas"/);
});

// ── Priorização "Cobrador AI" — mesma fórmula real do motor, aplicada aqui ──

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (buildDir) {
  const motor = await import(pathToFileURL(path.join(buildDir, "motor-cobranca.js")));

  test("Cobrador AI: cobrança mais atrasada e de maior valor pontua mais alto (mesmo score do Radar)", () => {
    const base = { valorMaximoEntreAbertas: 1000, quantidadeAbertasDoMesmoPaciente: 1 };
    const poucaAtrasada = motor.calcularScoreCobranca({ ...base, diasAtraso: 2, valor: 200 });
    const muitoAtrasada = motor.calcularScoreCobranca({ ...base, diasAtraso: 25, valor: 1000 });
    assert.ok(muitoAtrasada > poucaAtrasada, `esperava ${muitoAtrasada} > ${poucaAtrasada}`);
  });

  test("Cobrador AI: cobrança em dia (não atrasada) nunca entra na priorização — estaAtrasada é o filtro real", () => {
    assert.equal(motor.estaAtrasada("2026-12-31", "2026-09-20"), false);
  });
} else {
  test("Cobrador AI: testes de score pulados (CONVERGENCIA_BUILD_DIR não definido)", { skip: true }, () => {});
}
