// Tratamentos — etapa "venda" da cadeia orçamento → venda → receita.
// Camada fina de API sobre lib/motor-tratamento.ts. Só valida entrada,
// autentica, autoriza, chama o domínio e devolve resposta.
//
// public.tratamentos e public.eventos_dominio JÁ EXISTEM em Production
// (compartilhados com ClínicaFlow) — nenhuma migration nova é necessária.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { logOperacao } from "../../../lib/log-estruturado";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── POST /api/tratamentos — registrar plano de tratamento (venda) ───────
export async function POST(req: NextRequest) {
  let body: {
    clinica_id?: string;
    paciente_id?: string;
    paciente_nome?: string;
    paciente_telefone?: string;
    orcamento_origem_id?: string;
    tipo_tratamento?: string;
    valor_estimado?: number;
    observacao?: string;
    idempotency_key?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const {
    clinica_id, paciente_id, paciente_nome, paciente_telefone,
    orcamento_origem_id, tipo_tratamento, valor_estimado, observacao, idempotency_key,
  } = body;

  if (!clinica_id || !paciente_nome?.trim() || !tipo_tratamento?.trim() || !idempotency_key) {
    return NextResponse.json(
      { sucesso: false, error: "clinica_id, paciente_nome, tipo_tratamento e idempotency_key são obrigatórios" },
      { status: 400 }
    );
  }
  if (valor_estimado !== undefined && (typeof valor_estimado !== "number" || !Number.isFinite(valor_estimado) || valor_estimado <= 0)) {
    return NextResponse.json({ sucesso: false, error: "valor_estimado deve ser um número positivo" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "tratamento.criar", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  // Snapshot do valor do orçamento de origem — só na criação, nunca
  // recalculado depois (evita duplicar/desalinhar valor financeiro).
  let valorEstimadoFinal = valor_estimado ?? null;
  if (orcamento_origem_id) {
    const { data: orcamento, error: erroOrcamento } = await admin
      .from("orcamentos")
      .select("id, valor")
      .eq("id", orcamento_origem_id)
      .eq("clinica_id", clinica_id)
      .maybeSingle();
    if (erroOrcamento || !orcamento) {
      logOperacao({ operacao: "tratamento.criar", clinica_id, resultado: "rejeitado", motivo: "orcamento_origem_id não encontrado nesta clínica" });
      return NextResponse.json({ sucesso: false, error: "orcamento_origem_id não encontrado nesta clínica" }, { status: 400 });
    }
    if (valor_estimado === undefined) valorEstimadoFinal = orcamento.valor;
  }

  const chaveIdempotencia = `criar-tratamento:${idempotency_key}`;
  const { data: eventoExistente } = await admin
    .from("eventos_dominio")
    .select("entidade_id")
    .eq("clinica_id", clinica_id)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();

  if (eventoExistente) {
    const { data: tratamentoExistente } = await admin
      .from("tratamentos")
      .select("*")
      .eq("id", eventoExistente.entidade_id)
      .maybeSingle();
    if (tratamentoExistente) {
      logOperacao({ operacao: "tratamento.criar", clinica_id, entidade_id: tratamentoExistente.id, resultado: "sucesso", motivo: "replay idempotente" });
      return NextResponse.json({ sucesso: true, idempotente: true, tratamento: tratamentoExistente });
    }
  }

  const agora = new Date().toISOString();
  const { data: novo, error: erroInsert } = await admin
    .from("tratamentos")
    .insert({
      clinica_id,
      paciente_id: paciente_id || null,
      paciente_nome: paciente_nome.trim(),
      paciente_telefone: paciente_telefone?.trim() || null,
      orcamento_origem_id: orcamento_origem_id || null,
      tipo_tratamento: tipo_tratamento.trim(),
      valor_estimado: valorEstimadoFinal,
      observacao: observacao?.trim() || null,
      status: "criado",
      created_by: autorizacao.userId,
      iniciado_em: agora,
    })
    .select()
    .single();

  if (erroInsert) {
    logOperacao({ operacao: "tratamento.criar", clinica_id, resultado: "erro", motivo: erroInsert.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível criar o tratamento" }, { status: 500 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: "tratamento.criado",
    entidade_tipo: "tratamento",
    entidade_id: novo.id,
    chave_idempotencia: chaveIdempotencia,
    payload: { status_anterior: null, status_novo: "criado" },
    criado_em: agora,
  });

  if (erroEvento) {
    await admin.from("tratamentos").delete().eq("id", novo.id);
    const { data: vencedor } = await admin
      .from("eventos_dominio")
      .select("entidade_id")
      .eq("clinica_id", clinica_id)
      .eq("chave_idempotencia", chaveIdempotencia)
      .maybeSingle();
    const { data: tratamentoVencedor } = vencedor
      ? await admin.from("tratamentos").select("*").eq("id", vencedor.entidade_id).maybeSingle()
      : { data: null };

    logOperacao({ operacao: "tratamento.criar", clinica_id, entidade_id: novo.id, resultado: "rejeitado", motivo: "corrida de idempotência — outra requisição venceu" });

    if (tratamentoVencedor) {
      return NextResponse.json({ sucesso: true, idempotente: true, tratamento: tratamentoVencedor });
    }
    return NextResponse.json({ sucesso: false, error: "Erro de concorrência ao registrar auditoria — tente novamente" }, { status: 409 });
  }

  logOperacao({ operacao: "tratamento.criar", clinica_id, entidade_id: novo.id, resultado: "sucesso" });
  return NextResponse.json({ sucesso: true, idempotente: false, tratamento: novo });
}

// ─── GET /api/tratamentos?clinica_id=...&status=... — listar ─────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  const status = searchParams.get("status");

  if (!clinica_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "tratamento.listar", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  let query = admin.from("tratamentos").select("*").eq("clinica_id", clinica_id).order("iniciado_em", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    logOperacao({ operacao: "tratamento.listar", clinica_id, resultado: "erro", motivo: error.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível listar tratamentos" }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, tratamentos: data ?? [] });
}
