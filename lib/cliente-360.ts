// ── Cliente 360 V1 ────────────────────────────────────────────────────
// Responde: "quando a empresa abre um cliente, consegue enxergar em um
// único lugar a história comercial real desse cliente?" Domínio puro
// (sem DB/HTTP), mesma filosofia de lib/linha-economica.ts: NUNCA um CRM
// paralelo, NUNCA uma segunda tabela de clientes — public.pacientes
// continua sendo a única fonte da identidade do cliente. Este motor só
// FILTRA e ORGANIZA cronologicamente dados já reais de outros domínios,
// nunca inventa, nunca soma dinheiro em mais de um estágio da mesma
// cadeia (regra reutilizada literalmente de lib/linha-economica.ts).
//
// ── Identidade do cliente — investigado campo a campo no schema real ────
// tratamentos.paciente_id, cobrancas.paciente_id, pedidos.paciente_id:
// FKs reais para public.pacientes(id) — usados quando presentes (nem
// sempre são: um tratamento/cobrança/pedido avulso pode não ter
// paciente cadastrado).
// orcamentos: NÃO tem paciente_id no schema real (schema-producao-
// organizapro-20260919.sql, bloco CREATE TABLE public.orcamentos) — só
// paciente_nome/telefone. Gap estrutural real, documentado, não
// contornado com migration.
// agendamentos.paciente_id: existe no schema, mas nenhum código do
// produto o escreve (grep confirmado em app/agendamentos/page.tsx — o
// insert de um novo agendamento nunca inclui paciente_id) — coluna
// dormente, mesmo padrão já encontrado em oportunidades_demanda.
// receita_atribuida durante a missão da Linha Econômica.
// avaliacoes: tem agendamento_id (não paciente_id) — mesmo gap.
// oportunidades_demanda.paciente_vinculado_id: também dormente (mesmo
// achado da Linha Econômica) — nunca escrito.
//
// Por isso, para agendamentos/orçamentos/oportunidades/avaliações, o
// ÚNICO identificador comum e confiável hoje é o TELEFONE NORMALIZADO
// (só dígitos) — mesmo padrão já adotado em todo o produto (lib/
// oportunidades-clientes.ts, lib/agenda-autonoma.ts, lib/atribuicao-
// origem.ts) para agrupar por cliente quando não há FK real. Não é uma
// correlação nova: é o mesmo critério de identidade já aceito e usado
// em produção em todos os outros motores. Nunca correlaciona por nome.
//
// Regra de vínculo, por domínio: usa paciente_id quando o registro tem
// um E ele bate com o cliente-alvo; OU usa telefone normalizado quando
// bate com o telefone/whatsapp do cliente-alvo. Um registro sem
// paciente_id E sem telefone que bata simplesmente não entra — nunca
// incluído por suposição.

import { normalizarTelefone, type OportunidadeStatus } from "./oportunidades-demanda";
import type { StatusOrcamento } from "./motor-orcamentos";
import type { StatusTratamento } from "./motor-tratamento";
import type { StatusCobranca } from "./motor-cobranca";

// Duplicado de lib/oportunidades-demanda.ts (STATUS_TERMINAIS, privado
// naquele arquivo) — mesma decisão já documentada em lib/receita-
// perdida.ts (DIAS_PARA_PEDIDO_PARADO): alterar um sem o outro quebra a
// promessa de "mesmo sinal, mesma leitura em qualquer tela".
const STATUS_TERMINAIS_OPORTUNIDADE: readonly OportunidadeStatus[] = ["convertida", "perdida", "expirada"];

export type ClienteAlvo = {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  proximaConsulta: string | null;
  criadoEm: string;
};

export type AgendamentoDoCliente = { id: string; telefone: string | null; data: string; hora: string; tipoConsulta: string; status: string };
export type OportunidadeDoCliente = { id: string; telefone: string; canal: "whatsapp" | "manual" | "site"; status: OportunidadeStatus; criadoEm: string; ultimaInteracaoEm: string };
export type OrcamentoDoCliente = { id: string; telefone: string | null; procedimento: string; valor: number; status: StatusOrcamento; apresentadoEm: string; decididoEm: string | null };
export type TratamentoDoCliente = { id: string; pacienteId: string | null; telefone: string | null; tipoTratamento: string; status: StatusTratamento; valorEstimado: number | null; proximaDataPrevista: string | null; iniciadoEm: string; concluidoEm: string | null };
export type CobrancaDoCliente = { id: string; pacienteId: string | null; telefone: string | null; descricao: string; valor: number; valorPago: number | null; vencimento: string; status: StatusCobranca; pagoEm: string | null; emCobrancaEm: string | null };
export type PedidoDoCliente = { id: string; pacienteId: string | null; telefone: string | null; descricao: string; valor: number; status: "criado" | "confirmado" | "aguardando_confirmacao_pagamento" | "pago" | "cancelado"; criadoEm: string; pagamentoConfirmadoEm: string | null };
export type AvaliacaoDoCliente = { id: string; telefone: string | null; enviadoEm: string | null; respondeu: boolean; clicadoEm: string | null };

export type EntradaCliente360 = {
  cliente: ClienteAlvo;
  agora: string; // timestamptz ISO
  agendamentos: AgendamentoDoCliente[]; // TODOS da clínica — a função filtra por telefone
  oportunidades: OportunidadeDoCliente[];
  orcamentos: OrcamentoDoCliente[];
  tratamentos: TratamentoDoCliente[];
  cobrancas: CobrancaDoCliente[];
  pedidos: PedidoDoCliente[];
  avaliacoes: AvaliacaoDoCliente[];
};

export type TipoEventoTimeline = "agendamento" | "oportunidade" | "orcamento" | "tratamento" | "cobranca" | "pagamento_cobranca" | "pedido" | "pagamento_pedido" | "avaliacao";

export type EventoTimeline = {
  tipo: TipoEventoTimeline;
  data: string; // ISO ou YYYY-MM-DD, o que o dado real tiver
  descricao: string;
  valor: number | null;
  destino: string;
};

export type IndicadoresCliente = {
  totalPago: number; // cobrancas.valor_pago + pedidos.valor pagos — só estágio terminal, nunca orçamento/tratamento
  totalEmAberto: number; // cobrancas pendente/em_cobranca deste cliente
  quantidadeCompras: number; // pedidos 'pago' deste cliente
  ultimoRelacionamento: string | null; // data do evento mais recente da timeline até agora (nunca futuro)
  proximoCompromisso: string | null; // agendamento futuro mais próximo com status 'agendado'
  temOportunidadeAtiva: boolean; // oportunidade deste cliente em status não terminal
};

export type ResumoCliente360 = {
  cliente: ClienteAlvo;
  indicadores: IndicadoresCliente;
  oportunidades: OportunidadeDoCliente[];
  orcamentos: OrcamentoDoCliente[];
  tratamentos: TratamentoDoCliente[];
  cobrancas: CobrancaDoCliente[];
  pedidos: PedidoDoCliente[];
  timeline: EventoTimeline[]; // mais recente primeiro
};

function telefonesDoCliente(cliente: ClienteAlvo): Set<string> {
  const set = new Set<string>();
  if (cliente.telefone) set.add(normalizarTelefone(cliente.telefone));
  if (cliente.whatsapp) set.add(normalizarTelefone(cliente.whatsapp));
  set.delete(""); // telefone vazio nunca é uma chave de identidade válida
  return set;
}

function pertenceAoCliente(
  telefonesAlvo: Set<string>,
  clienteId: string,
  registro: { pacienteId?: string | null; telefone: string | null }
): boolean {
  if (registro.pacienteId && registro.pacienteId === clienteId) return true;
  if (!registro.telefone) return false;
  return telefonesAlvo.has(normalizarTelefone(registro.telefone));
}

/**
 * Gera a visão Cliente 360 a partir de dados já buscados pela tela
 * (nenhuma consulta ao banco aqui — mesma filosofia de
 * gerarLinhaEconomica). Determinístico: mesma entrada sempre produz o
 * mesmo resultado.
 */
export function gerarCliente360(input: EntradaCliente360): ResumoCliente360 {
  const telefonesAlvo = telefonesDoCliente(input.cliente);

  const oportunidades = input.oportunidades.filter((o) => pertenceAoCliente(telefonesAlvo, input.cliente.id, { telefone: o.telefone }));
  const orcamentos = input.orcamentos.filter((o) => pertenceAoCliente(telefonesAlvo, input.cliente.id, { telefone: o.telefone }));
  const tratamentos = input.tratamentos.filter((t) => pertenceAoCliente(telefonesAlvo, input.cliente.id, { pacienteId: t.pacienteId, telefone: t.telefone }));
  const cobrancas = input.cobrancas.filter((c) => pertenceAoCliente(telefonesAlvo, input.cliente.id, { pacienteId: c.pacienteId, telefone: c.telefone }));
  const pedidos = input.pedidos.filter((p) => pertenceAoCliente(telefonesAlvo, input.cliente.id, { pacienteId: p.pacienteId, telefone: p.telefone }));
  const agendamentos = input.agendamentos.filter((a) => pertenceAoCliente(telefonesAlvo, input.cliente.id, { telefone: a.telefone }));
  const avaliacoes = input.avaliacoes.filter((av) => pertenceAoCliente(telefonesAlvo, input.cliente.id, { telefone: av.telefone }));

  // ── Timeline — só fatos reais, nunca um evento fabricado ────────────
  const timeline: EventoTimeline[] = [];
  for (const a of agendamentos) {
    timeline.push({ tipo: "agendamento", data: `${a.data}T${a.hora}`, descricao: `Compromisso: ${a.tipoConsulta} (${a.status})`, valor: null, destino: "/agendamentos" });
  }
  for (const o of oportunidades) {
    timeline.push({ tipo: "oportunidade", data: o.criadoEm, descricao: `Oportunidade sinalizada via ${o.canal}`, valor: null, destino: "/oportunidades" });
  }
  for (const o of orcamentos) {
    timeline.push({ tipo: "orcamento", data: o.apresentadoEm, descricao: `Orçamento apresentado: ${o.procedimento}`, valor: o.valor, destino: "/orcamentos" });
    if (o.decididoEm) timeline.push({ tipo: "orcamento", data: o.decididoEm, descricao: `Orçamento ${o.status}: ${o.procedimento}`, valor: o.valor, destino: "/orcamentos" });
  }
  for (const t of tratamentos) {
    timeline.push({ tipo: "tratamento", data: t.iniciadoEm, descricao: `Tratamento iniciado: ${t.tipoTratamento}`, valor: t.valorEstimado, destino: "/tratamentos" });
    if (t.concluidoEm) timeline.push({ tipo: "tratamento", data: t.concluidoEm, descricao: `Tratamento concluído: ${t.tipoTratamento}`, valor: t.valorEstimado, destino: "/tratamentos" });
  }
  for (const c of cobrancas) {
    timeline.push({ tipo: "cobranca", data: c.vencimento, descricao: `Cobrança registrada: ${c.descricao}`, valor: c.valor, destino: "/cobrancas" });
    if (c.status === "pago" && c.pagoEm) timeline.push({ tipo: "pagamento_cobranca", data: c.pagoEm, descricao: `Pagamento recebido: ${c.descricao}`, valor: c.valorPago, destino: "/cobrancas" });
  }
  for (const p of pedidos) {
    timeline.push({ tipo: "pedido", data: p.criadoEm, descricao: `Pedido: ${p.descricao}`, valor: p.valor, destino: "/pedidos" });
    if (p.status === "pago" && p.pagamentoConfirmadoEm) timeline.push({ tipo: "pagamento_pedido", data: p.pagamentoConfirmadoEm, descricao: `Pagamento de pedido confirmado`, valor: p.valor, destino: "/pedidos" });
  }
  for (const av of avaliacoes) {
    if (av.enviadoEm) timeline.push({ tipo: "avaliacao", data: av.enviadoEm, descricao: av.respondeu ? "Avaliação solicitada e respondida" : "Avaliação solicitada", valor: null, destino: "/reputacao" });
  }
  timeline.sort((a, b) => b.data.localeCompare(a.data)); // mais recente primeiro

  // ── Indicadores — só quando o dado real sustenta, nunca inventado ───
  // Mesma regra da Linha Econômica: só o estágio terminal (valor_pago /
  // valor de pedido pago) soma dinheiro — nunca orçamento nem
  // valor_estimado de tratamento, para nunca contar a mesma venda duas
  // vezes ao atravessar orçamento -> tratamento -> cobrança.
  const cobrancasPagas = cobrancas.filter((c) => c.status === "pago" && c.valorPago !== null);
  const pedidosPagos = pedidos.filter((p) => p.status === "pago");
  const totalPagoCobrancas = cobrancasPagas.reduce((s, c) => s + (c.valorPago as number), 0);
  const totalPagoPedidos = pedidosPagos.reduce((s, p) => s + p.valor, 0);
  const totalPago = totalPagoCobrancas + totalPagoPedidos;

  const totalEmAberto = cobrancas
    .filter((c) => c.status === "pendente" || c.status === "em_cobranca")
    .reduce((s, c) => s + c.valor, 0);

  const eventosPassados = timeline.filter((e) => e.data <= input.agora);
  const ultimoRelacionamento = eventosPassados.length > 0 ? eventosPassados[0].data : null;

  const proximoCompromisso = agendamentos
    .filter((a) => a.status === "agendado" && `${a.data}T${a.hora}` >= input.agora)
    .map((a) => `${a.data}T${a.hora}`)
    .sort()[0] ?? null;

  const temOportunidadeAtiva = oportunidades.some((o) => !STATUS_TERMINAIS_OPORTUNIDADE.includes(o.status));

  return {
    cliente: input.cliente,
    indicadores: {
      totalPago,
      totalEmAberto,
      quantidadeCompras: pedidosPagos.length,
      ultimoRelacionamento,
      proximoCompromisso,
      temOportunidadeAtiva,
    },
    oportunidades,
    orcamentos,
    tratamentos,
    cobrancas,
    pedidos,
    timeline,
  };
}
