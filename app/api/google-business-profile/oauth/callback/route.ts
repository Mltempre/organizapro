import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { assertGoogleEnv, cifrarRefreshToken, redirectUri, validarEstadoGoogle } from "../../../../../lib/google-business-profile";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type GoogleTokenResponse = { access_token?: string; refresh_token?: string; scope?: string; error?: string };
type GoogleAccount = { name?: string; accountName?: string; role?: string };
type GoogleLocation = { name?: string; title?: string };

async function googleJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || "Google recusou a solicitação");
  return body;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const state = params.get("state");
  const code = params.get("code");
  if (params.get("error")) return NextResponse.redirect(new URL(`/google-presenca?status=denied`, req.url));
  if (!state || !code) return NextResponse.redirect(new URL(`/google-presenca?status=invalid_callback`, req.url));

  try {
    const config = assertGoogleEnv();
    const estado = validarEstadoGoogle(state, config.stateSecret);
    const cookieNonce = req.cookies.get("google_business_oauth_state")?.value;
    if (!estado || cookieNonce !== state.split(".")[0]) return NextResponse.redirect(new URL(`/google-presenca?status=invalid_state`, req.url));

    const autorizacao = await autorizarUsuarioNaClinica(req, estado.clinicaId);
    if (!autorizacao.ok || autorizacao.userId !== estado.userId) return NextResponse.redirect(new URL(`/google-presenca?status=unauthorized`, req.url));

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri(req), grant_type: "authorization_code" }),
      cache: "no-store",
    });
    const tokens = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error || "Não foi possível concluir o OAuth do Google");

    const contas = await googleJson<{ accounts?: GoogleAccount[] }>("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", tokens.access_token);
    const conta = contas.accounts?.[0];
    let local: GoogleLocation | undefined;
    if (conta?.name) {
      const locais = await googleJson<{ locations?: GoogleLocation[] }>(`https://mybusinessbusinessinformation.googleapis.com/v1/${conta.name}/locations?readMask=name,title`, tokens.access_token);
      local = locais.locations?.[0];
    }
    if (!tokens.refresh_token) throw new Error("Google não retornou refresh token; revogue o acesso e conecte novamente");

    const { error } = await admin.from("google_business_profile_connections").upsert({
      clinica_id: estado.clinicaId,
      google_account_name: conta?.name ?? null,
      google_location_name: local?.name ?? null,
      google_location_title: local?.title ?? null,
      refresh_token_ciphertext: cifrarRefreshToken(tokens.refresh_token, config.encryptionSecret),
      granted_scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      updated_at: new Date().toISOString(),
    }, { onConflict: "clinica_id" });
    if (error) throw new Error("Não foi possível salvar a conexão Google. A migration preparada ainda pode não ter sido executada.");

    return NextResponse.redirect(new URL(`/google-presenca?status=connected`, req.url));
  } catch (error) {
    console.error("[google-business-profile/oauth/callback]", error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL(`/google-presenca?status=error`, req.url));
  }
}

export async function POST() {
  return NextResponse.json({ sucesso: false, error: "Método não permitido" }, { status: 405 });
}