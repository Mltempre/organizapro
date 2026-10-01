// POST /api/pedidos/[id]/execucao — avança a EXECUÇÃO de uma venda
// (em andamento, retorno agendado, concluído, interrompido, abandonado).
// Rota autenticada de staff; só ação humana explícita, nenhuma automação.
//
// Dimensão separada de /api/pedidos/[id]/transicao (comercial/pagamento):
// mudar a execução nunca mexe em pedidos.status, em pagamento nem em
// estoque — "serviço concluído" não é "pagamento recebido". A regra é a
// mesma de Serviços contratados (lib/venda-execucao.ts), agora sobre o pedido.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import { registrarResultadoSeHouveDecisao } from "../../../../../lib/auditoria-resultado-persistencia";
import {
  EXECUCAO_STATUS, MOTIVOS_INTERRUPCAO, transicionarExecucao,
  type ExecucaoStatus, type MotivoInterrupcao,
} from "../../../../../lib/venda-execucao";
import type { PedidoStatus } from "../../../../../lib/motor-pedidos";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { clinica_id?: unknown; novo_status?: unknown; motivo_interrupcao?: unknown; proxima_data_prevista?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ sucesso: false, error: "Body inválido" }, { status: 400 });
  }
  const { clinica_id, novo_status, motivo_interrupcao, proxima_data_prevista } = body;

  if (typeof clinica_id !== "string" || !clinica_id || typeof novo_status !== "string" || !novo_status) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e novo_status são obrigatórios" }, { status: 400 });
  }
  if (!EXECUCAO_STATUS.includes(novo_status as ExecucaoStatus)) {
    return NextResponse.json({ sucesso: false, error: `novo_status deve ser um de: ${EXECUCAO_STATUS.join(", ")}` }, { status: 400 });
  }
  if (motivo_interrupcao !== undefined && !MOTIVOS_INTERRUPCAO.includes(motivo_interrupcao as MotivoInterrupcao)) {
    return NextResponse.json({ sucesso: false, error: `motivo_interrupcao deve ser um de: ${MOTIVOS_INTERRUPCAO.join(", ")}` }, { status: 400 });
  }
  if (proxima_data_prevista !== undefined && (typeof proxima_data_prevista !== "string" || !REGEX_DATA.test(proxima_data_prevista))) {
    return NextResponse.json({ sucesso: false, error: "proxima_data_prevista deve estar no formato AAAA-MM-DD" }, { status: 400 });
  }
  if (novo_status === "retorno_agendado" && proxima_data_prevista === undefined) {
    return NextResponse.json({ sucesso: false, error: "Informe a data do retorno." }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "pedido.execucao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: pedido, error: erroBusca } = await admin
    .from("pedidos")
    .select("id, clinica_id, status, execucao_status")
    .eq("id", id)
    .eq("clinica_id", clinica_id)
    .maybeSingle<{ id: string; clinica_id: string; status: PedidoStatus; execucao_status: ExecucaoStatus | null }>();
  if (erroBusca || !pedido) {
    logOperacao({ operacao: "pedido.execucao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "pedido nao encontrado nesta clinica" });
    return NextResponse.json({ sucesso: false, error: "Venda não encontrada" }, { status: 404 });
  }

  if (pedido.execucao_status === novo_status) {
    logOperacao({ operacao: "pedido.execucao", clinica_id, entidade_id: id, resultado: "sucesso", motivo: "replay — já estava neste status" });
    return NextResponse.json({ sucesso: true, idempotente: true, pedido });
  }

  const agora = new Date().toISOString();
  const resultado = transicionarExecucao(
    pedido,
    novo_status as ExecucaoStatus,
    { motivoInterrupcao: motivo_interrupcao as MotivoInterrupcao | undefined, proximaDataPrevista: proxima_data_prevista as string | undefined },
    agora
  );
  if (!resultado) {
    logOperacao({ operacao: "pedido.execucao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: `transicao invalida: ${pedido.execucao_status ?? "sem_execucao"} -> ${novo_status}` });
    return NextResponse.json(
      { sucesso: false, error: pedido.status === "cancelado" ? "Venda cancelada não tem execução a acompanhar." : `Transição inválida: '${pedido.execucao_status ?? "sem acompanhamento"}' não pode ir para '${novo_status}'` },
      { status: 409 }
    );
  }

  // Guarda otimista: só grava se a execução ainda é a que foi lida.
  let update = admin.from("pedidos").update(resultado).eq("id", id).eq("clinica_id", clinica_id);
  update = pedido.execucao_status === null ? update.is("execucao_status", null) : update.eq("execucao_status", pedido.execucao_status);
  const { data: atualizado, error: erroUpdate } = await update.select().maybeSingle();
  if (erroUpdate) {
    logOperacao({ operacao: "pedido.execucao", clinica_id, entidade_id: id, resultado: "erro", motivo: erroUpdate.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível atualizar a execução" }, { status: 400 });
  }
  if (!atualizado) {
    logOperacao({ operacao: "pedido.execucao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "estado mudou entre leitura e escrita (concorrência)" });
    return NextResponse.json({ sucesso: false, error: "A venda foi alterada por outra requisição — tente novamente" }, { status: 409 });
  }

  // Evento canônico da execução de venda (o histórico antigo "tratamento.*" não é reescrito).
  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: `pedido.execucao_${resultado.execucao_status}`,
    entidade_tipo: "pedido",
    entidade_id: id,
    chave_idempotencia: `${id}:pedido.execucao_${resultado.execucao_status}`,
    payload: { execucao_anterior: pedido.execucao_status, execucao_nova: resultado.execucao_status },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "pedido.execucao", clinica_id, entidade_id: id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
  }

  // Fecha decisão → resultado quando o Follow-up já registrou um caso para esta venda.
  await registrarResultadoSeHouveDecisao(admin, {
    clinicaId: clinica_id, entidadeTipo: "pedido", entidadeId: id,
    fatoObservado: `venda_execucao_${resultado.execucao_status}`, observadoEm: agora,
  });

  logOperacao({ operacao: "pedido.execucao", clinica_id, entidade_id: id, resultado: "sucesso", motivo: `${pedido.execucao_status ?? "sem_execucao"} -> ${resultado.execucao_status}` });
  return NextResponse.json({ sucesso: true, idempotente: false, pedido: atualizado });
}
