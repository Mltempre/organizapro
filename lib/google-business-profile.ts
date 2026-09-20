import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

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
  const [payload, signature] = state.split(".");
  if (!payload || !signature || assinar(payload, secret) !== signature) return null;
  try {
    const estado = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleOAuthState;
    if (!estado.clinicaId || !estado.userId || !estado.nonce || !Number.isInteger(estado.exp) || estado.exp < now) return null;
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