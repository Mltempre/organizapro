// ── Meta Ads V1 — mapeamento de métricas e junção de atribuição (PURO) ─────
//
// Módulo isomórfico deliberadamente SEM "server-only": as funções são puro
// cálculo sobre dados já resolvidos (sem rede, sem banco, sem segredo) e são
// consumidas pelo servidor (lib/meta-ads-dados.ts) e pela UI (MetaAdsSecao).
//
// Regras de honestidade deste módulo:
//   • número vindo da API vira null quando não é finito — NUNCA é
//     substituído por 0 fabricado (0 real da Meta é mantido como 0);
//   • campanha sem dado de insights no período aparece com métricas null
//     (UI mostra "—"), nunca com zeros inventados;
//   • a junção com atribuição só acontece por campaign_id EXATO da captura
//     (identificadores_ads.campaign_id === id da campanha Meta, plataforma
//     meta_ads). Sem correspondência exata → null ("—"). Nunca por nome,
//     utm_campaign ou semelhança — o sistema não infere relação.

export type MetricaCampanha = {
  campaignId: string;
  nome: string | null;
  status: string | null;
  gasto: number | null;
  impressoes: number | null;
  alcance: number | null;
  cliques: number | null;
  ctr: number | null;
};

/** Lista de campanhas como devolvida pela leitura — entrada de mapearMetricas. */
export type CampanhaMeta = { id: string; nome: string | null; status: string | null };

export type AtribuicaoCampanha = {
  capturas: number;
  leads: number;
  oportunidades: number;
  conversoes: number;
  receitaCentavos: number;
};

/** Subconjunto estrutural da linha do relatório canônico de atribuição
 *  (lib/atribuicao-relatorio.ts) usado na junção. */
export type LinhaAtribuicaoMeta = {
  plataforma: string;
  campanha: string | null;
  capturas: number;
  leads: number;
  oportunidades: number;
  conversoes: number;
  receitaCentavos: number;
};

/** Converte o formato textual da Graph API ("123.45") em número finito.
 *  Qualquer coisa não numérica → null (nunca 0 implícito). */
export function numeroMeta(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Une a lista de campanhas (status/nome) com os insights do período.
 *  Campanhas sem linha de insights → métricas null. Insights de campanha que
 *  não está mais na lista (ex.: removida) ainda entram — o gasto é real. */
export function mapearMetricas(
  campanhas: Array<{ id: string; nome: string | null; status: string | null }>,
  insights: Array<Record<string, unknown>>
): MetricaCampanha[] {
  const insightsPorId = new Map<string, Record<string, unknown>>();
  const nomesExtras = new Map<string, string | null>();
  for (const linha of insights) {
    const id = typeof linha.campaign_id === "string" ? linha.campaign_id : null;
    if (!id) continue;
    insightsPorId.set(id, linha);
    const nome = typeof linha.campaign_name === "string" ? linha.campaign_name : null;
    if (nome) nomesExtras.set(id, nome);
  }
  const resultado: MetricaCampanha[] = [];
  const vistos = new Set<string>();
  for (const campanha of campanhas) {
    vistos.add(campanha.id);
    const insight = insightsPorId.get(campanha.id);
    resultado.push({
      campaignId: campanha.id,
      nome: campanha.nome,
      status: campanha.status,
      gasto: insight ? numeroMeta(insight.spend) : null,
      impressoes: insight ? numeroMeta(insight.impressions) : null,
      alcance: insight ? numeroMeta(insight.reach) : null,
      cliques: insight ? numeroMeta(insight.clicks) : null,
      ctr: insight ? numeroMeta(insight.ctr) : null,
    });
  }
  for (const [id, insight] of insightsPorId) {
    if (vistos.has(id)) continue;
    resultado.push({
      campaignId: id,
      nome: nomesExtras.get(id) ?? null,
      status: null,
      gasto: numeroMeta(insight.spend),
      impressoes: numeroMeta(insight.impressions),
      alcance: numeroMeta(insight.reach),
      cliques: numeroMeta(insight.clicks),
      ctr: numeroMeta(insight.ctr),
    });
  }
  return resultado;
}

/** Junção EXATA com a atribuição canônica do tenant: só linhas cuja
 *  plataforma é meta_ads e cujo campanha (identificadores_ads.campaign_id)
 *  é idêntico ao campaign_id da Meta. Sem match → atribuicao null. */
export function juntarAtribuicaoMeta(
  metricas: MetricaCampanha[],
  linhas: LinhaAtribuicaoMeta[]
): Array<{ metrica: MetricaCampanha; atribuicao: AtribuicaoCampanha | null }> {
  return metricas.map((metrica) => {
    const correspondentes = linhas.filter(
      (l) => l.plataforma === "meta_ads" && l.campanha === metrica.campaignId
    );
    if (correspondentes.length === 0) return { metrica, atribuicao: null };
    const atribuicao = correspondentes.reduce<AtribuicaoCampanha>(
      (acc, l) => ({
        capturas: acc.capturas + (Number.isFinite(l.capturas) ? l.capturas : 0),
        leads: acc.leads + (Number.isFinite(l.leads) ? l.leads : 0),
        oportunidades: acc.oportunidades + (Number.isFinite(l.oportunidades) ? l.oportunidades : 0),
        conversoes: acc.conversoes + (Number.isFinite(l.conversoes) ? l.conversoes : 0),
        receitaCentavos: acc.receitaCentavos + (Number.isFinite(l.receitaCentavos) ? l.receitaCentavos : 0),
      }),
      { capturas: 0, leads: 0, oportunidades: 0, conversoes: 0, receitaCentavos: 0 }
    );
    return { metrica, atribuicao };
  });
}

/** Formata gasto com a moeda real da conta de anúncios (fallback BRL).
 *  null → "—" (sem dado lido, nunca R$ 0,00 fabricado). */
export function formatarGastoMeta(valor: number | null, moeda: string | null): string {
  if (valor === null) return "—";
  const codigo = (moeda || "BRL").toUpperCase();
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: codigo }).format(valor);
  } catch {
    return `${valor.toFixed(2)} ${codigo}`;
  }
}

/** Formata métrica inteira com "—" quando ausente (nunca 0 fabricado). */
export function formatarNumeroMeta(valor: number | null): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat("pt-BR").format(valor);
}

/** Soma honesta do gasto lido: só valores não-nulos; informa quantas
 *  campanhas ficaram sem dado para o total nunca parecer completo por acaso. */
export function totalGastoMeta(metricas: MetricaCampanha[]): { total: number; semDados: number } {
  let total = 0;
  let semDados = 0;
  for (const m of metricas) {
    if (m.gasto === null) semDados += 1;
    else total += m.gasto;
  }
  return { total, semDados };
}