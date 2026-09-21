// ── Follow-up Comercial Inteligente V1 ───────────────────────────────────
// Responde: "quem precisa de acompanhamento comercial agora, por quê,
// qual é a próxima ação e o que já foi feito?" Domínio puro (sem DB/
// HTTP), mesma filosofia de lib/receita-perdida.ts e lib/previsor-
// faturamento.ts: NUNCA um segundo Radar, NUNCA um segundo Cobrador,
// NUNCA uma segunda Agenda Autônoma — reusa literalmente os mesmos
// predicados reais já usados por esses motores (estaParado,
// precisaRetorno, diasSemAtividade, agregarClientesElegiveisRecompra) e
// aceita como entrada os próprios casos JÁ detectados por Cobrador
// Digital (cobranca_atrasada) e Agenda Autônoma (os 3 sinais dela),
// nunca redetectando nada.
//
// ── Precheck — o que já existia ──────────────────────────────────────
// A) DETECTA necessidade de ação: lib/oportunidades-clientes.ts (Radar),
//    lib/recomendacoes.ts (Central de Oportunidades), lib/receita-
//    perdida.ts, lib/previsor-faturamento.ts — todos já usam os mesmos
//    predicados reais reaproveitados aqui.
// B) JÁ REGISTRA ação realizada: eventos_dominio (tipo "cobranca.
//    tentativa", app/api/cobrancas/[id]/tentativa/route.ts, Cobrador
//    Digital V1) é o ÚNICO precedente real de "tentativa registrada"
//    com idempotência por dia — mesmo padrão literalmente reaproveitado
//    aqui, só com um `tipo` novo ("followup.tentativa"). Confirmado por
//    grep: orçamentos/tratamentos/pedidos só têm rota de "transicao"
//    (mudança de status), nenhum tinha uma rota de "tentativa" — por
//    isso são o escopo PRÓPRIO desta missão.
// C) O que faltava: um registro de tentativa genérico para os 4 sinais
//    do Radar que NÃO têm dono hoje (orcamento_parado, tratamento_sem_
//    retorno, pedido_nao_concluido, recompra_possivel) — cobranca_
//    atrasada (Cobrador Digital) e os 3 sinais de Agenda Autônoma
//    (cancelamento_sem_reagendamento, confirmacao_pendente, sem_
//    proximo_compromisso) JÁ têm fluxo canônico próprio e são só
//    REFERENCIADOS aqui (donoDoFluxo), nunca re-registrados.
//
// ── Ciclo controlado (nunca um flag manual solto) ───────────────────────
// NECESSIDADE (sinal real presente, mesmos predicados do Radar) ->
// PRÓXIMA AÇÃO (motivo + ação, texto factual) -> EXECUÇÃO/REGISTRO
// (tentativa via eventos_dominio, idempotente por dia) -> AGUARDANDO
// (mesma entidade já teve tentativa hoje) -> NOVO ACOMPANHAMENTO (dia
// seguinte, idempotência expira sozinha) OU ENCERRAMENTO (o dado real
// mudou — o caso simplesmente para de aparecer na entrada, igual
// Receita Perdida/Previsor já fazem; nunca um flag manual antigo).

import { estaParado, diasParado } from "./motor-orcamentos";
import { estaAtrasada, diasAtraso } from "./motor-cobranca";
import { precisaRetorno, diasSemAtividade, diasInterrompido, type StatusTratamento } from "./motor-tratamento";
import type { OrcamentoParadoInput, CobrancaAtrasadaInput, PedidoNaoConcluidoInput } from "./oportunidades-clientes";
import type { ClienteElegivelRecompra } from "./motor-pedidos";
import type { CasoAgendaAutonoma } from "./agenda-autonoma";
import type { OportunidadeStatus } from "./oportunidades-demanda";

export type TipoFollowUpProprio = "oportunidade_parada" | "orcamento_parado" | "tratamento_sem_retorno" | "pedido_nao_concluido" | "recompra_possivel";
export type DonoDoFluxo = "follow-up" | "cobrador-digital" | "agenda-autonoma";
export type StatusFollowUp = "elegivel" | "aguardando_retorno";

export type CasoFollowUp = {
  tipo: string; // TipoFollowUpProprio, ou o tipo original do caso delegado
  entidadeTipo: "orcamento" | "tratamento" | "pedido" | "cliente" | "cobranca" | "agendamento";
  entidadeId: string; // chave real usada no registro de tentativa (id da linha, ou telefone normalizado p/ recompra)
  pacienteNome: string;
  telefone: string | null;
  motivo: string;
  proximaAcao: string;
  destino: string;
  donoDoFluxo: DonoDoFluxo;
  status: StatusFollowUp | null; // null para casos delegados — quem controla o status deles é o próprio dono do fluxo
};

export type TratamentoParaFollowUp = {
  id: string;
  pacienteNome: string;
  telefone: string | null;
  tipoTratamento: string;
  status: StatusTratamento;
  proximaDataPrevista: string | null;
  updatedAt: string;
  interrompidoEm: string | null;
};

export type OportunidadeParaFollowUp = {
  id: string;
  telefone: string;
  pacienteNome: string;
  status: OportunidadeStatus;
  orcamentoVinculadoId: string | null;
  ultimaInteracaoEm: string; // timestamptz ISO, sempre presente no schema real
};

export type EntradaFollowUp = {
  hoje: string; // YYYY-MM-DD
  agora: string; // timestamptz ISO
  entidadesComTentativaHoje: ReadonlySet<string>; // entidade_id de eventos_dominio tipo "followup.tentativa" já criados hoje
  oportunidadesParadas: OportunidadeParaFollowUp[];
  orcamentosParados: OrcamentoParadoInput[];
  tratamentosSemRetorno: TratamentoParaFollowUp[];
  pedidosNaoConcluidos: PedidoNaoConcluidoInput[];
  recomprasPossiveis: ClienteElegivelRecompra[];
  // Delegados — já detectados por outro motor, nunca redetectados aqui.
  cobrancasAtrasadas?: CobrancaAtrasadaInput[];
  casosAgendaAutonoma?: CasoAgendaAutonoma[];
};

// Mesmo limiar de "pedido parado" e de "recompra possível" já usados em
// lib/receita-perdida.ts / lib/oportunidades-clientes.ts — documentado
// como literal duplicado ali, mesma decisão aqui: alterar um sem os
// outros quebra "mesmo sinal, mesma leitura em qualquer tela".
const DIAS_PARA_PEDIDO_PARADO = 2;
const DIAS_PARA_RECOMPRA = 60;
// Mesma escala de dias já usada para orçamento parado (lib/motor-
// orcamentos.ts, DIAS_PARA_CONSIDERAR_PARADO, privado naquele arquivo) —
// duplicado aqui como literal documentado, mesmo padrão já usado acima.
// Oportunidade sem orçamento gerado é o estágio mais cedo do funil; usa
// o mesmo limiar em vez de inventar uma escala nova.
const DIAS_PARA_OPORTUNIDADE_PARADA = 3;
const STATUS_TERMINAIS_OPORTUNIDADE: readonly OportunidadeStatus[] = ["convertida", "perdida", "expirada"];

// Mesma ordem relativa já usada em PESO_TIPO (lib/oportunidades-
// clientes.ts) entre os tipos próprios desta missão — nunca um score
// novo, só a prioridade já estabelecida no Radar. "oportunidade_parada"
// é o estágio mais cedo do funil — entra antes dos demais.
const PESO_TIPO: Record<TipoFollowUpProprio, number> = {
  oportunidade_parada: -1,
  orcamento_parado: 0,
  pedido_nao_concluido: 1,
  tratamento_sem_retorno: 2,
  recompra_possivel: 3,
};

function normalizarTelefone(t: string | null): string {
  return (t || "").replace(/\D/g, "");
}

/**
 * Gera a lista de casos de Follow-up (próprios + delegados) a partir de
 * dados já buscados pela tela (nenhuma consulta ao banco aqui — mesma
 * filosofia de gerarOportunidadesClientes). Determinístico.
 */
export function gerarFollowUpsComerciais(input: EntradaFollowUp): CasoFollowUp[] {
  const casos: CasoFollowUp[] = [];

  for (const op of input.oportunidadesParadas) {
    if (STATUS_TERMINAIS_OPORTUNIDADE.includes(op.status)) continue; // respeita o estado real — nunca reabre um caso encerrado
    if (op.orcamentoVinculadoId !== null) continue; // já avançou para orçamento — o caso agora é orcamento_parado, nunca os dois ao mesmo tempo
    const dias = diasSemAtividade(op.ultimaInteracaoEm, input.agora);
    if (dias < DIAS_PARA_OPORTUNIDADE_PARADA) continue;
    const chave = normalizarTelefone(op.telefone);
    if (!chave) continue; // sem telefone real, nunca fabrica um jeito de contatar
    casos.push({
      tipo: "oportunidade_parada", entidadeTipo: "cliente", entidadeId: chave,
      pacienteNome: op.pacienteNome, telefone: op.telefone,
      motivo: `Oportunidade sinalizada há ${dias} dia${dias === 1 ? "" : "s"}, ainda sem orçamento gerado.`,
      proximaAcao: "Entrar em contato para avançar a negociação",
      destino: "/oportunidades",
      donoDoFluxo: "follow-up",
      status: input.entidadesComTentativaHoje.has(chave) ? "aguardando_retorno" : "elegivel",
    });
  }

  for (const o of input.orcamentosParados) {
    if (!estaParado(o.apresentadoEm, input.agora)) continue;
    const dias = diasParado(o.apresentadoEm, input.agora);
    casos.push({
      tipo: "orcamento_parado", entidadeTipo: "orcamento", entidadeId: o.id,
      pacienteNome: o.pacienteNome, telefone: o.telefone ?? null,
      motivo: `Orçamento de ${o.procedimento} apresentado há ${dias} dia${dias === 1 ? "" : "s"}, sem decisão.`,
      proximaAcao: "Entrar em contato para esclarecer dúvidas e fechar",
      destino: "/orcamentos",
      donoDoFluxo: "follow-up",
      status: input.entidadesComTentativaHoje.has(o.id) ? "aguardando_retorno" : "elegivel",
    });
  }

  for (const t of input.tratamentosSemRetorno) {
    const emAndamentoSemRetorno = t.status === "em_andamento" && precisaRetorno({ status: t.status, proxima_data_prevista: t.proximaDataPrevista }, input.hoje);
    const interrompido = t.status === "interrompido" && !!t.interrompidoEm;
    if (!emAndamentoSemRetorno && !interrompido) continue;
    const dias = emAndamentoSemRetorno ? diasSemAtividade(t.updatedAt, input.agora) : diasInterrompido(t.interrompidoEm as string, input.agora);
    casos.push({
      tipo: "tratamento_sem_retorno", entidadeTipo: "tratamento", entidadeId: t.id,
      pacienteNome: t.pacienteNome, telefone: t.telefone ?? null,
      motivo: interrompido
        ? `Tratamento de ${t.tipoTratamento} interrompido há ${dias} dia${dias === 1 ? "" : "s"}.`
        : `Tratamento de ${t.tipoTratamento} sem retorno definido, ${dias} dia${dias === 1 ? "" : "s"} sem atualização.`,
      proximaAcao: "Entrar em contato para agendar o retorno",
      destino: "/tratamentos",
      donoDoFluxo: "follow-up",
      status: input.entidadesComTentativaHoje.has(t.id) ? "aguardando_retorno" : "elegivel",
    });
  }

  for (const p of input.pedidosNaoConcluidos) {
    const dias = diasSemAtividade(p.criadoEm, input.agora);
    if (dias < DIAS_PARA_PEDIDO_PARADO) continue;
    casos.push({
      tipo: "pedido_nao_concluido", entidadeTipo: "pedido", entidadeId: p.id,
      pacienteNome: p.pacienteNome, telefone: p.telefone ?? null,
      motivo: `Pedido de ${p.descricao} parado há ${dias} dia${dias === 1 ? "" : "s"} sem confirmação/pagamento.`,
      proximaAcao: "Entrar em contato para concluir o pedido",
      destino: "/pedidos",
      donoDoFluxo: "follow-up",
      status: input.entidadesComTentativaHoje.has(p.id) ? "aguardando_retorno" : "elegivel",
    });
  }

  for (const r of input.recomprasPossiveis) {
    const dias = diasSemAtividade(r.ultimoPedidoPagoEm, input.agora);
    if (dias < DIAS_PARA_RECOMPRA) continue;
    const chave = normalizarTelefone(r.telefone);
    if (!chave) continue; // sem telefone real, nunca fabrica um jeito de contatar
    casos.push({
      tipo: "recompra_possivel", entidadeTipo: "cliente", entidadeId: chave,
      pacienteNome: r.pacienteNome, telefone: r.telefone,
      motivo: `Não faz um pedido novo há ${dias} dias — pode ser hora de reativar.`,
      proximaAcao: "Oferecer um novo pedido",
      destino: "/pedidos",
      donoDoFluxo: "follow-up",
      status: input.entidadesComTentativaHoje.has(chave) ? "aguardando_retorno" : "elegivel",
    });
  }

  // ── Delegados — nunca redetectados, nunca com ação própria aqui ────
  for (const c of input.cobrancasAtrasadas ?? []) {
    if (!estaAtrasada(c.vencimento, input.hoje)) continue;
    const dias = diasAtraso(c.vencimento, input.hoje);
    casos.push({
      tipo: "cobranca_atrasada", entidadeTipo: "cobranca", entidadeId: c.id,
      pacienteNome: c.pacienteNome, telefone: c.telefone ?? null,
      motivo: `Cobrança de ${c.descricao} atrasada há ${dias} dia${dias === 1 ? "" : "s"}.`,
      proximaAcao: "Gerenciado pelo Cobrador Digital",
      destino: "/cobrancas",
      donoDoFluxo: "cobrador-digital",
      status: null,
    });
  }

  for (const a of input.casosAgendaAutonoma ?? []) {
    casos.push({
      tipo: a.tipo, entidadeTipo: "agendamento", entidadeId: a.id,
      pacienteNome: a.nome, telefone: a.telefone,
      motivo: a.motivo,
      proximaAcao: a.proximaAcao,
      destino: a.destino,
      donoDoFluxo: "agenda-autonoma",
      status: null,
    });
  }

  return casos.sort((x, y) => {
    // Casos próprios (com status conhecido) vêm antes dos delegados;
    // dentro dos próprios, mesma ordem de prioridade já usada no Radar.
    const pesoX = x.donoDoFluxo === "follow-up" ? PESO_TIPO[x.tipo as TipoFollowUpProprio] : 99;
    const pesoY = y.donoDoFluxo === "follow-up" ? PESO_TIPO[y.tipo as TipoFollowUpProprio] : 99;
    return pesoX - pesoY;
  });
}

export type MensagemFollowUp = { canal: "whatsapp"; texto: string };

const TEMPLATE_MENSAGEM: Record<TipoFollowUpProprio, (nome: string, motivo: string) => string> = {
  oportunidade_parada: (nome) => `Olá, ${nome}! Recebemos seu contato e ficamos à disposição para conversar melhor sobre o que você precisa.`,
  orcamento_parado: (nome) => `Olá, ${nome}! Vi que seu orçamento ainda está em aberto — posso ajudar a esclarecer alguma dúvida?`,
  tratamento_sem_retorno: (nome) => `Olá, ${nome}! Faz um tempo desde seu último contato com a gente — vamos agendar seu retorno?`,
  pedido_nao_concluido: (nome) => `Olá, ${nome}! Seu pedido ainda não foi concluído — posso ajudar a finalizar?`,
  recompra_possivel: (nome) => `Olá, ${nome}! Faz um tempo desde sua última compra — que tal conhecer as novidades?`,
};

/**
 * Mensagem profissional e parametrizável — nunca agressiva, nunca gerada
 * por IA. Nunca menciona valor, dívida, acordo, desconto ou promessa —
 * só confirma o relacionamento e convida ao contato. Motor separado do
 * envio: nunca chama nenhum adaptador de WhatsApp.
 */
export function prepararMensagemFollowUp(tipo: TipoFollowUpProprio, pacienteNome: string, motivo: string): MensagemFollowUp {
  return { canal: "whatsapp", texto: TEMPLATE_MENSAGEM[tipo](pacienteNome, motivo) };
}
