// Contador IA — Fechamento Inteligente V1.
// GET /api/fechamento/documento/arquivo/[id]?clinica_id=... — URL assinada
// de curta duração para ver/baixar UM arquivo real, sempre reconferindo o
// tenant (nunca uma URL pública — bucket é privado).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../../lib/auth-clinica";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "fechamento-documentos";
const EXPIRA_SEGUNDOS = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clinica_id = new URL(req.url).searchParams.get("clinica_id");
  if (!clinica_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: arquivo } = await admin
    .from("fechamento_arquivos")
    .select("storage_path, nome_original")
    .eq("id", id)
    .eq("clinica_id", clinica_id)
    .maybeSingle();
  if (!arquivo) {
    return NextResponse.json({ sucesso: false, error: "Arquivo não encontrado nesta clínica" }, { status: 404 });
  }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(arquivo.storage_path, EXPIRA_SEGUNDOS);
  if (error || !data) {
    return NextResponse.json({ sucesso: false, error: "Não foi possível gerar o link do arquivo" }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, url: data.signedUrl, nome_original: arquivo.nome_original });
}
