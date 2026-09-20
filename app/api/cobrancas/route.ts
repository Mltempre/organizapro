// Cobranças — etapa "receita" da cadeia orçamento → venda → receita.
// Camada fina de API sobre lib/motor-cobranca.ts. Só valida entrada,
// autentica, autoriza, chama o domínio e devolve resposta.
//
// public.cobrancas e public.eventos_dominio JÁ EXISTEM em Production
// (compartilhados com ClínicaFlow) — nenhuma migration nova é necessária.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { logOperacao } from "../../../lib/log-estruturado";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

// ─── POST /api/cobrancas — registrar cobrança (receita) ───────────────────
export async function POST(req: NextRequest) {
  let body: {
    clinica_id?: string;
    paciente_id?: string;
    paciente_nome?: string;
    paciente_telefone?: string;
    tratamento_origem_id?: string;
    descricao?: string;
    valor?: number;
    vencimento?: string;
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
    tratamento_origem_id, descricao, valor, vencimento, observacao, idempotency_key,
  } = body;

  if (!clinica_id || !paciente_nome?.trim() || !descricao?.trim() || !vencimento || !idempotency_key) {
    return NextResponse.json(
      { sucesso: false, error: "clinica_id, paciente_nome, descricao, vencimento e idempotency_key são obrigatórios" },
      { status: 400 }
    );
  }
  if (valor !== undefined && (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0)) {
    return NextResponse.json({ sucesso: false, error: "valor deve ser um número positivo" }, { status: 400 });
  }
  if (!REGEX_DATA.test(vencimento)) {
    return NextResponse.json({ sucesso: false, error: "vencimento deve estar no formato AAAA-MM-DD" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "cobranca.criar", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  // Snapshot do valor do tratamento de origem — só na criação, nunca
  // recalculado depois. O valor explícito, se enviado, sempre prevalece.
  let valorFinal = valor ?? null;
  if (tratamento_origem_id) {
    const { data: tratamento, error: erroTratamento } = await admin
      .from("tratamentos")
      .select("id, valor_estimado")
      .eq("id", tratamento_origem_id)
      .eq("clinica_id", clinica_id)
      .maybeSingle();
    if (erroTratamento || !tratamento) {
      logOperacao({ operacao: "cobranca.criar", clinica_id, resultado: "rejeitado", motivo: "tratamento_origem_id não encontrado nesta clínica" });
      return NextResponse.json({ sucesso: false, error: "tratamento_origem_id não encontrado nesta clínica" }, { status: 400 });
    }
    if (valor === undefined) valorFinal = tratamento.valor_estimado;
  }
  if (valorFinal === null || valorFinal <= 0) {
    return NextResponse.json(
      { sucesso: false, error: "valor deve ser um número positivo — informe explicitamente ou vincule a um tratamento com valor_estimado definido" },
      { status: 400 }
    );
  }

  const chaveIdempotencia = `criar-cobranca:${idempotency_key}`;
  const { data: eventoExistente } = await admin
    .from("eventos_dominio")
    .select("entidade_id")
    .eq("clinica_id", clinica_id)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();

  if (eventoExistente) {
    const { data: cobrancaExistente } = await admin
      .from("cobrancas")
      .select("*")
      .eq("id", eventoExistente.entidade_id)
      .maybeSingle();
    if (cobrancaExistente) {
      logOperacao({ operacao: "cobranca.criar", clinica_id, entidade_id: cobrancaExistente.id, resultado: "sucesso", motivo: "replay idempotente" });
      return NextResponse.json({ sucesso: true, idempotente: true, cobranca: cobrancaExistente });
    }
  }

  const agora = new Date().toISOString();
  const { data: nova, error: erroInsert } = await admin
    .from("cobrancas")
    .insert({
      clinica_id,
      paciente_id: paciente_id || null,
      paciente_nome: paciente_nome.trim(),
      paciente_telefone: paciente_telefone?.trim() || null,
      tratamento_origem_id: tratamento_origem_id || null,
      descricao: descricao.trim(),
      valor: valorFinal,
      vencimento,
      observacao: observacao?.trim() || null,
      status: "pendente",
      created_by: autorizacao.userId,
    })
    .select()
    .single();

  if (erroInsert) {
    logOperacao({ operacao: "cobranca.criar", clinica_id, resultado: "erro", motivo: erroInsert.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível criar a cobrança" }, { status: 500 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: "cobranca.criada",
    entidade_tipo: "cobranca",
    entidade_id: nova.id,
    chave_idempotencia: chaveIdempotencia,
    payload: { status_anterior: null, status_novo: "pendente" },
    criado_em: agora,
  });

  if (erroEvento) {
    await admin.from("cobrancas").delete().eq("id", nova.id);
    const { data: vencedor } = await admin
      .from("eventos_dominio")
      .select("entidade_id")
      .eq("clinica_id", clinica_id)
      .eq("chave_idempotencia", chaveIdempotencia)
      .maybeSingle();
    const { data: cobrancaVencedora } = vencedor
      ? await admin.from("cobrancas").select("*").eq("id", vencedor.entidade_id).maybeSingle()
      : { data: null };

    logOperacao({ operacao: "cobranca.criar", clinica_id, entidade_id: nova.id, resultado: "rejeitado", motivo: "corrida de idempotência — outra requisição venceu" });

    if (cobrancaVencedora) {
      return NextResponse.json({ sucesso: true, idempotente: true, cobranca: cobrancaVencedora });
    }
    return NextResponse.json({ sucesso: false, error: "Erro de concorrência ao registrar auditoria — tente novamente" }, { status: 409 });
  }

  logOperacao({ operacao: "cobranca.criar", clinica_id, entidade_id: nova.id, resultado: "sucesso" });
  return NextResponse.json({ sucesso: true, idempotente: false, cobranca: nova });
}

// ─── GET /api/cobrancas?clinica_id=...&status=... — listar ───────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  const status = searchParams.get("status");

  if (!clinica_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "cobranca.listar", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  let query = admin.from("cobrancas").select("*").eq("clinica_id", clinica_id).order("vencimento", { ascending: true });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    logOperacao({ operacao: "cobranca.listar", clinica_id, resultado: "erro", motivo: error.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível listar cobranças" }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, cobrancas: data ?? [] });
}
