// Contador IA — Fechamento Inteligente V1.
// GET /api/fechamento/documento/arquivo?clinica_id=...&competencia=...
// [&status=...] — lista arquivos recebidos (por padrão, os em revisão),
// para o contador ver "quem enviou o quê" e confirmar identificação.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  const competencia = searchParams.get("competencia");
  const status = searchParams.get("status") ?? "pendente_confirmacao";

  if (!clinica_id || !competencia) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e competencia são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data, error } = await admin
    .from("fechamento_arquivos")
    .select("id, cliente_id, nome_original, tipo_documento_sugerido, confianca, classificacao_status, motivo_classificacao, criado_em")
    .eq("clinica_id", clinica_id)
    .eq("competencia", competencia)
    .eq("classificacao_status", status)
    .order("criado_em", { ascending: false });

  if (error) {
    return NextResponse.json({ sucesso: false, error: "Não foi possível listar os arquivos" }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, arquivos: data ?? [] });
}
