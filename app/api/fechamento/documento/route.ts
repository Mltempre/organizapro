// Contador IA — Fechamento Inteligente V1.
// POST /api/fechamento/documento — registra o estado de UM documento de UM
// cliente em UMA competência (a "baixa da pendência"). Upsert por chave
// natural (clinica_id, cliente_id, competencia, tipo_documento) — este é
// ESTADO mutável real (documento pode ir de pendente -> recebido ->
// invalido -> recebido de novo), não um evento de criação único; por isso
// upsert direto na tabela, nunca o padrão idempotency_key+eventos_dominio
// usado para CRIAR uma entidade nova (mesma distinção já documentada em
// lib/fechamento-contabil.ts). Um evento best-effort ainda é gravado em
// eventos_dominio só para trilha/auditoria (quem mudou o quê, quando) —
// nunca como fonte do estado em si.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { logOperacao } from "../../../../lib/log-estruturado";
import { competenciaValida, type StatusDocumento } from "../../../../lib/fechamento-contabil";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_VALIDOS: StatusDocumento[] = ["pendente", "recebido", "invalido"];

export async function POST(req: NextRequest) {
  let body: {
    clinica_id?: string; cliente_id?: string; competencia?: string;
    tipo_documento?: string; status?: string; observacao?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, cliente_id, competencia, tipo_documento, status, observacao } = body;
  if (!clinica_id || !cliente_id || !competencia || !tipo_documento?.trim() || !status) {
    return NextResponse.json(
      { sucesso: false, error: "clinica_id, cliente_id, competencia, tipo_documento e status são obrigatórios" },
      { status: 400 }
    );
  }
  if (!competenciaValida(competencia)) {
    return NextResponse.json({ sucesso: false, error: "competencia deve estar no formato AAAA-MM" }, { status: 400 });
  }
  if (!STATUS_VALIDOS.includes(status as StatusDocumento)) {
    return NextResponse.json({ sucesso: false, error: `status deve ser um de: ${STATUS_VALIDOS.join(", ")}` }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "fechamento.documento.atualizar", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  // Cliente relido e reafirmado do MESMO tenant — nunca confia no
  // cliente_id sozinho, mesmo padrão de toda rota autenticada do produto.
  const { data: cliente } = await admin
    .from("pacientes")
    .select("id")
    .eq("id", cliente_id)
    .eq("clinica_id", clinica_id)
    .maybeSingle();
  if (!cliente) {
    logOperacao({ operacao: "fechamento.documento.atualizar", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: "cliente nao pertence a esta clinica" });
    return NextResponse.json({ sucesso: false, error: "Cliente não encontrado nesta clínica" }, { status: 404 });
  }

  const agora = new Date().toISOString();
  const { data: registro, error } = await admin
    .from("fechamento_documentos")
    .upsert(
      {
        clinica_id,
        cliente_id,
        competencia,
        tipo_documento: tipo_documento.trim(),
        status,
        observacao: observacao?.trim() || null,
        recebido_em: status === "recebido" ? agora : null,
        atualizado_por: autorizacao.userId,
      },
      { onConflict: "clinica_id,cliente_id,competencia,tipo_documento" }
    )
    .select()
    .single();

  if (error) {
    logOperacao({ operacao: "fechamento.documento.atualizar", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: error.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível atualizar o documento" }, { status: 500 });
  }

  // Auditoria best-effort (trilha, nunca a fonte do estado) — falha aqui
  // nunca bloqueia a atualização real que já foi persistida acima.
  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: "fechamento.documento_atualizado",
    entidade_tipo: "cliente",
    entidade_id: cliente_id,
    chave_idempotencia: `${cliente_id}:fechamento.documento_atualizado:${competencia}:${tipo_documento.trim()}:${agora}`,
    payload: { competencia, tipo_documento: tipo_documento.trim(), status },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "fechamento.documento_atualizado", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: `evidencia nao gravada: ${erroEvento.message}` });
  }

  logOperacao({ operacao: "fechamento.documento.atualizar", clinica_id, entidade_id: cliente_id, resultado: "sucesso", motivo: `${tipo_documento.trim()} -> ${status}` });
  return NextResponse.json({ sucesso: true, documento: registro });
}
