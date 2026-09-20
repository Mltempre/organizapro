import { NextRequest, NextResponse } from "next/server";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { assertGoogleEnv, criarEstadoGoogle, redirectUri, urlAutorizacaoGoogle } from "../../../../../lib/google-business-profile";

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  if (!clinicaId) return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });

  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });

  try {
    const config = assertGoogleEnv();
    const state = criarEstadoGoogle(clinicaId, autorizacao.userId, config.stateSecret);
    const nonce = state.split(".")[0];
    const resposta = NextResponse.redirect(urlAutorizacaoGoogle(config.clientId, redirectUri(req), state));
    resposta.cookies.set("google_business_oauth_state", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return resposta;
  } catch (error) {
    return NextResponse.json({ sucesso: false, error: error instanceof Error ? error.message : "Integração Google não configurada" }, { status: 503 });
  }
}