// Contador IA — Fechamento Inteligente V1.
// PADRÃO DA CLÍNICA (fechamento_tipos_documento) + EXCEÇÕES DO CLIENTE
// aqui — nunca uma configuração paralela duplicada por cliente.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { logOperacao } from "../../../../lib/log-estruturado";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── GET /api/fechamento/excecoes?clinica_id=...&cliente_id=... ─────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  const cliente_id = searchParams.get("cliente_id");
  if (!clinica_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  let query = admin.from("fechamento_excecoes_cliente").select("*").eq("clinica_id", clinica_id);
  if (cliente_id) query = query.eq("cliente_id", cliente_id);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ sucesso: false, error: "Não foi possível listar as exceções" }, { status: 500 });
  }
  return NextResponse.json({ sucesso: true, excecoes: data ?? [] });
}

// ─── POST /api/fechamento/excecoes — criar/atualizar uma exceção ────────
export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; cliente_id?: string; tipo_documento?: string; incluido?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, cliente_id, tipo_documento, incluido } = body;
  if (!clinica_id || !cliente_id || !tipo_documento?.trim() || incluido === undefined) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, cliente_id, tipo_documento e incluido são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "fechamento.excecao.criar", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: cliente } = await admin.from("pacientes").select("id").eq("id", cliente_id).eq("clinica_id", clinica_id).maybeSingle();
  if (!cliente) {
    return NextResponse.json({ sucesso: false, error: "Cliente não encontrado nesta clínica" }, { status: 404 });
  }

  const { data: excecao, error } = await admin
    .from("fechamento_excecoes_cliente")
    .upsert(
      { clinica_id, cliente_id, tipo_documento: tipo_documento.trim(), incluido: !!incluido },
      { onConflict: "clinica_id,cliente_id,tipo_documento" }
    )
    .select()
    .single();

  if (error) {
    logOperacao({ operacao: "fechamento.excecao.criar", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: error.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível salvar a exceção" }, { status: 500 });
  }

  logOperacao({ operacao: "fechamento.excecao.criar", clinica_id, entidade_id: cliente_id, resultado: "sucesso" });
  return NextResponse.json({ sucesso: true, excecao });
}
