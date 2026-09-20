import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { ordenarOperacoes, prepararCobrancaPaga, type NotaFacilCobranca } from "../../../lib/notafacil-inteligente";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const clinicaId = new URL(req.url).searchParams.get("clinica_id");
  if (!clinicaId) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) {
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data, error } = await admin
    .from("cobrancas")
    .select("id, paciente_id, paciente_nome, descricao, valor, valor_pago, pago_em")
    .eq("clinica_id", clinicaId)
    .eq("status", "pago")
    .order("pago_em", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ sucesso: false, error: "Não foi possível carregar as operações pagas" }, { status: 500 });
  }

  const operacoes = ordenarOperacoes((data ?? []).map((cobranca) => prepararCobrancaPaga(cobranca as NotaFacilCobranca)));

  return NextResponse.json({
    sucesso: true,
    operacoes,
    total: operacoes.length,
    modo: "preparacao_documento",
    emissaoFiscalDisponivel: false,
    aviso: "Esta tela organiza informações para preparação. A emissão fiscal externa e a validação tributária não são realizadas pelo OrganizaPro.",
  });
}