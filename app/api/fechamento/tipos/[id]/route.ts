// Contador IA — Fechamento Inteligente V1.
// Ativar/desativar ou alternar obrigatoriedade de um tipo de documento já
// cadastrado — nunca exclui (documento desativado só some de competências
// futuras; histórico de competências passadas nunca é reescrito).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { clinica_id?: string; ativo?: boolean; obrigatorio?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, ativo, obrigatorio } = body;
  if (!clinica_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }
  if (ativo === undefined && obrigatorio === undefined) {
    return NextResponse.json({ sucesso: false, error: "informe ativo e/ou obrigatorio" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "fechamento.tipos.atualizar", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const patch: { ativo?: boolean; obrigatorio?: boolean } = {};
  if (ativo !== undefined) patch.ativo = !!ativo;
  if (obrigatorio !== undefined) patch.obrigatorio = !!obrigatorio;

  const { data: atualizado, error } = await admin
    .from("fechamento_tipos_documento")
    .update(patch)
    .eq("id", id)
    .eq("clinica_id", clinica_id) // nunca confia só no id — sempre reafirma o tenant
    .select()
    .maybeSingle();

  if (error) {
    logOperacao({ operacao: "fechamento.tipos.atualizar", clinica_id, entidade_id: id, resultado: "erro", motivo: error.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível atualizar o tipo de documento" }, { status: 500 });
  }
  if (!atualizado) {
    return NextResponse.json({ sucesso: false, error: "Tipo de documento não encontrado nesta clínica" }, { status: 404 });
  }

  logOperacao({ operacao: "fechamento.tipos.atualizar", clinica_id, entidade_id: id, resultado: "sucesso" });
  return NextResponse.json({ sucesso: true, tipo: atualizado });
}
