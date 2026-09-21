import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  if (!clinicaId) return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });

  const { data, error } = await admin.from("google_business_profile_connections")
    .select("google_account_name, google_location_name, google_location_title, granted_scopes, connected_at, updated_at")
    .eq("clinica_id", clinicaId).maybeSingle();
  if (error) return NextResponse.json({ sucesso: false, error: "Migration da conexão Google ainda não disponível" }, { status: 503 });
  return NextResponse.json({ sucesso: true, conectado: Boolean(data), conexao: data ? {
    conta: data.google_account_name,
    local: data.google_location_title || data.google_location_name,
    escopos: data.granted_scopes,
    conectadoEm: data.connected_at,
  } : null });
}

/**
 * Desconecta/revoga o vínculo Google desta clínica. Escopado por id E
 * clinica_id no DELETE (defesa em profundidade — nunca remove o vínculo
 * de outro tenant). Idempotente: desconectar quando já não há conexão
 * não é erro, é sucesso (nada a fazer).
 */
export async function DELETE(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  if (!clinicaId) return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });

  const { error } = await admin.from("google_business_profile_connections")
    .delete()
    .eq("clinica_id", clinicaId);
  if (error) return NextResponse.json({ sucesso: false, error: "Não foi possível desconectar" }, { status: 500 });
  return NextResponse.json({ sucesso: true, conectado: false });
}