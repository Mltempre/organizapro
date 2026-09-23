import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";
const STATE_TTL_SECONDS = 600;

export type GoogleOAuthState = {
  clinicaId: string;
  userId: string;
  nonce: string;
  exp: number;
};

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function assinar(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function criarEstadoGoogle(clinicaId: string, userId: string, secret: string, now = Math.floor(Date.now() / 1000)): string {
  const estado: GoogleOAuthState = { clinicaId, userId, nonce: randomBytes(24).toString("hex"), exp: now + STATE_TTL_SECONDS };
  const payload = base64url(JSON.stringify(estado));
  return `${payload}.${assinar(payload, secret)}`;
}

export function validarEstadoGoogle(state: string, secret: string, now = Math.floor(Date.now() / 1000)): GoogleOAuthState | null {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  const esperado = assinar(payload, secret);
  if (signature.length !== esperado.length || !timingSafeEqual(Buffer.from(esperado), Buffer.from(signature))) return null;
  try {
    const estado = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleOAuthState;
    if (typeof estado.clinicaId !== "string" || !estado.clinicaId || typeof estado.userId !== "string" || !estado.userId
      || typeof estado.nonce !== "string" || !/^[a-f0-9]{48}$/.test(estado.nonce) || !Number.isInteger(estado.exp) || estado.exp <= now) return null;
    return estado;
  } catch {
    return null;
  }
}

export function chaveCriptografiaGoogle(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function cifrarRefreshToken(token: string, secret: string): string {
  const key = chaveCriptografiaGoogle(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decifrarRefreshToken(value: string, secret: string): string {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Token Google armazenado em formato inválido");
  const decipher = createDecipheriv("aes-256-gcm", chaveCriptografiaGoogle(secret), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export function redirectUri(req: { nextUrl: { origin: string } }): string {
  return process.env.GOOGLE_BUSINESS_PROFILE_REDIRECT_URI || `${req.nextUrl.origin}/api/google-business-profile/oauth/callback`;
}

export function urlAutorizacaoGoogle(clientId: string, redirect: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: GOOGLE_BUSINESS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function assertGoogleEnv(): { clientId: string; clientSecret: string; stateSecret: string; encryptionSecret: string } {
  const values = {
    clientId: process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET,
    stateSecret: process.env.GOOGLE_BUSINESS_PROFILE_STATE_SECRET,
    encryptionSecret: process.env.GOOGLE_BUSINESS_PROFILE_TOKEN_KEY,
  };
  if (Object.values(values).some((value) => !value)) throw new Error("Integração Google Business Profile não configurada no servidor");
  return values as { clientId: string; clientSecret: string; stateSecret: string; encryptionSecret: string };
}

// ── Última milha V1 — avaliações, resposta sugerida, publicação, posts ────
// Funções puras (sem fetch/DB) que completam o contrato já iniciado acima.
// A leitura/escrita real na API do Google e no eventos_dominio vive em
// lib/google-business-profile-api.ts (I/O) e nas rotas — este arquivo
// continua só com regra determinística e criptografia.

// ── Estado real de uma avaliação (nunca um flag manual solto) ──────────
// "respondida" só é verdade quando o próprio Google confirma (campo
// reviewReply presente na resposta da API) — nunca inferido do nosso
// rascunho local. Mesmo princípio já usado em lib/motor-reputacao.ts
// para a coluna `respondeu` (nunca afirmar um evento que o sistema não
// verificou).
export type EstadoAvaliacaoGoogle = "sem_resposta" | "resposta_preparada" | "respondida";

export function estadoAvaliacaoGoogle(input: { temRespostaGoogle: boolean; temRascunhoLocal: boolean }): EstadoAvaliacaoGoogle {
  if (input.temRespostaGoogle) return "respondida";
  if (input.temRascunhoLocal) return "resposta_preparada";
  return "sem_resposta";
}

/**
 * Chave de idempotência para o registro do RASCUNHO — inclui uma chave
 * gerada pelo cliente (mesmo padrão já usado em app/cobrancas/page.tsx,
 * crypto.randomUUID() por tentativa de ação) para nunca duplicar um
 * duplo-clique, mas sempre permitir gerar um novo rascunho depois.
 */
export function chaveIdempotenciaRascunhoAvaliacao(reviewId: string, idempotencyKey: string): string {
  return `${reviewId}:gbp.resposta_rascunho:${idempotencyKey}`;
}

/**
 * Chave de idempotência para a PUBLICAÇÃO real no Google — mesmo
 * princípio: nunca duplica por duplo-clique/retry do mesmo pedido, mas
 * uma nova tentativa deliberada (novo idempotencyKey) sempre é permitida
 * (ex.: depois de uma falha real do Google).
 */
export function chaveIdempotenciaPublicacaoAvaliacao(reviewId: string, idempotencyKey: string): string {
  return `${reviewId}:gbp.resposta_publicada:${idempotencyKey}`;
}

/**
 * Fail-closed: só permite publicar quando a avaliação ainda está
 * "sem_resposta" (relido do Google, nunca do rascunho local) e existe um
 * texto real e não vazio para publicar. Nunca publica um rascunho vazio,
 * nunca publica em cima de uma avaliação já respondida (mesmo que por
 * outro caminho, fora do OrganizaPro).
 */
export function podePublicarResposta(estadoAtual: EstadoAvaliacaoGoogle, texto: string): boolean {
  return estadoAtual === "sem_resposta" && texto.trim().length > 0;
}

export { montarPromptRespostaAvaliacao } from "./google-business-profile-shared";
export type { DadosAvaliacaoParaPrompt } from "./google-business-profile-shared";

// ── Bloco 8 — sinal para Reputação/Diretor Digital (provado isoladamente) ──
// NÃO integrado a lib/oportunidades-clientes.ts (Radar), lib/follow-up-
// comercial.ts nem lib/ia-comercial.ts (Diretor) nesta missão — instrumentar
// essas áreas centrais exigiria decidir prioridade/peso frente aos sinais
// já existentes, uma mudança estrutural fora do escopo desta última milha.
// Esta função só PROVA o critério puro e determinístico (nunca um score
// novo, nunca duplica o que Reputação já mede) para uma convergência
// futura conectar sem redesenho.

export type AvaliacaoParaAtencao = {
  reviewId: string;
  nota: number;
  temRespostaGoogle: boolean;
  diasSemResposta: number;
};

export const DIAS_PARA_AVALIACAO_CRITICA_SEM_RESPOSTA = 2;
const NOTA_MAXIMA_CRITICA = 2;

/**
 * Avaliação crítica (nota <= 2) sem resposta há dias reais — mesmo
 * princípio de "dias desde o evento" já usado em todos os outros
 * motores desta sessão, nunca um score/probabilidade inventado.
 */
export function avaliacaoPrecisaAtencao(avaliacao: AvaliacaoParaAtencao): boolean {
  if (avaliacao.temRespostaGoogle) return false;
  if (avaliacao.nota > NOTA_MAXIMA_CRITICA || avaliacao.nota <= 0) return false;
  return avaliacao.diasSemResposta >= DIAS_PARA_AVALIACAO_CRITICA_SEM_RESPOSTA;
}
