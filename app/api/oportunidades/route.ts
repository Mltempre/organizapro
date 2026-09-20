import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import {
  normalizarTelefone,
  validarNovaOportunidade,
  type NovaOportunidade,
} from "../../../lib/oportunidades-demanda";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function resolverClinica(req: NextRequest): Promise<
  | { ok: true; clinicaId: string; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) return { ok: false, response: NextResponse.json({ error: "Autenticação obrigatória" }, { status: 401 }) };

  const { data: { user } } = await supabaseAnon.auth.getUser(bearer);
  if (!user) return { ok: false, response: NextResponse.json({ error: "Sessão inválida ou expirada" }, { status: 401 }) };

  const { data: vinculo, error } = await supabase
    .from("clinica_usuarios")
    .select("clinica_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (error || !vinculo?.clinica_id) {
    return { ok: false, response: NextResponse.json({ error: "Usuário não tem vínculo com uma clínica" }, { status: 403 }) };
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, vinculo.clinica_id);
  if (!autorizacao.ok) return { ok: false, response: NextResponse.json({ error: autorizacao.error }, { status: autorizacao.status }) };
  return { ok: true, clinicaId: vinculo.clinica_id, userId: autorizacao.userId };
}

export async function GET(req: NextRequest) {
  const auth = await resolverClinica(req);
  if (!auth.ok) return auth.response;

  const status = new URL(req.url).searchParams.get("status");
  let query = supabase
    .from("oportunidades_demanda")
    .select("id, clinica_id, canal, identificador_canal, telefone, nome_informado, status, confianca_classificacao, evidencia_bruta, contexto_classificacao, jornada, paciente_vinculado_id, agendamento_vinculado_id, orcamento_vinculado_id, receita_atribuida, receita_fonte, criado_em, atualizado_em, ultima_interacao_em, expira_em, resolvido_em")
    .eq("clinica_id", auth.clinicaId)
    .order("ultima_interacao_em", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Não foi possível consultar oportunidades" }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await resolverClinica(req);
  if (!auth.ok) return auth.response;

  let body: NovaOportunidade;
  try {
    body = await req.json() as NovaOportunidade;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const validationError = validarNovaOportunidade(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const { data, error } = await supabase
    .from("oportunidades_demanda")
    .upsert({
      clinica_id: auth.clinicaId,
      canal: body.canal,
      identificador_canal: body.identificador_canal ?? null,
      telefone: body.telefone.trim(),
      telefone_normalizado: normalizarTelefone(body.telefone),
      nome_informado: body.nome_informado ?? null,
      confianca_classificacao: body.confianca_classificacao,
      evidencia_bruta: body.evidencia_bruta ?? null,
      contexto_classificacao: body.contexto_classificacao ?? {},
      expira_em: body.expira_em,
      chave_idempotencia: body.chave_idempotencia,
      criado_por: auth.userId,
    }, { onConflict: "clinica_id,chave_idempotencia" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Não foi possível criar a oportunidade" }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}