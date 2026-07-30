// ── Dados de Demonstração V1 — Fase 3 ────────────────────────────────────
// Ver docs/modo-demonstracao-v1-arquitetura.md, seções 4 e 9 (roadmap).
// Fornece dados fictícios nos MESMOS tipos que os motores reais já
// consomem (EntradaOportunidades, lib/oportunidades-clientes.ts;
// ContextoNegocio, lib/recomendacoes.ts) — nunca escreve um texto final,
// nunca inventa receita, nunca sugere uma ação que o produto real não
// executa. Os motores reais e já homologados (gerarOportunidadesClientes,
// gerarCentralOportunidades) processam este dado exatamente como
// processariam um dado real — a honestidade do produto real (nunca
// fabricar receita, nunca automação sem confirmação humana) se aplica
// automaticamente aqui, porque este arquivo nunca decide prioridade,
// nunca decide texto — só fornece o insumo.
//
// Esta etapa NÃO integra nenhuma rota (nem /dashboard-demo, nem o
// Dashboard real) — só o gerador e seus testes.

import type { EntradaOportunidades } from "./oportunidades-clientes";
import type { ContextoNegocio } from "./recomendacoes";

export type CenarioDemonstracao = {
  hoje: string; // YYYY-MM-DD, sempre relativo ao momento da geração
  entradaOportunidades: EntradaOportunidades;
  contextoNegocio: ContextoNegocio;
};

function paraDataISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diasAtras(hoje: Date, dias: number): string {
  const d = new Date(hoje);
  d.setUTCDate(d.getUTCDate() - dias);
  return paraDataISO(d);
}

/**
 * Gera um cenário fictício, pequeno e plausível — não o "melhor cenário
 * possível" (ver docs/modo-demonstracao-v1-arquitetura.md, seção 7, risco 2:
 * "dado demo bom demais"). Três clientes nomeados, cada um com um sinal
 * diferente (cancelamento sem reagendamento, confirmação pendente,
 * sem próximo compromisso), e um contexto de negócio coerente com eles —
 * os números do ContextoNegocio nunca contradizem as entidades nomeadas
 * (ex.: `pendentesHoje` é exatamente a quantidade de confirmações
 * pendentes fornecidas, não um número solto).
 *
 * `agora` é injetável para tornar a geração determinística em teste —
 * sem argumento, usa a data real no momento da chamada (nunca uma data
 * fixa gravada no código, ao contrário da página estática que esta
 * fase substitui).
 */
export function gerarCenarioDemonstracao(agora: Date = new Date()): CenarioDemonstracao {
  const hoje = paraDataISO(agora);

  const clientesSemProximoCompromisso: EntradaOportunidades["clientesSemProximoCompromisso"] = [
    {
      id: "demo-cliente-carla",
      nome: "Carla Souza",
      telefone: "5511900000003",
      whatsapp: "5511900000003",
      proximaConsulta: null,
    },
  ];

  const cancelamentosSemReagendamento: EntradaOportunidades["cancelamentosSemReagendamento"] = [
    {
      id: "demo-agendamento-ana",
      nome: "Ana Ribeiro",
      telefone: "5511900000001",
      data: diasAtras(agora, 3),
    },
  ];

  const confirmacoesPendentes: EntradaOportunidades["confirmacoesPendentes"] = [
    {
      id: "demo-agendamento-bruno",
      nome: "Bruno Alves",
      telefone: "5511900000002",
      data: hoje,
    },
  ];

  const entradaOportunidades: EntradaOportunidades = {
    hoje,
    clientesSemProximoCompromisso,
    cancelamentosSemReagendamento,
    confirmacoesPendentes,
  };

  // Coerência entre entidades: cada número aqui é derivável do que já foi
  // declarado acima, ou de uma escolha explícita e plausível — nunca um
  // valor solto. Perfil completo (temEmail/temTelefone/temEndereco/
  // temWhatsapp = true) para o cenário focar nos sinais comerciais, não em
  // pendências de cadastro.
  const contextoNegocio: ContextoNegocio = {
    totalPacientes: 8,
    totalAgendamentos: 24,
    compromissosHoje: 4,
    pendentesHoje: confirmacoesPendentes.length,
    atrasados: 0,
    proximosSemana: 5,
    clientesParaReativar: clientesSemProximoCompromisso.length,
    cancelamentosHoje: cancelamentosSemReagendamento.filter(c => c.data === hoje).length,
    horariosVagosHoje: 2,
    avaliacoesPendentes: 1,
    temEmail: true,
    temTelefone: true,
    temEndereco: true,
    temWhatsapp: true,
  };

  return { hoje, entradaOportunidades, contextoNegocio };
}
