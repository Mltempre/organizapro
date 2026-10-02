// ── Prioridades canônicas — fonte única da Visão Geral e do Gerente ──────
//
// Visão Geral = resumo do que preciso saber (conta as prioridades).
// Gerente Comercial = lista completa do que preciso fazer agora.
// As duas telas montam as prioridades AQUI, com as mesmas 3 fontes e a mesma
// deduplicação, para nunca mais divergirem (antes: a Visão Geral contava as
// recomendações gerais do negócio e o Gerente não as listava — prioridades
// ficavam sem acesso).
//
// Nenhuma regra nova: só reúne o que já existia em app/dashboard/page.tsx —
//   1. consultarBaseDoNegocio: as mesmas consultas, na mesma ordem;
//   2. contextoNegocioDaBase: o mesmo contexto da Central de Oportunidades;
//   3. montarSinaisCanonicos: sinais de clientes + recomendações do negócio
//      (sem os agregados já cobertos pelos cards de cliente) + demanda.
// O cliente do banco é recebido por parâmetro (nunca importado aqui).

import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarCentralOportunidades, type ContextoNegocio } from "./recomendacoes";
import { obterHorariosVagos } from "./horarios";
import {
  adaptarOportunidadesClientes, adaptarRecomendacoes, adaptarOportunidadesDemanda,
  removerAgregadosCobertosPorClientes, type SinalCanonico,
} from "./nucleo-inteligente";
import type { OportunidadeCliente } from "./oportunidades-clientes";

export type DatasDaBase = { hoje: string; amanha: string; fimSete: string; trintaDiasAtras: string };

/** As consultas diretas da base do negócio — sempre filtradas pelo negócio, sempre nesta ordem. */
export function consultarBaseDoNegocio(db: SupabaseClient, cid: string, d: DatasDaBase) {
  return Promise.all([
    db.from("agendamentos")
      .select("id, hora, paciente_nome, telefone, tipo_consulta, status, data")
      .eq("clinica_id", cid).eq("data", d.hoje)
      .order("hora"),
    db.from("agendamentos")
      .select("id, hora, paciente_nome, tipo_consulta, status, data")
      .eq("clinica_id", cid)
      .gte("data", d.amanha).lte("data", d.fimSete)
      .not("status", "in", '("cancelado","faltou")')
      .order("data").order("hora"),
    db.from("agendamentos")
      .select("id, hora, paciente_nome, tipo_consulta, status, data")
      .eq("clinica_id", cid)
      .lt("data", d.hoje).eq("status", "agendado")
      .order("data", { ascending: false }).order("hora")
      .limit(20),
    db.from("pacientes")
      .select("*", { count: "exact", head: true })
      .eq("clinica_id", cid),
    // Clientes sem próxima consulta agendada (candidatos a reativação)
    db.from("pacientes")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", cid)
      .or(`proxima_consulta.is.null,proxima_consulta.lt.${d.hoje}`),
    // Já existe algum compromisso cadastrado (qualquer status/data)?
    db.from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", cid),
    // Avaliações já solicitadas e ainda sem resposta do cliente
    db.from("avaliacoes")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", cid)
      .eq("respondeu", false),
    db.from("clinica_config")
      .select("logo_url, email, telefone, endereco, nome_clinica, horario_funcionamento")
      .eq("clinica_id", cid)
      .maybeSingle(),
    // Sinal "sem próximo compromisso"
    db.from("pacientes")
      .select("id, nome, telefone, whatsapp, proxima_consulta")
      .eq("clinica_id", cid).eq("status", "ativo")
      .or(`proxima_consulta.is.null,proxima_consulta.lt.${d.hoje}`)
      .order("nome").limit(20),
    // Candidatos ao sinal "cancelamento sem reagendamento"
    db.from("agendamentos")
      .select("id, paciente_nome, telefone, data")
      .eq("clinica_id", cid).eq("status", "cancelado")
      .gte("data", d.trintaDiasAtras)
      .order("data", { ascending: false }).limit(50),
  ]);
}

/**
 * Telefones de cancelamentos recentes que JÁ têm compromisso futuro remarcado
 * (esses não viram sinal "cancelamento sem reagendamento"). Mesma consulta
 * que a Visão Geral sempre fez. Erro = não recomendar sem conferir o futuro.
 */
export async function consultarTelefonesComReagendamento(db: SupabaseClient, cid: string, telefones: string[], hoje: string): Promise<Set<string>> {
  if (telefones.length === 0) return new Set();
  const { data, error } = await db
    .from("agendamentos")
    .select("telefone")
    .eq("clinica_id", cid)
    .in("telefone", telefones)
    .gte("data", hoje)
    .not("status", "in", '("cancelado","faltou")');
  if (error) throw new Error("Não foi possível conferir os reagendamentos. Tente novamente.");
  return new Set(((data ?? []) as { telefone: string }[]).map(f => f.telefone));
}

type AgendamentoBase = { hora: string; status: string };
export type BaseDoNegocio = {
  agendaHoje: AgendamentoBase[];
  proximosSemana: number;
  atrasados: number;
  totalPacientes: number;
  clientesParaReativar: number;
  totalAgendamentos: number;
  avaliacoesPendentes: number;
  config: { email?: string | null; telefone?: string | null; endereco?: string | null; horario_funcionamento?: string | null } | null;
  temWhatsapp: boolean;
};

/** Contexto da Central de Oportunidades — mesmo cálculo que a Visão Geral sempre usou. */
export function contextoNegocioDaBase(b: BaseDoNegocio): ContextoNegocio {
  const ativos = b.agendaHoje.filter(a => !["cancelado", "faltou"].includes(a.status));
  return {
    totalPacientes:       b.totalPacientes,
    totalAgendamentos:    b.totalAgendamentos,
    compromissosHoje:     ativos.length,
    pendentesHoje:        b.agendaHoje.filter(a => a.status === "agendado").length,
    atrasados:            b.atrasados,
    proximosSemana:       b.proximosSemana,
    clientesParaReativar: b.clientesParaReativar,
    cancelamentosHoje:    b.agendaHoje.filter(a => a.status === "cancelado").length,
    horariosVagosHoje:    obterHorariosVagos(b.agendaHoje, b.config?.horario_funcionamento ?? undefined).length,
    avaliacoesPendentes:  b.avaliacoesPendentes,
    temEmail:             !!b.config?.email,
    temTelefone:          !!b.config?.telefone,
    temEndereco:          !!b.config?.endereco,
    temWhatsapp:          b.temWhatsapp,
  };
}

/**
 * Todas as prioridades canônicas, das 3 fontes. A ordem final é sempre a do
 * núcleo (organizarSinaisCanonicos / gerarEstadoComercialCanonico).
 */
export function montarSinaisCanonicos(entrada: {
  temDadosComerciais: boolean;
  oportunidadesClientes: OportunidadeCliente[];
  contexto: ContextoNegocio;
  oportunidadesDemanda: Parameters<typeof adaptarOportunidadesDemanda>[0];
}): SinalCanonico[] {
  if (!entrada.temDadosComerciais) return [];
  const central = gerarCentralOportunidades(entrada.contexto);
  const recomendacoes = [...central.alta, ...central.media, ...central.baixa];
  return [
    ...adaptarOportunidadesClientes(entrada.oportunidadesClientes),
    // Agregado cujo fato já aparece inteiro nos cards de cliente sai da lista.
    ...adaptarRecomendacoes(removerAgregadosCobertosPorClientes(recomendacoes, entrada.oportunidadesClientes)),
    ...adaptarOportunidadesDemanda(entrada.oportunidadesDemanda),
  ];
}
