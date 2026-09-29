// ── Pesquisa de Preços — busca REAL na web (OpenAI Responses + web_search) ──
//
// Complementa (não substitui) o registro manual rastreável de
// lib/pesquisa-precos.ts. Fluxo: o modelo pesquisa a web de verdade
// (ferramenta oficial `web_search`), devolve ofertas em JSON e a lista de
// páginas que REALMENTE consultou (`web_search_call.action.sources`).
//
// Regras anti-fabricação (aplicadas aqui, no servidor, nunca confiadas ao
// modelo):
//   • referência cujo site nunca foi consultado pela busca → descartada;
//   • URL que é exatamente uma página consultada → "pagina_consultada";
//     mesma origem mas página não listada → "site_consultado" (mostrada com
//     ressalva, para o dono conferir antes de usar);
//   • preço inválido/absurdo → descartado; nada é arredondado para "caber";
//   • nenhuma média/recomendação com poucas referências ou poucas fontes;
//   • serviço/mão de obra sem cidade → sem conclusão (preço local importa).
// Nada é gravado automaticamente: o dono decide registrar cada referência
// no histórico imutável existente. Nenhum preço de venda é alterado.

export type TipoConsultaPreco = "produto" | "servico";
export type Comparabilidade = "alta" | "media" | "baixa";
export type Confirmacao = "pagina_consultada" | "site_consultado";

export type ReferenciaPreco = {
  titulo: string;
  precoCentavos: number;
  url: string;
  fonte: string; // domínio
  tipo: TipoConsultaPreco;
  localidade: string | null;
  comparabilidade: Comparabilidade;
  diferenca: string | null;
  confirmacao: Confirmacao;
  mesmaLocalidade: boolean | null; // só para serviço com cidade informada
};

export type MotivoDescarte = "url_invalida" | "site_nao_consultado" | "preco_invalido" | "titulo_ausente" | "duplicada";

export type ResultadoExtracao = {
  referencias: ReferenciaPreco[];
  descartadas: { motivo: MotivoDescarte; quantidade: number }[];
  fontesConsultadas: number;
  respostaInterpretavel: boolean;
};

export type ResumoReferencias = {
  consideradas: number;
  fontesDistintas: number;
  minimoCentavos: number | null;
  maximoCentavos: number | null;
  medianaCentavos: number | null;
  confiavel: boolean;
  motivo: string;
  seuPrecoCentavos: number | null;
  posicaoSeuPreco: "abaixo" | "dentro" | "acima" | null;
};

export const MODELO_BUSCA_WEB = "gpt-4.1-mini";
const PRECO_MIN_CENTAVOS = 100;          // R$ 1,00
const PRECO_MAX_CENTAVOS = 100_000_000;  // R$ 1.000.000,00
export const MIN_REFERENCIAS_CONFIAVEL = 3;
export const MIN_FONTES_CONFIAVEL = 2;

function normalizarTexto(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function chavePagina(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "");
  } catch { return null; }
}
function dominio(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

export function montarConsultaBuscaWeb(input: { termo: string; tipo: TipoConsultaPreco; localidade?: string | null }): string {
  const termo = input.termo.trim().slice(0, 160);
  const local = input.localidade?.trim().slice(0, 80) || null;
  const alvo = input.tipo === "produto"
    ? `preços atuais no Brasil do PRODUTO: "${termo}". Priorize lojas e anúncios com o mesmo modelo/especificação.`
    : `preços cobrados pelo SERVIÇO / MÃO DE OBRA: "${termo}"${local ? ` em ${local} e região` : " no Brasil"}. Indique a cidade/região de cada preço quando a página informar.`;
  return [
    `Pesquise na web ${alvo}`,
    'Responda SOMENTE com JSON válido (sem texto antes ou depois) no formato {"referencias":[{"titulo":"...","preco_reais":123.45,"url":"https://...","tipo":"' + input.tipo + '","localidade":null,"comparabilidade":"alta","diferenca":null}]}.',
    "Regras: inclua apenas ofertas cujo preço você viu na página; use o preço exatamente como exibido (à vista, em reais); \"url\" é a página onde o preço aparece;",
    "\"comparabilidade\": alta = mesmo item/serviço; media = parecido com diferença relevante (descreva em \"diferenca\"); baixa = só relacionado;",
    "\"localidade\": cidade/UF da oferta quando a página informar, senão null. Nunca invente preço, loja ou link; se não encontrar, devolva {\"referencias\":[]}; no máximo 8.",
  ].join("\n");
}

function lerJson(texto: string): unknown {
  const bloco = texto.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? texto;
  const ini = bloco.indexOf("{"), fim = bloco.lastIndexOf("}");
  if (ini < 0 || fim <= ini) return null;
  try { return JSON.parse(bloco.slice(ini, fim + 1)); } catch { return null; }
}

export function mesmaLocalidade(localidadeRef: string | null, localidadeInformada: string | null): boolean | null {
  if (!localidadeInformada) return null;
  if (!localidadeRef) return false;
  const cidade = normalizarTexto(localidadeInformada.split(/[,/-]/)[0]);
  return cidade.length >= 3 && normalizarTexto(localidadeRef).includes(cidade);
}

// Extrai e valida as referências de uma resposta da API Responses.
export function extrairReferencias(resposta: unknown, ctx: { tipo: TipoConsultaPreco; localidade?: string | null }): ResultadoExtracao {
  const saida = (resposta as { output?: unknown[] })?.output ?? [];
  const itens = Array.isArray(saida) ? saida as Record<string, unknown>[] : [];
  const consultadas: string[] = [];
  for (const it of itens) {
    if (it.type !== "web_search_call") continue;
    const fontes = (it.action as { sources?: { url?: string }[] } | undefined)?.sources ?? [];
    for (const f of fontes) if (typeof f?.url === "string") consultadas.push(f.url);
  }
  const mensagem = itens.find(it => it.type === "message") as { content?: { text?: string; annotations?: { url?: string }[] }[] } | undefined;
  const texto = mensagem?.content?.map(c => c.text ?? "").join("\n") ?? "";
  for (const c of mensagem?.content ?? []) for (const a of c.annotations ?? []) if (typeof a?.url === "string") consultadas.push(a.url);

  const paginas = new Set(consultadas.map(chavePagina).filter((x): x is string => !!x));
  const dominios = new Set(consultadas.map(dominio).filter((x): x is string => !!x));
  const json = lerJson(texto) as { referencias?: unknown } | null;
  const brutas = Array.isArray(json?.referencias) ? json!.referencias as Record<string, unknown>[] : [];

  const contagem = new Map<MotivoDescarte, number>();
  const descartar = (m: MotivoDescarte) => contagem.set(m, (contagem.get(m) ?? 0) + 1);
  const vistas = new Set<string>();
  const referencias: ReferenciaPreco[] = [];
  const localidadeInformada = ctx.localidade?.trim() || null;

  for (const b of brutas) {
    const url = typeof b.url === "string" ? b.url.trim() : "";
    const pagina = chavePagina(url), host = dominio(url);
    if (!pagina || !host) { descartar("url_invalida"); continue; }
    if (!dominios.has(host)) { descartar("site_nao_consultado"); continue; }
    const titulo = typeof b.titulo === "string" ? b.titulo.trim().slice(0, 200) : "";
    if (!titulo) { descartar("titulo_ausente"); continue; }
    const reais = typeof b.preco_reais === "number" ? b.preco_reais : Number.NaN;
    const precoCentavos = Math.round(reais * 100);
    if (!Number.isFinite(reais) || precoCentavos < PRECO_MIN_CENTAVOS || precoCentavos > PRECO_MAX_CENTAVOS) { descartar("preco_invalido"); continue; }
    const chave = `${pagina}|${precoCentavos}`;
    if (vistas.has(chave)) { descartar("duplicada"); continue; }
    vistas.add(chave);
    const comparabilidade: Comparabilidade = b.comparabilidade === "alta" || b.comparabilidade === "media" ? b.comparabilidade : "baixa";
    const localidade = typeof b.localidade === "string" && b.localidade.trim() ? b.localidade.trim().slice(0, 80) : null;
    referencias.push({
      titulo, precoCentavos, url, fonte: host, tipo: ctx.tipo, localidade, comparabilidade,
      diferenca: typeof b.diferenca === "string" && b.diferenca.trim() ? b.diferenca.trim().slice(0, 200) : null,
      confirmacao: paginas.has(pagina) ? "pagina_consultada" : "site_consultado",
      mesmaLocalidade: ctx.tipo === "servico" ? mesmaLocalidade(localidade, localidadeInformada) : null,
    });
  }
  return {
    referencias,
    descartadas: [...contagem.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade })),
    fontesConsultadas: paginas.size,
    respostaInterpretavel: json !== null,
  };
}

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

// Números só a partir de referências comparáveis (não "baixa") e, para
// serviço, da mesma cidade informada. Sem cidade, serviço não conclui.
export function resumirReferencias(refs: ReferenciaPreco[], ctx: { tipo: TipoConsultaPreco; localidade?: string | null; seuPrecoCentavos?: number | null }): ResumoReferencias {
  const seu = typeof ctx.seuPrecoCentavos === "number" && ctx.seuPrecoCentavos > 0 ? ctx.seuPrecoCentavos : null;
  const vazio = (motivo: string, consideradas = 0, fontes = 0): ResumoReferencias => ({
    consideradas, fontesDistintas: fontes, minimoCentavos: null, maximoCentavos: null, medianaCentavos: null,
    confiavel: false, motivo, seuPrecoCentavos: seu, posicaoSeuPreco: null,
  });
  if (ctx.tipo === "servico" && !ctx.localidade?.trim()) {
    return vazio("Para serviço/mão de obra informe a cidade: preços de outras regiões não representam o seu mercado.");
  }
  const consideradas = refs.filter(r => r.comparabilidade !== "baixa" && (ctx.tipo === "produto" || r.mesmaLocalidade === true));
  const fontes = new Set(consideradas.map(r => r.fonte)).size;
  if (consideradas.length === 0) {
    return vazio(ctx.tipo === "servico" ? "Nenhuma referência comparável encontrada para essa cidade." : "Nenhuma referência comparável encontrada.");
  }
  const precos = consideradas.map(r => r.precoCentavos);
  const minimo = Math.min(...precos), maximo = Math.max(...precos), med = mediana(precos);
  const confiavel = consideradas.length >= MIN_REFERENCIAS_CONFIAVEL && fontes >= MIN_FONTES_CONFIAVEL;
  return {
    consideradas: consideradas.length, fontesDistintas: fontes,
    minimoCentavos: minimo, maximoCentavos: maximo, medianaCentavos: med,
    confiavel,
    motivo: confiavel
      ? `Faixa observada em ${consideradas.length} referências de ${fontes} fontes. Não é um "preço correto": confira as fontes antes de decidir.`
      : `Poucas referências comparáveis (${consideradas.length} de ${fontes} fonte${fontes === 1 ? "" : "s"}) — use apenas como indício, não como comparação de mercado.`,
    seuPrecoCentavos: seu,
    posicaoSeuPreco: seu === null || !confiavel ? null : seu < minimo ? "abaixo" : seu > maximo ? "acima" : "dentro",
  };
}

export type FalhaBusca = { ok: false; status: 502 | 503 | 504; erro: string };
export type SucessoBusca = { ok: true; extracao: ResultadoExtracao; modelo: string };

// Única chamada ao provedor. `fetchImpl` é injetável para teste; nunca loga
// chave, prompt nem resposta.
export async function executarBuscaWeb(args: {
  apiKey: string | undefined; termo: string; tipo: TipoConsultaPreco; localidade?: string | null;
  fetchImpl?: typeof fetch; timeoutMs?: number;
}): Promise<SucessoBusca | FalhaBusca> {
  if (!args.apiKey) return { ok: false, status: 503, erro: "Busca na web indisponível: provedor não configurado." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 45_000);
  try {
    const local = args.localidade?.trim();
    const res = await (args.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO_BUSCA_WEB,
        tools: [{ type: "web_search", user_location: { type: "approximate", country: "BR", ...(local ? { city: local.slice(0, 80) } : {}) } }],
        include: ["web_search_call.action.sources"],
        input: montarConsultaBuscaWeb({ termo: args.termo, tipo: args.tipo, localidade: local }),
        max_output_tokens: 1800,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: 502, erro: "O provedor de busca não respondeu corretamente." };
    const json = await res.json();
    return { ok: true, extracao: extrairReferencias(json, { tipo: args.tipo, localidade: local }), modelo: MODELO_BUSCA_WEB };
  } catch {
    return { ok: false, status: controller.signal.aborted ? 504 : 502, erro: "A busca na web demorou demais ou falhou." };
  } finally { clearTimeout(timer); }
}
