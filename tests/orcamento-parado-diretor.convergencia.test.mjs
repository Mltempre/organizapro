// Prova ponta a ponta (só domínio puro, sem DB/HTTP): um orçamento real
// parado atravessa a cadeia inteira até a camada consumida pelo Diretor
// Digital — exatamente a cadeia pedida na missão "última milha":
//
//   ORÇAMENTO REAL → motor-orcamentos → orcamento_parado (Radar)
//     → adaptarOportunidadesClientes + gerarMissaoDoDia (Motor de Prioridades)
//     → gerarRecomendacoesConsultivas + gerarNarrativaDiretor (Diretor Digital)
//
// Como rodar:
//   npx tsc --module commonjs --target es2020 --esModuleInterop --skipLibCheck --strict false \
//     --outDir <tmp>/build lib/motor-orcamentos.ts lib/oportunidades-clientes.ts lib/nucleo-inteligente.ts lib/ia-comercial.ts
//   CONVERGENCIA_BUILD_DIR=<tmp>/build node --test tests/orcamento-parado-diretor.convergencia.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido — ver instruções no cabeçalho deste arquivo");

const radar = await import(pathToFileURL(path.join(buildDir, "oportunidades-clientes.js")));
const nucleo = await import(pathToFileURL(path.join(buildDir, "nucleo-inteligente.js")));
const diretor = await import(pathToFileURL(path.join(buildDir, "ia-comercial.js")));

function gerarOportunidadeComOrcamentoParado() {
  return radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    agora: "2026-09-19T12:00:00Z",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    orcamentosParados: [
      { id: "orc-1", pacienteNome: "Fernanda Lima", telefone: "11912345678", procedimento: "Consultoria de marketing", valor: 3200, apresentadoEm: "2026-09-08T12:00:00Z" },
    ],
  });
}

test("Radar → Motor de Prioridades: orcamento_parado vira SinalCanonico e entra na Missão do Dia", () => {
  const oportunidades = gerarOportunidadeComOrcamentoParado();
  assert.equal(oportunidades.length, 1);

  const sinaisCanonicos = nucleo.adaptarOportunidadesClientes(oportunidades);
  assert.equal(sinaisCanonicos.length, 1);
  assert.equal(sinaisCanonicos[0].tipo, "orcamento_parado");
  assert.equal(sinaisCanonicos[0].prioridade, "alta");
  assert.equal(sinaisCanonicos[0].destino, "/orcamentos");
  assert.match(sinaisCanonicos[0].evidencia, /orçamento real registrado/i);

  const missaoDoDia = nucleo.gerarMissaoDoDia(sinaisCanonicos);
  assert.equal(missaoDoDia.length, 1);
  assert.equal(missaoDoDia[0].tipo, "orcamento_parado");
});

test("Motor de Prioridades → Diretor Digital: orcamento_parado vira recomendação consultiva com evidência e destino corretos", () => {
  const oportunidades = gerarOportunidadeComOrcamentoParado();

  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true,
    oportunidadesClientes: oportunidades,
    recomendacoes: [],
    ocupacaoPct: 50,
  });

  assert.equal(recomendacoes.length, 1);
  assert.equal(recomendacoes[0].categoria, "orcamento_parado");
  assert.match(recomendacoes[0].identificado, /Fernanda Lima/);
  assert.equal(recomendacoes[0].destino, "/orcamentos");
  assert.equal(recomendacoes[0].destinoLabel, "Ver orçamento");
  assert.equal(recomendacoes[0].prioridade, "alta");
});

test("Diretor Digital: narrativa cita a ação do orçamento parado como prioridade quando é o único sinal", () => {
  const oportunidades = gerarOportunidadeComOrcamentoParado();
  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true,
    oportunidadesClientes: oportunidades,
    recomendacoes: [],
    ocupacaoPct: 50,
  });
  const narrativa = diretor.gerarNarrativaDiretor({ ocupacaoPct: 50, recomendacoes });
  assert.match(narrativa, /follow-up do orçamento/i);
});

test("Honestidade: sem orçamento parado, nenhuma recomendação de orçamento é fabricada", () => {
  const oportunidades = radar.gerarOportunidadesClientes({
    hoje: "2026-09-19",
    agora: "2026-09-19T12:00:00Z",
    clientesSemProximoCompromisso: [],
    cancelamentosSemReagendamento: [],
    confirmacoesPendentes: [],
    orcamentosParados: [],
  });
  const recomendacoes = diretor.gerarRecomendacoesConsultivas({
    temDadosSuficientes: true,
    oportunidadesClientes: oportunidades,
    recomendacoes: [],
    ocupacaoPct: 50,
  });
  assert.equal(recomendacoes.length, 0);
  const narrativa = diretor.gerarNarrativaDiretor({ ocupacaoPct: 50, recomendacoes });
  assert.match(narrativa, /continue assim/i);
});
