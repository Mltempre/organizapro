import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { OPORTUNIDADE_STATUS, type OportunidadeStatus } from "../../../../../lib/oportunidades-demanda";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function obterClinica(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /, "") || null;
  if (!bearer) return { error: NextResponse.json({ error: "Autenticação obrigatória" }, { status: 401 }) };
  const { data: { user } } = await supabaseAnon.auth.getUser(bearer);
  if (!user) return { error: NextResponse.json({ error: "Sessão inválida ou expirada" }, { status: 401 }) };
  const { data: vinculo } = await supabase.from("clinica_usuarios").select("clinica_id").eq("usuario_id", user.id).eq("ativo", true).maybeSingle();
  if (!vinculo?.clinica_id) return { error: NextResponse.json({ error: "Usuário não tem vínculo com uma clínica" }, { status: 403 }) };
  const auth = await autorizarUsuarioNaClinica(req, vinculo.clinica_id);
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  return { clinicaId: vinculo.clinica_id, userId: auth.userId };
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await obterClinica(req);
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  let body: { status?: OportunidadeStatus; chave_idempotencia?: string; payload?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (!body.status || !OPORTUNIDADE_STATUS.includes(body.status) || !body.chave_idempotencia?.trim()) {
    return NextResponse.json({ error: "status e chave_idempotencia são obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("transicionar_oportunidade_demanda_v1", {
    p_id: id,
    p_clinica_id: auth.clinicaId,
    p_status: body.status,
    p_chave_idempotencia: body.chave_idempotencia,
    p_payload: body.payload ?? {},
  });
  if (error) {
    const status = error.message.includes("não encontrada") ? 404 : error.message.includes("transição inválida") ? 409 : 500;
    return NextResponse.json({ error: status === 500 ? "Não foi possível transicionar a oportunidade" : error.message }, { status });
  }
  return NextResponse.json({ data });
}