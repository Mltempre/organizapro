import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { autorizarUsuarioNaClinica } from "./auth-clinica";
import { assertGoogleEnv, criarEstadoGoogle, validarEstadoGoogle, redirectUri, urlAutorizacaoGoogle, cifrarRefreshToken, decifrarRefreshToken } from "./google-business-profile";
import { trocarCodigoGoogle, listarContasGoogle, listarLocalizacoesGoogle } from "./google-business-profile-api";
import { ErroGoogle, erroGoogle, classificarDiagnosticoGoogle } from "./google-business-profile-errors";
import { adminGoogle, falhaGoogle } from "./google-business-profile-context";
import { executarOperacaoGoogle } from "./google-business-profile-operations";

const COOKIE = "google_business_oauth_session";
function configGoogle() { try { return assertGoogleEnv(); } catch { throw new ErroGoogle("CONFIGURACAO"); } }

export async function iniciarGoogle(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin) throw new ErroGoogle("OAUTH");
    let body;
    try { body = await req.json(); } catch { throw new ErroGoogle("ENTRADA"); }
    if (!body || typeof body.clinica_id !== "string" || !body.clinica_id) throw new ErroGoogle("ENTRADA");
    const auth = await autorizarUsuarioNaClinica(req, body.clinica_id);
    if (!auth.ok) return NextResponse.json({ sucesso: false, error: auth.error }, { status: auth.status });
    const config = configGoogle();
    const state = criarEstadoGoogle(body.clinica_id, auth.userId, config.stateSecret);
    const bearer = req.headers.get("authorization")!.slice(7);
    const cookie = cifrarRefreshToken(JSON.stringify({ bearer, state }), config.encryptionSecret + ":oauth-session");
    if (cookie.length > 3800) throw new ErroGoogle("OAUTH");
    const response = NextResponse.json({ url: urlAutorizacaoGoogle(config.clientId, redirectUri(req), state) });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/google-business-profile/oauth" });
    return response;
  } catch (error) { return falhaGoogle(error); }
}

export async function concluirGoogle(req: NextRequest) {
  function voltar(status: string, causa?: string) {
    const destino = new URL("/google-presenca?status=" + status, req.nextUrl.origin);
    // Enum fixo (nunca texto do Google): só distingue, na tela, a falta de
    // liberação da GBP API ao projeto (quota 0) de uma falha do usuário/OAuth.
    if (causa) destino.searchParams.set("causa", causa);
    const response = NextResponse.redirect(destino);
    response.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/api/google-business-profile/oauth" });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  try {
    const config = configGoogle();
    const state = req.nextUrl.searchParams.get("state") || "";
    const estado = validarEstadoGoogle(state, config.stateSecret);
    const cookie = req.cookies.get(COOKIE)?.value;
    if (!estado || !cookie) throw new ErroGoogle("OAUTH");
    let sessao;
    try { sessao = JSON.parse(decifrarRefreshToken(cookie, config.encryptionSecret + ":oauth-session")); } catch { throw new ErroGoogle("OAUTH"); }
    if (sessao?.state !== state || typeof sessao?.bearer !== "string" || !sessao.bearer) throw new ErroGoogle("OAUTH");
    // O Bearer nunca vai para a URL; a sessao temporaria cifrada e HttpOnly
    // permite revalidar getUser/vinculo/produto no retorno externo.
    const autenticado = new NextRequest(req.url, { headers: { Authorization: "Bearer " + sessao.bearer } });
    const auth = await autorizarUsuarioNaClinica(autenticado, estado.clinicaId);
    if (!auth.ok || auth.userId !== estado.userId) throw new ErroGoogle("OAUTH");
    if (req.nextUrl.searchParams.has("error")) return voltar("denied");
    const code = req.nextUrl.searchParams.get("code");
    if (!code) throw new ErroGoogle("OAUTH");
    await executarOperacaoGoogle(adminGoogle, { clinica: estado.clinicaId, tipo: "oauth", chave: estado.nonce,
      recurso: estado.nonce, conteudo: createHash("sha256").update(code).digest("hex") }, async (iniciarEscrita) => {
      iniciarEscrita();
      const tokens = await trocarCodigoGoogle(code, redirectUri(req), config);
      const contas = await listarContasGoogle(tokens.accessToken);
      for (const conta of contas) {
        const locais = await listarLocalizacoesGoogle(tokens.accessToken, conta.name);
        const local = locais[0];
        if (!local) continue;
        const { error } = await adminGoogle.from("google_business_profile_connections").upsert({ clinica_id: estado.clinicaId,
          google_account_name: conta.name, google_location_name: local.name, google_location_title: local.title,
          refresh_token_ciphertext: cifrarRefreshToken(tokens.refreshToken, config.encryptionSecret), granted_scopes: tokens.scopes,
          connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "clinica_id" });
        if (error) throw new ErroGoogle("PERSISTENCIA", true);
        return { sucesso: true };
      }
      throw new ErroGoogle("SEM_LOCAL");
    });
    return voltar("connected");
  } catch (error) {
    const e = erroGoogle(error);
    // Único ponto em que a CONECTIVIDADE é diagnosticada: aqui (e só aqui) o
    // texto do Google é registrado, já redigido de credenciais por
    // diagnosticoGoogle. As rotas de produto continuam sem mensagem externa
    // (ver diagnosticoSeguro em google-business-profile-errors.ts).
    const causa = classificarDiagnosticoGoogle(e.diagnostico);
    console.error("[GBP OAuth]", { codigo: e.codigo, httpGoogle: e.httpGoogle ?? null,
      ...(e.diagnostico ? { diagnostico: e.diagnostico } : {}), ...(causa ? { causa } : {}) });
    return voltar(e.codigo.toLowerCase(), causa === "ACESSO_GBP_NAO_CONCEDIDO" ? "acesso_google_pendente" : undefined);
  }
}
