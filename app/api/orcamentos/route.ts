// Orçamentos — camada fina de API sobre lib/motor-orcamentos.ts. Só valida
// entrada, autentica, autoriza, chama o domínio e devolve resposta —
// nenhuma regra de negócio mora aqui.
//
// public.orcamentos e public.eventos_dominio JÁ EXISTEM em Production
// (compartilhados com ClínicaFlow, mesmo banco) — nenhuma migration nova é
// necessária. Contrato conferido campo a campo contra
// schema-producao-organizapro-20260919.sql antes de escrever este arquivo.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { logOperacao } from "../../../lib/log-estruturado";
import { MOTIVOS_DECISAO, type MotivoDecisao } from "../../../lib/motor-orcamentos";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── POST /api/orcamentos — registrar orçamento apresentado ──────────────
export async function POST(req: NextRequest) {
  let body: {
    clinica_id?: string;
    paciente_nome?: string;
    telefone?: string;
    procedimento?: string;
    valor?: number;
    observacao?: string;
    idempotency_key?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, paciente_nome, telefone, procedimento, valor, observacao, idempotency_key } = body;

  if (!clinica_id || !paciente_nome?.trim() || !procedimento?.trim() || !idempotency_key) {
    return NextResponse.json(
      { sucesso: false, error: "clinica_id, paciente_nome, procedimento e idempotency_key são obrigatórios" },
      { status: 400 }
    );
  }
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ sucesso: false, error: "valor deve ser um número positivo" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "orcamento.criar", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  // Idempotência via constraint real do banco (eventos_dominio_idempotencia_unica,
  // UNIQUE(clinica_id, chave_idempotencia)) — nunca só uma checagem de
  // aplicação que poderia ser burlada por duas requisições simultâneas.
  const chaveIdempotencia = `criar-orcamento:${idempotency_key}`;
  const { data: eventoExistente } = await admin
    .from("eventos_dominio")
    .select("entidade_id")
    .eq("clinica_id", clinica_id)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();

  if (eventoExistente) {
    const { data: orcamentoExistente } = await admin
      .from("orcamentos")
      .select("*")
      .eq("id", eventoExistente.entidade_id)
      .maybeSingle();
    if (orcamentoExistente) {
      logOperacao({ operacao: "orcamento.criar", clinica_id, entidade_id: orcamentoExistente.id, resultado: "sucesso", motivo: "replay idempotente" });
      return NextResponse.json({ sucesso: true, idempotente: true, orcamento: orcamentoExistente });
    }
  }

  const agora = new Date().toISOString();
  const { data: novo, error: erroInsert } = await admin
    .from("orcamentos")
    .insert({
      clinica_id,
      paciente_nome: paciente_nome.trim(),
      telefone: telefone?.trim() || null,
      procedimento: procedimento.trim(),
      valor,
      observacao: observacao?.trim() || null,
      status: "apresentado",
      created_by: autorizacao.userId,
      apresentado_em: agora,
    })
    .select()
    .single();

  if (erroInsert) {
    logOperacao({ operacao: "orcamento.criar", clinica_id, resultado: "erro", motivo: erroInsert.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível criar o orçamento" }, { status: 500 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: "orcamento.criado",
    entidade_tipo: "orcamento",
    entidade_id: novo.id,
    chave_idempotencia: chaveIdempotencia,
    payload: { status_anterior: null, status_novo: "apresentado" },
    criado_em: agora,
  });

  if (erroEvento) {
    // Corrida real (duas requisições com a mesma idempotency_key quase
    // simultâneas) — a constraint UNIQUE de eventos_dominio rejeitou a
    // segunda escrita. Desfaz o orçamento órfão e devolve quem venceu.
    await admin.from("orcamentos").delete().eq("id", novo.id);
    const { data: vencedor } = await admin
      .from("eventos_dominio")
      .select("entidade_id")
      .eq("clinica_id", clinica_id)
      .eq("chave_idempotencia", chaveIdempotencia)
      .maybeSingle();
    const { data: orcamentoVencedor } = vencedor
      ? await admin.from("orcamentos").select("*").eq("id", vencedor.entidade_id).maybeSingle()
      : { data: null };

    logOperacao({ operacao: "orcamento.criar", clinica_id, entidade_id: novo.id, resultado: "rejeitado", motivo: "corrida de idempotência — outra requisição venceu" });

    if (orcamentoVencedor) {
      return NextResponse.json({ sucesso: true, idempotente: true, orcamento: orcamentoVencedor });
    }
    return NextResponse.json({ sucesso: false, error: "Erro de concorrência ao registrar auditoria — tente novamente" }, { status: 409 });
  }

  logOperacao({ operacao: "orcamento.criar", clinica_id, entidade_id: novo.id, resultado: "sucesso" });
  return NextResponse.json({ sucesso: true, idempotente: false, orcamento: novo });
}

// ─── GET /api/orcamentos?clinica_id=...&status=... — listar ──────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  const status = searchParams.get("status");

  if (!clinica_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "orcamento.listar", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  let query = admin.from("orcamentos").select("*").eq("clinica_id", clinica_id).order("apresentado_em", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    logOperacao({ operacao: "orcamento.listar", clinica_id, resultado: "erro", motivo: error.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível listar orçamentos" }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, orcamentos: data ?? [], motivosValidos: MOTIVOS_DECISAO satisfies MotivoDecisao[] });
}
