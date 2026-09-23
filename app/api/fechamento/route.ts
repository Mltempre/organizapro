// Contador IA — Fechamento Inteligente V1.
// GET /api/fechamento?clinica_id=...&competencia=AAAA-MM — resumo de
// prontidão de todos os clientes ativos para uma competência. Camada fina:
// só busca (pacientes ativos, tipos ativos, documentos da competência) e
// delega 100% do cálculo a lib/fechamento-contabil.ts — nenhuma soma ou
// regra de status aqui.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { logOperacao } from "../../../lib/log-estruturado";
import { competenciaValida, gerarResumoFechamento, type DocumentoRegistrado } from "../../../lib/fechamento-contabil";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  const competencia = searchParams.get("competencia");

  if (!clinica_id || !competencia) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e competencia são obrigatórios" }, { status: 400 });
  }
  if (!competenciaValida(competencia)) {
    return NextResponse.json({ sucesso: false, error: "competencia deve estar no formato AAAA-MM" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "fechamento.resumo", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const [{ data: clientesRows, error: erroClientes }, { data: tiposRows, error: erroTipos }, { data: documentosRows, error: erroDocumentos }] =
    await Promise.all([
      admin.from("pacientes").select("id, nome").eq("clinica_id", clinica_id).eq("status", "ativo").order("nome"),
      admin.from("fechamento_tipos_documento").select("nome, obrigatorio, ativo").eq("clinica_id", clinica_id),
      admin
        .from("fechamento_documentos")
        .select("cliente_id, tipo_documento, status")
        .eq("clinica_id", clinica_id)
        .eq("competencia", competencia),
    ]);

  if (erroClientes || erroTipos || erroDocumentos) {
    logOperacao({
      operacao: "fechamento.resumo", clinica_id, resultado: "erro",
      motivo: erroClientes?.message || erroTipos?.message || erroDocumentos?.message,
    });
    return NextResponse.json({ sucesso: false, error: "Não foi possível consultar o fechamento" }, { status: 500 });
  }

  const documentos: DocumentoRegistrado[] = (documentosRows ?? []).map((d) => ({
    clienteId: d.cliente_id,
    tipoDocumento: d.tipo_documento,
    status: d.status,
  }));

  const resumo = gerarResumoFechamento(
    competencia,
    (clientesRows ?? []).map((c) => ({ id: c.id, nome: c.nome })),
    (tiposRows ?? []).map((t) => ({ nome: t.nome, obrigatorio: t.obrigatorio, ativo: t.ativo })),
    documentos
  );

  return NextResponse.json({ sucesso: true, resumo });
}
