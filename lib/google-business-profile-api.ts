import "server-only";
import { ErroGoogle, diagnosticoGoogle } from "./google-business-profile-errors";
import { recursoGoogle, recursoAvaliacao } from "./google-business-profile-resources";

export type GoogleAccountResumo = { name: string; accountName: string | null };
export type GoogleLocationResumo = { name: string; title: string | null };
export type GoogleReview = { reviewId: string; name: string; nota: number; comentario: string | null; autor: string | null;
  criadoEm: string; temRespostaGoogle: boolean; respostaGoogleTexto: string | null };

// Host do endpoint que o próprio código chamou (nunca inclui query string,
// que pode carregar pageToken): é o que prova QUAL API Google recusou.
function hostSeguro(url: string): string | null {
  try { return new URL(url).hostname; } catch { return null; }
}

async function request<T>(url: string, init: RequestInit, oauth = false): Promise<T> {
  const servico = hostSeguro(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
    const raw: unknown = await response.json().catch(() => null);
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!response.ok) {
      const code = oauth && body?.error === "invalid_grant" ? "RENOVACAO"
        : oauth && (body?.error === "invalid_client" || body?.error === "unauthorized_client") ? "CONFIGURACAO"
        : response.status === 401 ? "RENOVACAO"
        : response.status === 429 || response.status >= 500 ? "INDISPONIVEL" : "GOOGLE";
      throw new ErroGoogle(code, response.status >= 500, response.status, diagnosticoGoogle(body, servico));
    }
    if (!body) throw new ErroGoogle("RESPOSTA", true);
    return body as T;
  } catch (error) {
    if (error instanceof ErroGoogle) throw error;
    // Rede/timeout: sem corpo do Google, mas o endpoint recusado continua
    // registrado — nunca confundir "não houve resposta" com "Google recusou".
    throw new ErroGoogle("INDISPONIVEL", true, undefined, diagnosticoGoogle(null, servico));
  } finally { clearTimeout(timeout); }
}
function googleFetch<T>(url: string, token: string, init: RequestInit = {}) {
  return request<T>(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
}
export async function trocarCodigoGoogle(code: string, redirect: string, config: { clientId: string; clientSecret: string }) {
  const data = await request<Record<string, unknown>>("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, redirect_uri: redirect, client_id: config.clientId, client_secret: config.clientSecret, grant_type: "authorization_code" }) }, true);
  if (typeof data.access_token !== "string" || !data.access_token || typeof data.refresh_token !== "string" || !data.refresh_token) throw new ErroGoogle("RENOVACAO");
  if (typeof data.scope !== "string" || !data.scope.split(" ").includes("https://www.googleapis.com/auth/business.manage")) throw new ErroGoogle("GOOGLE");
  return { accessToken: data.access_token, refreshToken: data.refresh_token, scopes: data.scope.split(" ") };
}
export async function obterAccessTokenValido(refreshToken: string, config: { clientId: string; clientSecret: string }): Promise<string> {
  const data = await request<Record<string, unknown>>("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token" }) }, true);
  if (typeof data.access_token !== "string" || !data.access_token) throw new ErroGoogle("RESPOSTA");
  return data.access_token;
}
async function paginas(url: string, campo: string, token: string): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let pageToken = "";
  for (let page = 0; page < 100; page++) {
    const endpoint = new URL(url);
    if (pageToken) endpoint.searchParams.set("pageToken", pageToken);
    const data = await googleFetch<Record<string, unknown>>(endpoint.toString(), token);
    const items = data[campo] ?? [];
    if (!Array.isArray(items) || items.some((item) => !item || typeof item !== "object" || Array.isArray(item))) throw new ErroGoogle("RESPOSTA");
    result.push(...items);
    const next = data.nextPageToken;
    if (next === undefined || next === "") return result;
    if (typeof next !== "string" || next.length > 2048 || /[\r\n\x00]/.test(next) || seen.has(next)) throw new ErroGoogle("PAGINACAO");
    seen.add(next); pageToken = next;
  }
  throw new ErroGoogle("PAGINACAO");
}
export async function listarContasGoogle(token: string): Promise<GoogleAccountResumo[]> {
  return (await paginas("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", "accounts", token)).map((a) => {
    if (typeof a.name !== "string" || !/^accounts\/[A-Za-z0-9_-]+$/.test(a.name)) throw new ErroGoogle("RESPOSTA");
    return { name: a.name, accountName: typeof a.accountName === "string" ? a.accountName : null };
  });
}
export async function listarLocalizacoesGoogle(token: string, account: string): Promise<GoogleLocationResumo[]> {
  try { recursoGoogle(account, "locations/validation"); } catch { throw new ErroGoogle("RECURSO"); }
  return (await paginas(`https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations?readMask=name,title`, "locations", token)).map((l) => {
    if (typeof l.name !== "string") throw new ErroGoogle("RESPOSTA");
    try { return { name: recursoGoogle(account, l.name).location, title: typeof l.title === "string" ? l.title : null }; }
    catch { throw new ErroGoogle("RESPOSTA"); }
  });
}
const NOTAS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
function normalizarAvaliacao(raw: Record<string, unknown>, parent: string, expectedId?: string): GoogleReview {
  const id = typeof raw.reviewId === "string" ? raw.reviewId : typeof raw.name === "string" ? raw.name.split("/").pop() : undefined;
  if (!id || (expectedId && id !== expectedId)) throw new ErroGoogle("RECURSO");
  let name: string;
  try { name = recursoAvaliacao(parent, id); } catch { throw new ErroGoogle("RECURSO"); }
  if (raw.name !== undefined && raw.name !== name) throw new ErroGoogle("RECURSO");
  const nota = typeof raw.starRating === "string" ? NOTAS[raw.starRating] : undefined;
  if (!nota) throw new ErroGoogle("RESPOSTA");
  const reviewer = raw.reviewer as { displayName?: unknown } | undefined;
  const reply = raw.reviewReply as { comment?: unknown } | undefined;
  return { reviewId: id, name, nota, comentario: typeof raw.comment === "string" ? raw.comment.trim() || null : null,
    autor: typeof reviewer?.displayName === "string" ? reviewer.displayName : null, criadoEm: typeof raw.createTime === "string" ? raw.createTime : "",
    temRespostaGoogle: !!reply, respostaGoogleTexto: typeof reply?.comment === "string" ? reply.comment : null };
}
export async function buscarAvaliacoesGoogle(token: string, parent: string): Promise<GoogleReview[]> {
  try { recursoAvaliacao(parent, "validation"); } catch { throw new ErroGoogle("RECURSO"); }
  const reviews = (await paginas(`https://mybusiness.googleapis.com/v4/${parent}/reviews`, "reviews", token)).map((r) => normalizarAvaliacao(r, parent));
  return [...new Map(reviews.map((r) => [r.reviewId, r])).values()];
}
function separarReview(name: string) {
  const parts = name.split("/reviews/");
  try { if (parts.length !== 2 || recursoAvaliacao(parts[0], parts[1]) !== name) throw new Error(); }
  catch { throw new ErroGoogle("RECURSO"); }
  return { parent: parts[0], id: parts[1] };
}
export async function buscarAvaliacaoUnica(token: string, name: string): Promise<GoogleReview> {
  const { parent, id } = separarReview(name);
  return normalizarAvaliacao(await googleFetch<Record<string, unknown>>(`https://mybusiness.googleapis.com/v4/${name}`, token), parent, id);
}
export async function publicarRespostaGoogle(token: string, name: string, texto: string): Promise<void> {
  separarReview(name);
  const reply = await googleFetch<Record<string, unknown>>(`https://mybusiness.googleapis.com/v4/${name}/reply`, token, { method: "PUT", body: JSON.stringify({ comment: texto }) });
  if (reply.comment !== texto) throw new ErroGoogle("RESPOSTA", true);
}
export async function publicarPostGoogle(token: string, parent: string, texto: string): Promise<{ name: string }> {
  try { recursoAvaliacao(parent, "validation"); } catch { throw new ErroGoogle("RECURSO"); }
  const data = await googleFetch<Record<string, unknown>>(`https://mybusiness.googleapis.com/v4/${parent}/localPosts`, token,
    { method: "POST", body: JSON.stringify({ languageCode: "pt-BR", summary: texto, topicType: "STANDARD" }) });
  if (typeof data.name !== "string" || !data.name.startsWith(`${parent}/localPosts/`)) throw new ErroGoogle("RESPOSTA", true);
  return { name: data.name };
}
export type MetricaGoogleDiaria = { data: string; metrica: string; valor: number };

export async function buscarMetricasGoogle(
  accessToken: string, locationName: string, metricas: string[], dataInicio: string, dataFim: string
): Promise<MetricaGoogleDiaria[]> {
  if (!/^locations\/[A-Za-z0-9_-]+$/.test(locationName)) throw new ErroGoogle("RECURSO");
  const params = new URLSearchParams();
  for (const m of metricas) params.append("dailyMetrics", m);
  params.set("dailyRange.start_date.year", dataInicio.slice(0, 4));
  params.set("dailyRange.start_date.month", dataInicio.slice(5, 7));
  params.set("dailyRange.start_date.day", dataInicio.slice(8, 10));
  params.set("dailyRange.end_date.year", dataFim.slice(0, 4));
  params.set("dailyRange.end_date.month", dataFim.slice(5, 7));
  params.set("dailyRange.end_date.day", dataFim.slice(8, 10));

  const data = await googleFetch<{ multiDailyMetricTimeSeries?: { dailyMetricTimeSeries?: { dailyMetric?: string; timeSeries?: { datedValues?: { date?: { year?: number; month?: number; day?: number }; value?: string }[] } }[] }[] }>(
    `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`,
    accessToken
  );

  const resultado: MetricaGoogleDiaria[] = [];
  for (const grupo of data.multiDailyMetricTimeSeries ?? []) {
    for (const serie of grupo.dailyMetricTimeSeries ?? []) {
      const metrica = serie.dailyMetric;
      if (!metrica) continue;
      for (const ponto of serie.timeSeries?.datedValues ?? []) {
        if (!ponto.date?.year || !ponto.date.month || !ponto.date.day || ponto.value === undefined) continue;
        const data = `${ponto.date.year}-${String(ponto.date.month).padStart(2, "0")}-${String(ponto.date.day).padStart(2, "0")}`;
        resultado.push({ data, metrica, valor: Number(ponto.value) || 0 });
      }
    }
  }
  return resultado;
}
