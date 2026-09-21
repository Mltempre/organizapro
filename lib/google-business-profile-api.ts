// ── Google Business Profile — chamadas reais de I/O ──────────────────────
// Único lugar do produto que efetivamente fala com as APIs do Google
// (Business Profile / My Business), além do OAuth já existente em
// app/api/google-business-profile/oauth/callback/route.ts. Mantido
// separado de lib/google-business-profile.ts (que continua 100% puro —
// crypto e regra, sem fetch) para não misturar as duas responsabilidades.
//
// Nenhuma função aqui decide nada sozinha — cada rota que chama isto
// ainda aplica as regras puras (estadoAvaliacaoGoogle, podePublicarResposta)
// antes de agir. Erros do Google nunca são silenciados nem convertidos em
// sucesso — sempre propagados como exceção real para quem chamou decidir.

export type GoogleAccountResumo = { name: string; accountName: string | null };
export type GoogleLocationResumo = { name: string; title: string | null };

export type GoogleReview = {
  reviewId: string; // parte final de review.name, identificador estável do Google
  name: string; // caminho completo da API (accounts/.../locations/.../reviews/...)
  nota: number; // 1-5, convertido do enum starRating do Google
  comentario: string | null;
  autor: string | null;
  criadoEm: string;
  temRespostaGoogle: boolean;
  respostaGoogleTexto: string | null;
};

async function googleFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `Google recusou a solicitação (status ${response.status})`);
  return body;
}

/**
 * Troca o refresh_token (já decifrado por quem chama) por um access_token
 * válido. Nunca loga o refresh_token nem o access_token — só propaga o
 * erro real do Google quando a troca falha (token revogado, credencial
 * inválida etc.).
 */
export async function obterAccessTokenValido(
  refreshToken: string,
  config: { clientId: string; clientSecret: string }
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Não foi possível renovar o acesso ao Google — reconexão pode ser necessária");
  }
  return data.access_token;
}

export async function listarContasGoogle(accessToken: string): Promise<GoogleAccountResumo[]> {
  const data = await googleFetch<{ accounts?: { name?: string; accountName?: string }[] }>(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    accessToken
  );
  return (data.accounts ?? []).filter((a): a is { name: string; accountName?: string } => !!a.name)
    .map((a) => ({ name: a.name, accountName: a.accountName ?? null }));
}

export async function listarLocalizacoesGoogle(accessToken: string, accountName: string): Promise<GoogleLocationResumo[]> {
  const data = await googleFetch<{ locations?: { name?: string; title?: string }[] }>(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
    accessToken
  );
  return (data.locations ?? []).filter((l): l is { name: string; title?: string } => !!l.name)
    .map((l) => ({ name: l.name, title: l.title ?? null }));
}

const NOTA_POR_ENUM: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

function normalizarAvaliacao(bruta: {
  name?: string; reviewId?: string; starRating?: string; comment?: string;
  reviewer?: { displayName?: string }; createTime?: string; reviewReply?: { comment?: string };
}): GoogleReview | null {
  if (!bruta.name) return null;
  const reviewId = bruta.reviewId || bruta.name.split("/").pop() || bruta.name;
  return {
    reviewId,
    name: bruta.name,
    nota: bruta.starRating ? (NOTA_POR_ENUM[bruta.starRating] ?? 0) : 0,
    comentario: bruta.comment && bruta.comment.trim() ? bruta.comment.trim() : null,
    autor: bruta.reviewer?.displayName ?? null,
    criadoEm: bruta.createTime || "",
    temRespostaGoogle: !!bruta.reviewReply?.comment,
    respostaGoogleTexto: bruta.reviewReply?.comment ?? null,
  };
}

/**
 * Busca as avaliações reais da localização vinculada. Nunca fabrica uma
 * avaliação — devolve exatamente o que o Google retornou, normalizado.
 */
export async function buscarAvaliacoesGoogle(accessToken: string, locationName: string): Promise<GoogleReview[]> {
  const data = await googleFetch<{ reviews?: Record<string, unknown>[] }>(
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
    accessToken
  );
  return (data.reviews ?? [])
    .map((r) => normalizarAvaliacao(r as Parameters<typeof normalizarAvaliacao>[0]))
    .filter((r): r is GoogleReview => r !== null);
}

/**
 * Rebusca UMA avaliação específica — usada para revalidar o estado real
 * (tem resposta ou não) imediatamente antes de publicar, nunca confiando
 * numa lista buscada minutos antes.
 */
export async function buscarAvaliacaoUnica(accessToken: string, reviewName: string): Promise<GoogleReview | null> {
  const data = await googleFetch<Record<string, unknown>>(`https://mybusiness.googleapis.com/v4/${reviewName}`, accessToken);
  return normalizarAvaliacao(data as Parameters<typeof normalizarAvaliacao>[0]);
}

/**
 * Publica a resposta no Google (PUT idempotente do lado do Google — o
 * mesmo texto enviado duas vezes só atualiza a resposta, mas a proteção
 * real contra duplo-clique é a chave de idempotência em eventos_dominio,
 * verificada por quem chama antes desta função).
 */
export async function publicarRespostaGoogle(accessToken: string, reviewName: string, texto: string): Promise<void> {
  await googleFetch(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, accessToken, {
    method: "PUT",
    body: JSON.stringify({ comment: texto }),
  });
}

// ── Bloco 6 — Google Presença / Local Posts ─────────────────────────────

export async function publicarPostGoogle(accessToken: string, locationName: string, texto: string): Promise<{ name: string }> {
  const data = await googleFetch<{ name?: string }>(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    accessToken,
    { method: "POST", body: JSON.stringify({ languageCode: "pt-BR", summary: texto, topicType: "STANDARD" }) }
  );
  if (!data.name) throw new Error("Google não confirmou a publicação do post");
  return { name: data.name };
}

// ── Bloco 7 — Métricas/Performance ───────────────────────────────────────
// CÓDIGO PRONTO — HOMOLOGAÇÃO GOOGLE REAL PENDENTE. A Performance API
// exige um projeto Google Cloud com Business Profile Performance API
// habilitada; a leitura abaixo já está pronta e normaliza só o que a API
// realmente devolve, mas nunca foi exercitada contra a API real.

export type MetricaGoogleDiaria = { data: string; metrica: string; valor: number };

export async function buscarMetricasGoogle(
  accessToken: string, locationName: string, metricas: string[], dataInicio: string, dataFim: string
): Promise<MetricaGoogleDiaria[]> {
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
