// ── Agenda Autônoma de Receita V1 · extração mínima e segura ────────────
// Os 3 sinais (cancelamento_sem_reagendamento, confirmacao_pendente,
// sem_proximo_compromisso) JÁ EXISTEM e já funcionam: computados em
// app/dashboard/page.tsx (queries reais a `agendamentos`/`pacientes`) e
// consumidos por lib/oportunidades-clientes.ts (Radar) e lib/ia-comercial.ts
// (Diretor). Este arquivo NUNCA reconstrói esse motor.
//
// A única regra que hoje só existe embutida no Dashboard, sem forma
// reexportável sem acoplar esta missão àquele arquivo (redesenho de
// Dashboard é proibido nesta missão), é a de "cancelamento ainda precisa
// de reagendamento": cruza cancelamentos recentes contra agendamentos
// futuros do mesmo telefone, deduplicando por telefone (só o cancelamento
// mais recente conta). `cancelamentosSemReagendamento` abaixo é a extração
// mínima dessa regra — app/dashboard/page.tsx continua com sua própria
// cópia inline, intocada; esta função passa a ser a versão canônica e
// testável, usada só por esta missão.
//
// `precisaConfirmacao` e a regra de "sem próximo compromisso" já são
// triviais (um filtro de status/data de uma linha) — restated aqui com
// nome canônico em vez de reimplementadas com lógica nova. A regra de
// "sem próximo compromisso" é idêntica à já usada internamente por
// gerarOportunidadesClientes (não exportada de lá), mesmo princípio de
// duplicação documentada já aplicado ao limiar de pedido em
// lib/receita-perdida.ts.

export type CancelamentoRecente = {
  id: string;
  nome: string;
  telefone: string;
  data: string; // YYYY-MM-DD do cancelamento
};

/**
 * Mesma regra hoje só embutida em app/dashboard/page.tsx: um cancelamento
 * só é um caso aberto se o telefone não tiver NENHUM agendamento futuro
 * ainda ativo (nunca cancelado/faltou — isso quem chama já filtrou ao
 * montar `telefonesComReagendamentoFuturo`). Telefones repetidos mantêm
 * só o cancelamento mais recente da lista de entrada — nunca dois casos
 * para o mesmo cliente.
 */
export function cancelamentosSemReagendamento(
  cancelamentosRecentes: CancelamentoRecente[],
  telefonesComReagendamentoFuturo: ReadonlySet<string>
): CancelamentoRecente[] {
  const resultado: CancelamentoRecente[] = [];
  const jaIncluidos = new Set<string>();
  for (const c of cancelamentosRecentes) {
    if (!c.telefone) continue;
    if (telefonesComReagendamentoFuturo.has(c.telefone)) continue;
    if (jaIncluidos.has(c.telefone)) continue;
    jaIncluidos.add(c.telefone);
    resultado.push(c);
  }
  return resultado;
}

/**
 * Mesmo predicado já usado por app/dashboard/page.tsx: um agendamento de
 * hoje só precisa de confirmação enquanto seu status continuar
 * "agendado" — "confirmado" (ou qualquer outro status real) já resolveu
 * o caso, nunca continua pendente.
 */
export function precisaConfirmacao(status: string): boolean {
  return status === "agendado";
}

/**
 * Mesma regra já usada internamente por gerarOportunidadesClientes
 * (lib/oportunidades-clientes.ts) para "sem_proximo_compromisso" — não
 * exportada de lá. Ausência de data (null) ou data passada, nunca
 * inferido de outra forma.
 */
export function semProximoCompromisso(proximaConsulta: string | null, hoje: string): boolean {
  return !proximaConsulta || proximaConsulta < hoje;
}

export type TipoCasoAgenda =
  | "cancelamento_sem_reagendamento"
  | "confirmacao_pendente"
  | "sem_proximo_compromisso";

export type CasoAgendaAutonoma = {
  tipo: TipoCasoAgenda;
  id: string;
  nome: string;
  telefone: string | null;
  motivo: string;
  proximaAcao: string;
  destino: string; // sempre a superfície real existente — nunca uma ação automática fingida
};

export type AgendamentoHojeInput = { id: string; nome: string; telefone: string | null; status: string };
export type ClienteAtivoInput = { id: string; nome: string; telefone: string | null; whatsapp: string | null; proximaConsulta: string | null };

export type EntradaAgendaAutonoma = {
  hoje: string; // YYYY-MM-DD
  cancelamentosRecentes: CancelamentoRecente[];
  telefonesComReagendamentoFuturo: ReadonlySet<string>;
  agendaHoje: AgendamentoHojeInput[];
  clientesAtivos: ClienteAtivoInput[];
};

function formatarDataBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const DESTINO_AGENDA = "/agendamentos";

/**
 * Gera os casos operacionais da Agenda Autônoma — nenhuma consulta ao
 * banco aqui (mesma filosofia de gerarOportunidadesClientes e
 * agregarReceitaPerdida: dado já buscado pela tela). Cada caso aponta
 * para /agendamentos, a única superfície real onde a ação de fato
 * acontece (criar/editar um agendamento real) — nunca uma ação fingida.
 */
export function gerarCasosAgendaAutonoma(input: EntradaAgendaAutonoma): CasoAgendaAutonoma[] {
  const casos: CasoAgendaAutonoma[] = [];

  for (const c of cancelamentosSemReagendamento(input.cancelamentosRecentes, input.telefonesComReagendamentoFuturo)) {
    casos.push({
      tipo: "cancelamento_sem_reagendamento",
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      motivo: `Cancelou o compromisso de ${formatarDataBr(c.data)} e ainda não tem um novo agendamento.`,
      proximaAcao: "Entrar em contato e reagendar",
      destino: DESTINO_AGENDA,
    });
  }

  for (const a of input.agendaHoje) {
    if (!precisaConfirmacao(a.status)) continue;
    casos.push({
      tipo: "confirmacao_pendente",
      id: a.id,
      nome: a.nome,
      telefone: a.telefone,
      motivo: "Tem um compromisso hoje que ainda não foi confirmado.",
      proximaAcao: "Confirmar presença com o cliente",
      destino: DESTINO_AGENDA,
    });
  }

  for (const c of input.clientesAtivos) {
    if (!semProximoCompromisso(c.proximaConsulta, input.hoje)) continue;
    casos.push({
      tipo: "sem_proximo_compromisso",
      id: c.id,
      nome: c.nome,
      telefone: c.whatsapp || c.telefone,
      motivo: "Não tem nenhum próximo compromisso agendado.",
      proximaAcao: "Oferecer um novo horário",
      destino: DESTINO_AGENDA,
    });
  }

  return casos;
}
