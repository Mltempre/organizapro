// Auditoria 2026-08-17: rota descoberta sem NENHUMA autenticação — ler ou
// escrever a configuração do chatbot de qualquer clínica bastava conhecer o
// clinica_id (uuid), e o POST fazia upsert de campos livres direto do body
// (...fields), sem allowlist. Corrigido reaproveitando o padrão já
// homologado no ClínicaFlow: lib/auth-clinica.ts para leitura (auth +
// tenant + vínculo ativo + produto), e allowlist explícita de campos na
// escrita — mesmo padrão já usado em app/api/minha-clinica/route.ts.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Únicos campos que a tela app/chatbot/page.tsx (aba Configuração) tem
// permissão de escrever em chatbot_config — confirmado contra a interface
// ChatbotConfig e os campos realmente editados no formulário. Qualquer
// chave fora desta lista é ignorada, nunca persistida.
const CAMPOS_PERMITIDOS = [
  "nome_clinica", "horario_funcionamento", "endereco", "convenios",
  "procedimentos", "faq", "link_humano", "ativo",
] as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  if (!clinica_id) return NextResponse.json({ error: "clinica_id obrigatório" }, { status: 400 });

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    return NextResponse.json({ error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data, error } = await supabase
    .from("chatbot_config")
    .select("*")
    .eq("clinica_id", clinica_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clinica_id, ...bodyFields } = body as Record<string, unknown>;
  if (!clinica_id || typeof clinica_id !== "string") {
    return NextResponse.json({ error: "clinica_id obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const fields: Record<string, unknown> = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in bodyFields) fields[campo] = bodyFields[campo];
  }

  const { data, error } = await supabase
    .from("chatbot_config")
    .upsert(
      { clinica_id, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "clinica_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ sucesso: false, error: error.message }, { status: 500 });
  return NextResponse.json({ sucesso: true, data });
}
