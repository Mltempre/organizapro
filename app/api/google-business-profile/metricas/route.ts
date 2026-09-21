// GET /api/google-business-profile/metricas — métricas reais de
// performance do Google Business Profile (Bloco 7). CÓDIGO PRONTO —
// HOMOLOGAÇÃO GOOGLE REAL PENDENTE: a Business Profile Performance API
// exige habilitação própria no projeto Google Cloud; esta rota já está
// completa e nunca fabrica dado, mas nunca foi exercitada contra a API
// real (sem projeto homologado disponível nesta missão).
//
// ZERO métrica inventada: devolve exatamente o que buscarMetricasGoogle
// normaliza da resposta real do Google.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { assertGoogleEnv, decifrarRefreshToken } from "../../../../lib/google-business-profile";
import { obterAccessTokenValido, buscarMetricasGoogle } from "../../../../lib/google-business-profile-api";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const METRICAS_PADRAO = ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "CALL_CLICKS", "WEBSITE_CLICKS"];

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  if (!clinicaId) return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });

  const { data: conexao, error: erroConexao } = await admin
    .from("google_business_profile_connections")
    .select("google_location_name, refresh_token_ciphertext")
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (erroConexao) return NextResponse.json({ sucesso: false, error: "Migration da conexão Google ainda não disponível" }, { status: 503 });
  if (!conexao || !conexao.google_location_name) return NextResponse.json({ sucesso: true, conectado: false, metricas: [] });

  let config;
  try {
    config = assertGoogleEnv();
  } catch (e) {
    return NextResponse.json({ sucesso: true, conectado: true, indisponivel: true, motivo: e instanceof Error ? e.message : "Integração Google não configurada", metricas: [] });
  }

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const trintaDiasAtras = new Date(Date.UTC(ano, mes - 1, dia - 30)).toISOString().split("T")[0];

  try {
    const refreshToken = decifrarRefreshToken(conexao.refresh_token_ciphertext, config.encryptionSecret);
    const accessToken = await obterAccessTokenValido(refreshToken, config);
    const metricas = await buscarMetricasGoogle(accessToken, conexao.google_location_name, METRICAS_PADRAO, trintaDiasAtras, hoje);
    return NextResponse.json({ sucesso: true, conectado: true, indisponivel: false, metricas });
  } catch (e) {
    return NextResponse.json({ sucesso: true, conectado: true, indisponivel: true, motivo: e instanceof Error ? e.message : "Não foi possível buscar métricas no Google", metricas: [] });
  }
}
