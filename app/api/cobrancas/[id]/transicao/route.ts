// POST /api/cobrancas/[id]/transicao — avança uma cobrança para o próximo
// estado (em_cobranca, pago, cancelada). Rota autenticada de staff.
// Nenhuma automação chama esta rota — só ação humana explícita.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import {
  transicionar, MOTIVOS_CANCELAMENTO,
  type Cobranca, type StatusCobranca, type MotivoCancelamento,
} from "../../../../../lib/motor-cobranca";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_VALIDOS: StatusCobranca[] = ["em_cobranca", "pago", "cancelada"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { clinica_id?: string; novo_status?: string; valor_pago?: number; motivo_cancelamento?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, novo_status, valor_pago, motivo_cancelamento } = body;

  if (!clinica_id || !novo_status) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e novo_status são obrigatórios" }, { status: 400 });
  }
  if (!STATUS_VALIDOS.includes(novo_status as StatusCobranca)) {
    return NextResponse.json(
      { sucesso: false, error: `novo_status deve ser um de: ${STATUS_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }
  if (valor_pago !== undefined && (typeof valor_pago !== "number" || !Number.isFinite(valor_pago) || valor_pago < 0)) {
    return NextResponse.json({ sucesso: false, error: "valor_pago deve ser um número não-negativo" }, { status: 400 });
  }
  if (motivo_cancelamento !== undefined && !MOTIVOS_CANCELAMENTO.includes(motivo_cancelamento as MotivoCancelamento)) {
    return NextResponse.json(
      { sucesso: false, error: `motivo_cancelamento deve ser um de: ${MOTIVOS_CANCELAMENTO.join(", ")}` },
      { status: 400 }
    );
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "cobranca.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: cobranca, error: erroBusca } = await admin
    .from("cobrancas")
    .select("*")
    .eq("id", id)
    .eq("clinica_id", clinica_id)
    .maybeSingle<Cobranca>();

  if (erroBusca || !cobranca) {
    logOperacao({ operacao: "cobranca.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "cobranca nao encontrada nesta clinica" });
    return NextResponse.json({ sucesso: false, error: "Cobrança não encontrada" }, { status: 404 });
  }

  if (cobranca.status === novo_status) {
    logOperacao({ operacao: "cobranca.transicao", clinica_id, entidade_id: id, resultado: "sucesso", motivo: "replay — já estava neste status" });
    return NextResponse.json({ sucesso: true, idempotente: true, cobranca });
  }

  const agora = new Date().toISOString();
  const resultado = transicionar(
    cobranca,
    novo_status as StatusCobranca,
    { valorPago: valor_pago, motivoCancelamento: motivo_cancelamento as MotivoCancelamento | undefined },
    agora
  );

  if (!resultado) {
    logOperacao({ operacao: "cobranca.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: `transicao invalida: ${cobranca.status} -> ${novo_status}` });
    return NextResponse.json(
      { sucesso: false, error: `Transição inválida: '${cobranca.status}' não pode ir para '${novo_status}'` },
      { status: 409 }
    );
  }

  const { data: atualizada, error: erroUpdate } = await admin
    .from("cobrancas")
    .update({ ...resultado, updated_at: agora })
    .eq("id", id)
    .eq("clinica_id", clinica_id) // defesa em profundidade — nenhuma escrita fica sem filtro de tenant
    .eq("status", cobranca.status) // guarda otimista contra concorrência — nunca duplica pagamento
    .select()
    .maybeSingle();

  if (erroUpdate) {
    logOperacao({ operacao: "cobranca.transicao", clinica_id, entidade_id: id, resultado: "erro", motivo: erroUpdate.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível processar a transição" }, { status: 400 });
  }
  if (!atualizada) {
    logOperacao({ operacao: "cobranca.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "estado mudou entre leitura e escrita (concorrência)" });
    return NextResponse.json({ sucesso: false, error: "A cobrança foi alterada por outra requisição — tente novamente" }, { status: 409 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: `cobranca.${resultado.status}`,
    entidade_tipo: "cobranca",
    entidade_id: id,
    chave_idempotencia: `${id}:cobranca.${resultado.status}`,
    payload: { status_anterior: cobranca.status, status_novo: resultado.status },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "cobranca.transicao", clinica_id, entidade_id: id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
  }

  logOperacao({ operacao: "cobranca.transicao", clinica_id, entidade_id: id, resultado: "sucesso", motivo: `${cobranca.status} -> ${resultado.status}` });
  return NextResponse.json({ sucesso: true, idempotente: false, cobranca: atualizada });
}
