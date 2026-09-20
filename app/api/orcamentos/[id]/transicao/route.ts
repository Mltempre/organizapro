// POST /api/orcamentos/[id]/transicao — avança um orçamento para um estado
// final (aprovado, recusado, expirado). Rota autenticada de staff. Nenhuma
// automação chama esta rota — só ação humana explícita.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import {
  transicionar, MOTIVOS_DECISAO,
  type Orcamento, type StatusOrcamento, type MotivoDecisao,
} from "../../../../../lib/motor-orcamentos";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_VALIDOS: StatusOrcamento[] = ["aprovado", "recusado", "expirado"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { clinica_id?: string; novo_status?: string; motivo_decisao?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, novo_status, motivo_decisao } = body;

  if (!clinica_id || !novo_status) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e novo_status são obrigatórios" }, { status: 400 });
  }
  if (!STATUS_VALIDOS.includes(novo_status as StatusOrcamento)) {
    return NextResponse.json(
      { sucesso: false, error: `novo_status deve ser um de: ${STATUS_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }
  if (motivo_decisao !== undefined && !MOTIVOS_DECISAO.includes(motivo_decisao as MotivoDecisao)) {
    return NextResponse.json(
      { sucesso: false, error: `motivo_decisao deve ser um de: ${MOTIVOS_DECISAO.join(", ")}` },
      { status: 400 }
    );
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "orcamento.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: orcamento, error: erroBusca } = await admin
    .from("orcamentos")
    .select("*")
    .eq("id", id)
    .eq("clinica_id", clinica_id) // nunca confia no id sozinho — precisa pertencer à clínica autorizada
    .maybeSingle<Orcamento>();

  if (erroBusca || !orcamento) {
    logOperacao({ operacao: "orcamento.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "orcamento nao encontrado nesta clinica" });
    return NextResponse.json({ sucesso: false, error: "Orçamento não encontrado" }, { status: 404 });
  }

  // Idempotência de retry: já está exatamente no status pedido -> sucesso,
  // não erro.
  if (orcamento.status === novo_status) {
    logOperacao({ operacao: "orcamento.transicao", clinica_id, entidade_id: id, resultado: "sucesso", motivo: "replay — já estava neste status" });
    return NextResponse.json({ sucesso: true, idempotente: true, orcamento });
  }

  const agora = new Date().toISOString();
  const resultado = transicionar(orcamento, novo_status as StatusOrcamento, motivo_decisao as MotivoDecisao | undefined, agora);

  if (!resultado) {
    logOperacao({ operacao: "orcamento.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: `transicao invalida: ${orcamento.status} -> ${novo_status}` });
    return NextResponse.json(
      { sucesso: false, error: `Transição inválida: '${orcamento.status}' não pode ir para '${novo_status}' — estados finais nunca transicionam` },
      { status: 409 }
    );
  }

  const { data: atualizado, error: erroUpdate } = await admin
    .from("orcamentos")
    .update({ ...resultado, updated_at: agora })
    .eq("id", id)
    .eq("clinica_id", clinica_id) // defesa em profundidade — mesmo já confirmado no SELECT acima, nenhuma escrita fica sem filtro de tenant
    .eq("status", orcamento.status) // guarda otimista contra concorrência
    .select()
    .maybeSingle();

  if (erroUpdate) {
    logOperacao({ operacao: "orcamento.transicao", clinica_id, entidade_id: id, resultado: "erro", motivo: erroUpdate.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível processar a transição" }, { status: 400 });
  }
  if (!atualizado) {
    logOperacao({ operacao: "orcamento.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "estado mudou entre leitura e escrita (concorrência)" });
    return NextResponse.json({ sucesso: false, error: "O orçamento foi alterado por outra requisição — tente novamente" }, { status: 409 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: `orcamento.${resultado.status}`,
    entidade_tipo: "orcamento",
    entidade_id: id,
    chave_idempotencia: `${id}:orcamento.${resultado.status}`,
    payload: { status_anterior: orcamento.status, status_novo: resultado.status, motivo_decisao: resultado.motivo_decisao },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "orcamento.transicao", clinica_id, entidade_id: id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
  }

  logOperacao({ operacao: "orcamento.transicao", clinica_id, entidade_id: id, resultado: "sucesso", motivo: `${orcamento.status} -> ${resultado.status}` });
  return NextResponse.json({ sucesso: true, idempotente: false, orcamento: atualizado });
}
