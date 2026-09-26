// ── fetchJsonSeguro — distingue "vazio real" de "falha ao carregar" ────────
// Helper mínimo, client-safe (usa só `fetch`/`Response` globais). Não
// substitui a lógica de cada tela — só decide, por chamada individual, se
// o resultado é confiável (HTTP bem-sucedido) ou se houve uma falha real
// (inclusive 404, erro de rede ou exceção) que precisa ser
// sinalizada ao usuário, nunca silenciosamente virar "0 pendências".
//
// Fecha o achado sistêmico da auditoria de última milha: 7 telas
// (Copiloto, Follow-up, Orçamentos, Oportunidades, Cobranças, Pedidos,
// Tratamentos) tratavam QUALQUER falha de API do mesmo jeito que uma
// lista genuinamente vazia — `r.ok ? r.json() : {...vazio}` seguido de
// `.catch(() => ({...vazio}))`, sem preservar nenhum sinal de que algo
// deu errado.
export async function fetchJsonSeguro<T>(
  input: string,
  init: RequestInit,
  vazio: T
): Promise<{ dado: T; falhou: boolean }> {
  try {
    const r = await fetch(input, init);
    if (r.ok) return { dado: (await r.json()) as T, falhou: false };
    return { dado: vazio, falhou: true };
  } catch {
    return { dado: vazio, falhou: true };
  }
}
