import "server-only";
// ── Meta Ads V1 — OAuth server-side (iniciar/concluir) ─────────────────────
// Espelho exato do padrão canônico lib/google-business-profile-oauth.ts:
//   • start: exige Origin compatível + autorização de tenant + state assinado;
//     o Bearer NUNCA vai para a URL — fica em cookie HttpOnly cifrado (AES-
//     256-GCM) temporário para revalidar o usuário no retorno externo;
//   • callback: valida state + cookie, revalida vínculo/produto/usuário,
//     troca o code por token (persistente → long-lived melhor-esforço),
//     seleciona a primeira conta ATIVA e grava a credencial CIFRADA por
//     tenant em meta_ads_conexoes. Sem conta ativa → nada é gravado.
//   • nenhum segredo em log (só código de erro) nem na URL de retorno.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "./auth-clinica";
import {
  configuracaoMeta,
  redirectUriMeta,
  urlAutorizacaoMeta,
  criarEstadoMeta,
  validarEstadoMeta,
  cifrarSegredoMeta,
  decifrarSegredoMeta,
} from "./meta-ads";
import { estenderTokenMeta, listarContasMeta, trocarCodigoMeta, ErroMeta } from "./meta-ads-api";

const COOKIE = "meta_ads_oauth_session";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** POST autenticado → URL oficial do dialog (escopo mínimo ads_read). */
export async function iniciarMeta(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin) {
      return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
    }
    let body: { clinica_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Entrada inválida" }, { status: 400 });
    }
    if (!body || typeof body.clinica_id !== "string" || !body.clinica_id) {
      return NextResponse.json({ error: "Entrada inválida" }, { status: 400 });
    }
    const auth = await autorizarUsuarioNaClinica(req, body.clinica_id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const cfg = configuracaoMeta();
    if (!cfg) {
      return NextResponse.json(
        { estado: "nao_configurada", error: "A integração Meta Ads ainda não está configurada no servidor." },
        { status: 409 }
      );
    }
    const state = criarEstadoMeta(body.clinica_id, auth.userId, cfg.tokenKey);
    const bearer = req.headers.get("authorization")!.slice(7);
    const cookie = cifrarSegredoMeta(JSON.stringify({ bearer, state }), cfg.tokenKey + ":meta-oauth-session");
    if (cookie.length > 3800) {
      return NextResponse.json({ error: "Não foi possível iniciar a conexão" }, { status: 500 });
    }
    const response = NextResponse.json({ url: urlAutorizacaoMeta(cfg.appId, redirectUriMeta(req), state) });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/api/meta-ads/oauth",
    });
    return response;
  } catch {
    // Sem mensagem interna nem segredo em log.
    return NextResponse.json({ error: "Não foi possível iniciar a conexão Meta" }, { status: 500 });
  }
}

/** GET público do callback externo → grava conexão e volta para /atribuicao. */
export async function concluirMeta(req: NextRequest) {
  function voltar(status: string) {
    const destino = new URL("/atribuicao?meta_status=" + encodeURIComponent(status), req.nextUrl.origin);
    const response = NextResponse.redirect(destino);
    response.cookies.set(COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/api/meta-ads/oauth",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  try {
    const cfg = configuracaoMeta();
    if (!cfg) return voltar("configuracao");
    const state = req.nextUrl.searchParams.get("state") || "";
    const estado = validarEstadoMeta(state, cfg.tokenKey);
    const cookie = req.cookies.get(COOKIE)?.value;
    if (!estado || !cookie) return voltar("oauth");
    let sessao: { bearer?: unknown; state?: unknown } | null = null;
    try {
      sessao = JSON.parse(decifrarSegredoMeta(cookie, cfg.tokenKey + ":meta-oauth-session"));
    } catch {
      return voltar("oauth");
    }
    if (sessao?.state !== state || typeof sessao.bearer !== "string" || !sessao.bearer) return voltar("oauth");
    // O Bearer nunca vai na URL; a sessão temporária cifrada permite
    // revalidar usuário/vínculo/produto no retorno externo.
    const autenticado = new NextRequest(req.url, { headers: { Authorization: "Bearer " + sessao.bearer } });
    const auth = await autorizarUsuarioNaClinica(autenticado, estado.clinicaId);
    if (!auth.ok || auth.userId !== estado.userId) return voltar("oauth");
    if (req.nextUrl.searchParams.has("error")) return voltar("denied");
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return voltar("oauth");

    const redirect = redirectUriMeta(req);
    let token = await trocarCodigoMeta(code, redirect, cfg);
    token = await estenderTokenMeta(token, cfg);
    const contas = await listarContasMeta(token);
    const conta = contas.find((c) => c.ativa) ?? null;
    // Sem conta ativa: nada é gravado — estado honesto "sem_conta".
    if (!conta) return voltar("sem_conta");

    const agora = new Date().toISOString();
    const { error } = await admin.from("meta_ads_conexoes").upsert(
      {
        clinica_id: estado.clinicaId,
        conta_ads_id: conta.id,
        conta_ads_nome: conta.nome,
        moeda: conta.moeda,
        access_token_ciphertext: cifrarSegredoMeta(token, cfg.tokenKey),
        escopos_grantados: ["ads_read"],
        conectado_em: agora,
        atualizado_em: agora,
      },
      { onConflict: "clinica_id" }
    );
    if (error) return voltar("persistencia");
    return voltar("connected");
  } catch (e) {
    // Só o código classificado — nunca URL com token, nunca corpo de erro.
    const codigo = e instanceof ErroMeta ? e.codigo : "desconhecido";
    console.error("[Meta Ads OAuth]", { codigo });
    return voltar("erro");
  }
}
