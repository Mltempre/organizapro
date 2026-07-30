// ── Dados de Demonstração V1 — Fase 3 (+ ajuste comercial, Etapa 6) ──────
// Ver docs/modo-demonstracao-v1-arquitetura.md, seções 4 e 9. Fornece dados
// fictícios nos MESMOS tipos que os motores reais já consomem
// (EntradaOportunidades, lib/oportunidades-clientes.ts; ContextoNegocio,
// lib/recomendacoes.ts) — nunca escreve um texto final, nunca inventa
// receita, nunca sugere uma ação que o produto real não executa. Os motores
// reais e já homologados (gerarOportunidadesClientes, gerarCentralOportuni-
// dades, gerarProximasAcoes, gerarRecomendacoesConsultivas, Diretor Digital,
// Radar, Central de Oportunidades, Próxima Melhor Ação, Missão do Dia)
// processam este dado exatamente como processariam um dado real — nenhum
// deles foi alterado nesta etapa.
//
// `agendaHoje`/`proximosDias` (Etapa 6 — KENSA Comercial Final) fornecem só
// o suficiente para que Foco do Dia, Próximos 7 Dias e Lembretes deixem de
// aparecer vazios na demonstração — mesma ideia de "mockar a entrada", só
// que para a camada de agenda, que a Fase 3 não cobria ainda. `agendaHoje`
// reaproveita a mesma pessoa já usada em `confirmacoesPendentes` (nenhum
// evento novo é inventado, só a mesma pendência aparece também como um
// horário do dia). `proximosDias` traz duas pessoas sem nenhum sinal de
// oportunidade — só agenda normal, para o painel não parecer "só
// problemas para resolver".
//
// Esta etapa NÃO integra o Dashboard real — só /dashboard-demo.

import type { EntradaOportunidades } from "./oportunidades-clientes";
import type { ContextoNegocio } from "./recomendacoes";

export type CenarioDemonstracao = {
  hoje: string; // YYYY-MM-DD, sempre relativo ao momento da geração
  entradaOportunidades: EntradaOportunidades;
  contextoNegocio: ContextoNegocio;
  agendaHoje: ItemAgendaDemo[];
  proximosDias: ItemAgendaDemo[];
};

export type ItemAgendaDemo = {
  id: string;
  hora: string;
  paciente_nome: string;
  status: "agendado" | "confirmado";
  data: string; // YYYY-MM-DD
};

function paraDataISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diasAtras(hoje: Date, dias: number): string {
  const d = new Date(hoje);
  d.setUTCDate(d.getUTCDate() - dias);
  return paraDataISO(d);
}

function diasNaFrente(hoje: Date, dias: number): string {
  const d = new Date(hoje);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraDataISO(d);
}

/**
 * Gera um cenário fictício, pequeno e plausível — não o "melhor cenário
 * possível" (ver docs/modo-demonstracao-v1-arquitetura.md, seção 7, risco 2:
 * "dado demo bom demais"). Quatro clientes nomeados, cada um com um sinal
 * diferente ou complementar (cancelamento sem reagendamento, confirmação
 * pendente, dois casos de cliente sem próximo compromisso), mais dois
 * clientes de agenda "normal" (sem nenhum sinal) — e um contexto de negócio
 * coerente com todos eles. Números de escala (totalPacientes,
 * totalAgendamentos, compromissosHoje) representam uma empresa pequena já
 * em operação — nunca perfeita, nunca exagerada.
 *
 * `agora` é injetável para tornar a geração determinística em teste — sem
 * argumento, usa a data real no momento da chamada (nunca uma data fixa
 * gravada no código).
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
    {
      id: "demo-cliente-diego",
      nome: "Diego Fernandes",
      telefone: "5511900000004",
      whatsapp: "5511900000004",
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

  // Foco do Dia — a mesma pendência de Bruno Alves (já declarada acima),
  // agora também como um horário concreto de hoje. Nenhum evento novo.
  const agendaHoje: ItemAgendaDemo[] = [
    { id: "demo-foco-bruno", hora: "15:00", paciente_nome: "Bruno Alves", status: "agendado", data: hoje },
  ];

  // Próximos 7 Dias — agenda normal, sem nenhum sinal de oportunidade
  // associado, para mostrar que nem tudo na operação é um problema a
  // resolver. Cinco compromissos (>= 5) para que o motor de Central de
  // Oportunidades não acione as recomendações de "agenda vazia"/"poucos
  // compromissos" (lib/recomendacoes.ts) — ambas mencionam "receita
  // prevista", termo proibido na demonstração; não é uma regra nova, é só
  // manter o cenário fora da faixa que já aciona esse texto no motor real.
  const proximosDias: ItemAgendaDemo[] = [
    { id: "demo-proximo-patricia", hora: "10:00", paciente_nome: "Patrícia Lima", status: "confirmado", data: diasNaFrente(agora, 1) },
    { id: "demo-proximo-rafael",   hora: "14:00", paciente_nome: "Rafael Nunes",  status: "agendado",   data: diasNaFrente(agora, 2) },
    { id: "demo-proximo-juliana",  hora: "09:30", paciente_nome: "Juliana Alves", status: "confirmado", data: diasNaFrente(agora, 3) },
    { id: "demo-proximo-fernando", hora: "16:00", paciente_nome: "Fernando Costa", status: "agendado",  data: diasNaFrente(agora, 4) },
    { id: "demo-proximo-beatriz",  hora: "11:00", paciente_nome: "Beatriz Santos", status: "confirmado", data: diasNaFrente(agora, 6) },
  ];

  // Coerência entre entidades: cada número aqui é derivável do que já foi
  // declarado acima, ou de uma escolha explícita e plausível — nunca um
  // valor solto. Perfil completo (temEmail/temTelefone/temEndereco/
  // temWhatsapp = true) para o cenário focar nos sinais comerciais, não em
  // pendências de cadastro.
  const contextoNegocio: ContextoNegocio = {
    totalPacientes: 31,
    totalAgendamentos: 94,
    compromissosHoje: agendaHoje.length + 5,
    pendentesHoje: confirmacoesPendentes.length,
    atrasados: 0,
    proximosSemana: proximosDias.length,
    clientesParaReativar: clientesSemProximoCompromisso.length,
    cancelamentosHoje: cancelamentosSemReagendamento.filter(c => c.data === hoje).length,
    horariosVagosHoje: 2,
    avaliacoesPendentes: 1,
    temEmail: true,
    temTelefone: true,
    temEndereco: true,
    temWhatsapp: true,
  };

  return { hoje, entradaOportunidades, contextoNegocio, agendaHoje, proximosDias };
}
