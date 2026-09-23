// Contador IA — Fechamento Inteligente V1.
// POST /api/fechamento/documento/confirmar — um humano revisa um arquivo
// em REVISÃO NECESSÁRIA e confirma a qual tipo de documento ele pertence.
// Só então a pendência é resolvida — nunca antes (a identificação sozinha
// nunca dá baixa quando não teve confiança suficiente).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; arquivo_id?: string; tipo_documento?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, arquivo_id, tipo_documento } = body;
  if (!clinica_id || !arquivo_id || !tipo_documento?.trim()) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, arquivo_id e tipo_documento são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "fechamento.arquivo.confirmar", clinica_id, entidade_id: arquivo_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  // Relido do banco — nunca confia no cliente_id/competencia que a tela
  // mandou, só no que o arquivo real já tem gravado.
  const { data: arquivo } = await admin
    .from("fechamento_arquivos")
    .select("*")
    .eq("id", arquivo_id)
    .eq("clinica_id", clinica_id)
    .maybeSingle();
  if (!arquivo) {
    return NextResponse.json({ sucesso: false, error: "Arquivo não encontrado nesta clínica" }, { status: 404 });
  }
  if (arquivo.classificacao_status !== "pendente_confirmacao") {
    logOperacao({ operacao: "fechamento.arquivo.confirmar", clinica_id, entidade_id: arquivo_id, resultado: "rejeitado", motivo: `status já é ${arquivo.classificacao_status}` });
    return NextResponse.json({ sucesso: false, error: "Este arquivo já foi confirmado anteriormente — evita duplicidade." }, { status: 409 });
  }

  const agora = new Date().toISOString();

  const { error: erroArquivo } = await admin
    .from("fechamento_arquivos")
    .update({ classificacao_status: "confirmado_manual", tipo_documento_final: tipo_documento.trim() })
    .eq("id", arquivo_id)
    .eq("clinica_id", clinica_id);
  if (erroArquivo) {
    logOperacao({ operacao: "fechamento.arquivo.confirmar", clinica_id, entidade_id: arquivo_id, resultado: "erro", motivo: erroArquivo.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível confirmar o arquivo" }, { status: 500 });
  }

  const { error: erroDocumento } = await admin.from("fechamento_documentos").upsert(
    {
      clinica_id, cliente_id: arquivo.cliente_id, competencia: arquivo.competencia,
      tipo_documento: tipo_documento.trim(), status: "recebido",
      recebido_em: agora, arquivo_id: arquivo.id, atualizado_por: autorizacao.userId,
    },
    { onConflict: "clinica_id,cliente_id,competencia,tipo_documento" }
  );
  if (erroDocumento) {
    logOperacao({ operacao: "fechamento.documento.atualizar", clinica_id, entidade_id: arquivo.cliente_id, resultado: "erro", motivo: erroDocumento.message });
    return NextResponse.json({ sucesso: false, error: "Arquivo confirmado, mas não foi possível atualizar a pendência" }, { status: 500 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id, tipo: "fechamento.arquivo_confirmado", entidade_tipo: "cliente", entidade_id: arquivo.cliente_id,
    chave_idempotencia: `${arquivo.cliente_id}:fechamento.arquivo_confirmado:${arquivo_id}`,
    payload: { competencia: arquivo.competencia, tipo_documento: tipo_documento.trim(), arquivo_id },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "fechamento.arquivo_confirmado", clinica_id, entidade_id: arquivo.cliente_id, resultado: "erro", motivo: `evidencia nao gravada: ${erroEvento.message}` });
  }

  logOperacao({ operacao: "fechamento.arquivo.confirmar", clinica_id, entidade_id: arquivo_id, resultado: "sucesso" });
  return NextResponse.json({ sucesso: true });
}
