// I/O compartilhado do Follow-up Comercial (consultas reais ao banco) —
// extraído de app/api/follow-up/tentativa/route.ts para ser reaproveitado
// também por app/api/follow-up/aprovar-envio/route.ts (WhatsApp Governado
// V1), sem duplicar a mesma query em dois arquivos. Mesmo padrão já usado
// em lib/google-business-profile-api.ts: I/O real fica fora do motor puro
// (lib/follow-up-comercial.ts), que continua sem nenhuma dependência de
// DB/HTTP.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  gerarFollowUpsComerciais, type TipoFollowUpProprio, type CasoFollowUp,
} from "./follow-up-comercial";
import { agregarClientesElegiveisRecompra } from "./motor-pedidos";
import { statusEfetivoOportunidade } from "./oportunidades-demanda";
import { acompanhamentoDaVenda, particionarVendas, type PedidoVenda } from "./venda-execucao";

/**
 * Relê a entidade real do banco (nunca confia no que o client mandou) e
 * reavalia pela MESMA função pura que gera a lista do Radar/Follow-up —
 * se ela não aparecer mais como elegível, retorna null. Nenhuma segunda
 * implementação da regra de elegibilidade.
 */
export async function reavaliarCasoFollowUp(
  admin: SupabaseClient,
  tipo: TipoFollowUpProprio,
  entidadeId: string,
  clinica_id: string,
  hoje: string,
  agora: string
): Promise<CasoFollowUp | null> {
  const entradaBase = {
    hoje, agora, entidadesComTentativaHoje: new Set<string>(),
    oportunidadesParadas: [], orcamentosParados: [], tratamentosSemRetorno: [], pedidosNaoConcluidos: [], recomprasPossiveis: [],
  };

  if (tipo === "oportunidade_parada") {
    // entidadeId aqui é o telefone normalizado (oportunidade não tem um
    // "id de caso" único e estável fora da própria oportunidade — várias
    // sinalizações do mesmo telefone contam como o mesmo caso de
    // follow-up, mesma decisão já usada em recompra_possivel).
    const { data } = await admin.from("oportunidades_demanda")
      .select("id, telefone, nome_informado, status, orcamento_vinculado_id, ultima_interacao_em, expira_em")
      .eq("clinica_id", clinica_id).eq("telefone_normalizado", entidadeId)
      .order("ultima_interacao_em", { ascending: false }).limit(1).maybeSingle();
    if (!data) return null;
    const resultado = gerarFollowUpsComerciais({ ...entradaBase, oportunidadesParadas: [{ id: data.id, telefone: data.telefone, pacienteNome: data.nome_informado || data.telefone, status: statusEfetivoOportunidade(data), orcamentoVinculadoId: data.orcamento_vinculado_id, ultimaInteracaoEm: data.ultima_interacao_em }] });
    return resultado[0] ?? null;
  }

  if (tipo === "orcamento_parado") {
    const { data } = await admin.from("orcamentos")
      .select("id, paciente_nome, telefone, procedimento, valor, apresentado_em")
      .eq("id", entidadeId).eq("clinica_id", clinica_id).eq("status", "apresentado").maybeSingle();
    if (!data) return null;
    const resultado = gerarFollowUpsComerciais({ ...entradaBase, orcamentosParados: [{ id: data.id, pacienteNome: data.paciente_nome, telefone: data.telefone, procedimento: data.procedimento, valor: data.valor, apresentadoEm: data.apresentado_em }] });
    return resultado[0] ?? null;
  }

  if (tipo === "tratamento_sem_retorno") {
    // Execução de VENDA (Pedidos = Venda/Execução única): entidadeId é o id
    // do pedido. "tratamento_sem_retorno" segue como chave estável do tipo.
    const { data } = await admin.from("pedidos")
      .select("*, pedido_itens(descricao, quantidade)")
      .eq("id", entidadeId).eq("clinica_id", clinica_id).neq("status", "cancelado")
      .in("execucao_status", ["em_andamento", "interrompido"]).maybeSingle();
    const t = data ? acompanhamentoDaVenda(data as PedidoVenda) : null;
    if (!t) return null;
    const resultado = gerarFollowUpsComerciais({ ...entradaBase, tratamentosSemRetorno: [{ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status, proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em }] });
    return resultado[0] ?? null;
  }

  if (tipo === "pedido_nao_concluido") {
    const { data } = await admin.from("pedidos")
      .select("*, pedido_itens(descricao)")
      .eq("id", entidadeId).eq("clinica_id", clinica_id).in("status", ["criado", "confirmado"]).maybeSingle();
    if (!data) return null;
    // Mesma partição das telas: venda com cobrança vinculada (a cobrança
    // assume o caso) ou com execução ativa (o caso é "sem retorno") não é
    // "pedido não concluído".
    const { data: cobrancasDaVenda } = await admin.from("cobrancas")
      .select("pedido_origem_id, status").eq("clinica_id", clinica_id).eq("pedido_origem_id", entidadeId);
    if (particionarVendas([data as PedidoVenda], cobrancasDaVenda ?? []).pedidosAReceber.length === 0) return null;
    const itens = data.pedido_itens as { descricao: string }[] | null;
    const descricao = itens?.length ? `${itens.length} ${itens.length === 1 ? "item" : "itens"}` : "pedido";
    const resultado = gerarFollowUpsComerciais({ ...entradaBase, pedidosNaoConcluidos: [{ id: data.id, pacienteNome: data.nome_cliente, telefone: data.telefone, descricao, valor: data.valor_centavos / 100, criadoEm: data.criado_em }] });
    return resultado[0] ?? null;
  }

  // recompra_possivel: entidadeId é o telefone normalizado do cliente —
  // relê TODOS os pedidos desse telefone na clínica e reaplica a mesma
  // agregação real já usada pelo Dashboard/Previsor.
  const { data: pedidosDoCliente } = await admin.from("pedidos")
    .select("id, paciente_id, nome_cliente, telefone, status, criado_em, pagamento_confirmado_em")
    .eq("clinica_id", clinica_id);
  const doTelefone = (pedidosDoCliente ?? []).filter((p) => (p.telefone || "").replace(/\D/g, "") === entidadeId);
  if (doTelefone.length === 0) return null;
  const recomprasPossiveis = agregarClientesElegiveisRecompra(
    doTelefone.map((p) => ({
      pacienteId: p.paciente_id, telefone: p.telefone, nomeCliente: p.nome_cliente,
      status: p.status, criadoEm: p.criado_em, pagamentoConfirmadoEm: p.pagamento_confirmado_em,
    }))
  );
  const resultado = gerarFollowUpsComerciais({ ...entradaBase, recomprasPossiveis });
  return resultado[0] ?? null;
}
