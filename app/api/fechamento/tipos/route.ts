// Contador IA — Fechamento Inteligente V1.
// Configuração dos tipos de documento exigidos para o fechamento mensal.
// Camada fina sobre public.fechamento_tipos_documento — só valida,
// autentica, autoriza e delega ao banco (nenhuma regra de prontidão aqui,
// isso é lib/fechamento-contabil.ts).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { logOperacao } from "../../../../lib/log-estruturado";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── GET /api/fechamento/tipos?clinica_id=... — listar ───────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  if (!clinica_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data, error } = await admin
    .from("fechamento_tipos_documento")
    .select("*")
    .eq("clinica_id", clinica_id)
    .order("nome");

  if (error) {
    logOperacao({ operacao: "fechamento.tipos.listar", clinica_id, resultado: "erro", motivo: error.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível listar os tipos de documento" }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, tipos: data ?? [] });
}

// ─── POST /api/fechamento/tipos — cadastrar um tipo de documento ─────────
export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; nome?: string; obrigatorio?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, nome, obrigatorio } = body;
  if (!clinica_id || !nome?.trim()) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e nome são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "fechamento.tipos.criar", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  // Idempotente por (clinica_id, nome) — recadastrar o mesmo nome nunca
  // duplica a linha, só devolve a existente.
  const { data: existente } = await admin
    .from("fechamento_tipos_documento")
    .select("*")
    .eq("clinica_id", clinica_id)
    .eq("nome", nome.trim())
    .maybeSingle();
  if (existente) {
    return NextResponse.json({ sucesso: true, idempotente: true, tipo: existente });
  }

  const { data: novo, error } = await admin
    .from("fechamento_tipos_documento")
    .insert({
      clinica_id,
      nome: nome.trim(),
      obrigatorio: obrigatorio !== false,
      ativo: true,
    })
    .select()
    .single();

  if (error) {
    logOperacao({ operacao: "fechamento.tipos.criar", clinica_id, resultado: "erro", motivo: error.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível cadastrar o tipo de documento" }, { status: 500 });
  }

  logOperacao({ operacao: "fechamento.tipos.criar", clinica_id, entidade_id: novo.id, resultado: "sucesso" });
  return NextResponse.json({ sucesso: true, idempotente: false, tipo: novo });
}
