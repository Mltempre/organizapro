// GET /api/atribuicao — P1.3: Google/Meta Ads + Atribuição.
// Lê public.origem_captacoes (fase 1 já capturada em produção via
// app/empresa/[slug]/page.tsx + app/api/chatbot/message/route.ts — ver
// sql/atribuicao-origem-fase1.sql para o porquê a tabela ainda não
// existe). Mesmo padrão de app/api/atividade-recente/route.ts: erro de
// "tabela não existe" nunca vira 500 nem fabrica dado — devolve
// indisponivel:true com o motivo real, para a tela distinguir "ainda não
// ativado" de "zero captura real".
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  if (!clinicaId) return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });

  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });

  const { data, error } = await admin
    .from("origem_captacoes")
    .select("classificacao, paciente_id")
    .eq("clinica_id", clinicaId);

  if (error) {
    return NextResponse.json({ sucesso: true, indisponivel: true, motivo: error.message, origens: [] });
  }

  return NextResponse.json({
    sucesso: true,
    indisponivel: false,
    origens: (data ?? []).map((o) => ({ classificacao: o.classificacao, pacienteId: o.paciente_id })),
  });
}
