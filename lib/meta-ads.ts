import "server-only";

// ── Meta Ads V1 Enxuto — configuração, URLs de autorização e reuso de
//    criptografia/estado assinado ──────────────────────────────────────────
//
// Pesquisa OFICIAL realizada em 2026-09-28 (resumo e links completos em
// docs/meta-ads-v1-entrega.md). Fatos que moldam este módulo:
//   • Authorization — developers.facebook.com/docs/marketing-api/get-started/authorization/
//       - ler relatórios/métricas de contas de anúncios = permissão ads_read;
//       - criar/gerenciar campanhas = ads_management (+ App Review) — FORA do V1;
//       - padrão "Standard/Limited Access" só atende usuários com papel no app;
//         conectar contas de CLIENTES (SaaS) exige Advanced Access via App
//         Review + Business Verification — dependência externa honesta.
//   • Authentication — developers.facebook.com/docs/marketing-api/get-started/authentication/
//       - fluxo server-side devolve token persistente; troca por long-lived
//         (/oauth/access_token?grant_type=fb_exchange_token); token armazenado
//         cifrado no servidor; prever re-autorização (revogação/senha/90 dias).
//   • Permissions — developers.facebook.com/docs/permissions/
//       - pedir SOMENTE o escopo necessário (ads_read) — escopo mínimo oficial.
//   • Insights — developers.facebook.com/docs/marketing-api/insights
//       - /{campaign-id}/insights e /{ad-account-id}/insights com date_preset;
//         métricas spend/impressions/reach clicks/ctr.
//   • Graph API v25.0 (versão dos exemplos oficiais consultados).
//
// Criptografia e estado assinado são REUSADOS por import puro do módulo
// canônico Google Presença (lib/google-business-profile.ts): uma única
// verdade de AES-256-GCM/HMAC, sem duplicar lógica de segurança e sem
// alterar comportamento do Google Presença.

import {
  criarEstadoGoogle,
  validarEstadoGoogle,
  cifrarRefreshToken,
  decifrarRefreshToken,
} from "./google-business-profile";

/** Escopo MÍNIMO oficial para leitura de relatórios de ads. Nada de
 *  ads_management (criação/gestão exige App Review — fora do V1). */
export const META_ADS_SCOPE = "ads_read";
/** Versão da Graph API usada nos exemplos oficiais consultados (2026-09-28). */
export const META_GRAPH_VERSION = "v25.0";
/** Período padrão de leitura de insights (date_preset oficial). */
export const META_PERIODO_PADRAO = "last_30d";

export type ConfigMeta = {
  appId: string;
  appSecret: string;
  tokenKey: string;
  redirectUri: string | null;
};

/** null = "aguardando configuração" (estado honesto exibido pela UI).
 *  META_TOKEN_KEY precisa de material suficiente para AES-256 (mín. 16 chars
 *  aqui; recomenda-se 32+). Nenhum valor é devolvido ou logado. */
export function configuracaoMeta(): ConfigMeta | null {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const tokenKey = process.env.META_TOKEN_KEY;
  if (!appId || !appSecret || !tokenKey || tokenKey.length < 16) return null;
  return {
    appId,
    appSecret,
    tokenKey,
    redirectUri: process.env.META_APP_REDIRECT_URI?.trim() || null,
  };
}

/** Redirect URI canônico: derivado da origem da própria requisição (padrão
 *  GBP), com override opcional via META_APP_REDIRECT_URI para produção. */
export function redirectUriMeta(req: { nextUrl: { origin: string } }): string {
  return configuracaoMeta()?.redirectUri ?? `${req.nextUrl.origin}/api/meta-ads/oauth/callback`;
}

/** Dialog oficial de autorização (Facebook Login) com escopo mínimo ads_read. */
export function urlAutorizacaoMeta(appId: string, redirect: string, state: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirect,
    response_type: "code",
    scope: META_ADS_SCOPE,
    state,
  });
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

// Reuso puro (read-only) do canônico Google Presença — sem duplicação de
// criptografia/assinatura e sem alteração de comportamento do GBP.
export {
  criarEstadoGoogle as criarEstadoMeta,
  validarEstadoGoogle as validarEstadoMeta,
  cifrarRefreshToken as cifrarSegredoMeta,
  decifrarRefreshToken as decifrarSegredoMeta,
};