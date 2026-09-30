// GET  /api/estoque/movimentos?clinica_id=…&servico_id=…  — histórico do item.
// POST /api/estoque/movimentos — entrada ou ajuste manual (saldo contado).
// Estoque Comercial Básico V1: operacional/comercial apenas. A escrita é
// sempre a função transacional estoque_registrar_movimento_v1 (saldo nunca
// negativo, idempotente pela chave); o autor vem da sessão, nunca do corpo.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { estoqueIndisponivelNoBanco, MENSAGEM_ERRO_MOVIMENTO, validarMovimentoManual } from "../../../../lib/motor-estoque";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const clinicaId = params.get("clinica_id"), servicoId = params.get("servico_id");
  if (!clinicaId || !servicoId) return NextResponse.json({ sucesso: false, error: "clinica_id e servico_id são obrigatórios" }, { status: 400 });
  const auth = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!auth.ok) return NextResponse.json({ sucesso: false, error: auth.error }, { status: auth.status });

  const { data, error } = await admin.from("estoque_movimentos")
    .select("id, tipo, quantidade, saldo_apos, motivo, pedido_id, autor_id, criado_em")
    .eq("clinica_id", clinicaId).eq("servico_id", servicoId)
    .order("criado_em", { ascending: false }).limit(100);
  if (estoqueIndisponivelNoBanco(error)) return NextResponse.json({ sucesso: false, error: "O controle de estoque ainda não foi ativado." }, { status: 503 });
  if (error || !Array.isArray(data)) return NextResponse.json({ sucesso: false, error: "Não foi possível carregar o histórico" }, { status: 503 });
  return NextResponse.json({ sucesso: true, movimentos: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.clinica_id !== "string" || typeof body.servico_id !== "string" || typeof body.idempotency_key !== "string" || !body.idempotency_key.trim()) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, servico_id e idempotency_key são obrigatórios" }, { status: 400 });
  }
  const auth = await autorizarUsuarioNaClinica(req, body.clinica_id);
  if (!auth.ok) return NextResponse.json({ sucesso: false, error: auth.error }, { status: auth.status });
  const v = validarMovimentoManual({ tipo: body.tipo, quantidade: body.quantidade, motivo: body.motivo });
  if (!v.ok) return NextResponse.json({ sucesso: false, error: v.erro }, { status: 400 });

  const { data, error } = await admin.rpc("estoque_registrar_movimento_v1", {
    p_clinica_id: body.clinica_id, p_servico_id: body.servico_id, p_tipo: v.tipo, p_quantidade: v.quantidade,
    p_motivo: v.motivo, p_autor_id: auth.userId, p_chave: `manual:${body.idempotency_key.trim().slice(0, 100)}`,
  });
  if (estoqueIndisponivelNoBanco(error)) return NextResponse.json({ sucesso: false, error: "O controle de estoque ainda não foi ativado." }, { status: 503 });
  const r = data as { ok?: boolean; erro?: string; saldo?: number; replay?: boolean } | null;
  if (error || !r || typeof r.ok !== "boolean") return NextResponse.json({ sucesso: false, error: "Não foi possível registrar a movimentação" }, { status: 503 });
  if (!r.ok) {
    const status = r.erro === "item_nao_encontrado" ? 404 : 409;
    return NextResponse.json({ sucesso: false, error: MENSAGEM_ERRO_MOVIMENTO[r.erro ?? ""] ?? "Movimentação recusada" }, { status });
  }
  return NextResponse.json({ sucesso: true, saldo: r.saldo, replay: !!r.replay });
}
