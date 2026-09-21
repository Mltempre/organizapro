// GET /api/atividade-recente — Bloco G da Casa ("OrganizaPro trabalhando").
// Lê eventos_dominio reais dos últimos dias, escopado por clinica_id
// (fail-closed) — nenhum evento novo criado por esta rota, só leitura do
// que Cobrador Digital, Follow-up Comercial, WhatsApp Governado e Google
// Business Profile já gravam. A tradução em texto (label + contagem) fica
// em lib/organizapro-trabalhando.ts (calcularAtividadeRecente) — esta rota
// só busca os eventos reais e devolve tipo/resultado, nunca decide o texto.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { TIPOS_ATIVIDADE_RECENTE, DIAS_JANELA_ATIVIDADE_RECENTE } from "../../../lib/organizapro-trabalhando";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  if (!clinicaId) return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });

  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });

  const desde = new Date(Date.now() - DIAS_JANELA_ATIVIDADE_RECENTE * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("eventos_dominio")
    .select("tipo, payload")
    .eq("clinica_id", clinicaId)
    .in("tipo", TIPOS_ATIVIDADE_RECENTE as string[])
    .gte("criado_em", desde);

  if (error) {
    // Fail-closed: nunca fabrica atividade quando a leitura falha — devolve
    // lista vazia com um motivo explícito, a tela trata como "sem dado".
    return NextResponse.json({ sucesso: true, indisponivel: true, motivo: error.message, eventos: [] });
  }

  const eventos = (data ?? []).map((e) => ({
    tipo: e.tipo as string,
    resultado: (e.payload as { resultado?: string } | null)?.resultado ?? null,
  }));

  return NextResponse.json({ sucesso: true, indisponivel: false, eventos });
}
