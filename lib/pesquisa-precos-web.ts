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
// Serviço/mão de obra: o que o preço anunciado inclui. Só "mao_de_obra" entra
// na faixa — anúncio com aparelho/material/peça junto nunca vira preço puro
// de mão de obra (fica listado, identificado, fora da conta).
export type ComposicaoServico = "mao_de_obra" | "mao_de_obra_e_material" | "produto" | "indefinida";

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
  imagemUrl?: string | null; // produto: imagem declarada pela página da loja (lib/pesquisa-precos-imagem.ts)
  composicao?: ComposicaoServico; // só serviço
};

export type MotivoDescarte = "url_invalida" | "site_nao_consultado" | "preco_invalido" | "titulo_ausente" | "duplicada";

export type ResultadoExtracao = {
  referencias: ReferenciaPreco[];
  descartadas: { motivo: MotivoDescarte; quantidade: number }[];
  fontesConsultadas: number;
  respostaInterpretavel: boolean;
  fatores: string[]; // serviço: o que pode alterar o preço — só texto, nunca valor
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

export const LIMITE_ESPECIFICACAO = 300;

// O que o profissional quer comparar: só o serviço, serviço com material, ou
// sem definição (qualquer serviço, nunca venda de produto).
export type EscopoServico = "mao_de_obra" | "mao_de_obra_e_material" | "indefinido";
export const ESCOPOS_SERVICO: EscopoServico[] = ["mao_de_obra", "mao_de_obra_e_material", "indefinido"];
export function composicaoEntraNaConta(composicao: ComposicaoServico | undefined, escopo: EscopoServico): boolean {
  if (escopo === "mao_de_obra") return composicao === "mao_de_obra";
  if (escopo === "mao_de_obra_e_material") return composicao === "mao_de_obra_e_material";
  return composicao === "mao_de_obra" || composicao === "mao_de_obra_e_material";
}

export function montarConsultaBuscaWeb(input: { termo: string; tipo: TipoConsultaPreco; localidade?: string | null; especificacao?: string | null; escopo?: EscopoServico }): string {
  const termo = input.termo.trim().slice(0, 160);
  const local = input.localidade?.trim().slice(0, 80) || null;
  if (input.tipo === "produto") {
    return [
      `Pesquise na web preços atuais no Brasil do PRODUTO: "${termo}". Priorize lojas e anúncios com o mesmo modelo/especificação.`,
      'Responda SOMENTE com JSON válido (sem texto antes ou depois) no formato {"referencias":[{"titulo":"...","preco_reais":123.45,"url":"https://...","tipo":"' + input.tipo + '","localidade":null,"comparabilidade":"alta","diferenca":null}]}.',
      "Regras: inclua apenas ofertas cujo preço você viu na página; use o preço exatamente como exibido (à vista, em reais); \"url\" é a página onde o preço aparece;",
      "\"comparabilidade\": alta = mesmo item/serviço; media = parecido com diferença relevante (descreva em \"diferenca\"); baixa = só relacionado;",
      "\"localidade\": cidade/UF da oferta quando a página informar, senão null. Nunca invente preço, loja ou link; se não encontrar, devolva {\"referencias\":[]}; no máximo 8.",
    ].join("\n");
  }
  // Serviço / mão de obra: o preço depende do que está incluso e da região.
  const especificacao = input.especificacao?.trim().slice(0, LIMITE_ESPECIFICACAO) || null;
  return [
    `Pesquise na web preços cobrados pelo SERVIÇO / MÃO DE OBRA: "${termo}"${local ? ` em ${local} e região` : " no Brasil"}. Indique a cidade/região de cada preço quando a página informar.`,
    ...(input.escopo === "mao_de_obra_e_material" ? ["O profissional quer comparar preços que INCLUEM material/peças/aparelho junto com o serviço."] : input.escopo === "indefinido" ? [] : ["O profissional quer comparar SOMENTE a mão de obra, sem material, peça ou aparelho."]),
    ...(especificacao ? [`Especificação informada pelo profissional: "${especificacao}". Compare cada oferta com ela.`] : []),
    'Responda SOMENTE com JSON válido (sem texto antes ou depois) no formato {"referencias":[{"titulo":"...","preco_reais":123.45,"url":"https://...","tipo":"servico","localidade":null,"comparabilidade":"alta","diferenca":null,"composicao":"mao_de_obra"}],"fatores":["..."]}.',
    "Regras: inclua apenas ofertas cujo preço você viu na página; use o preço exatamente como exibido (à vista, em reais); \"url\" é a página onde o preço aparece;",
    "\"composicao\": mao_de_obra = o preço é SÓ do serviço; mao_de_obra_e_material = inclui aparelho, peça, vidro, material ou produto junto; produto = é a venda de um produto; indefinida = a página não deixa claro;",
    "\"comparabilidade\": alta = mesmo serviço e mesma especificação; media = parecido com diferença relevante (descreva em \"diferenca\"); baixa = só relacionado;",
    "\"localidade\": cidade/UF da oferta quando a página informar, senão null;",
    "\"fatores\": até 5 fatores que podem alterar o preço deste serviço (ex.: metragem, material, dificuldade de acesso, deslocamento), SEM valores nem números;",
    "Nunca invente preço, loja ou link; se não encontrar, devolva {\"referencias\":[],\"fatores\":[]}; no máximo 8.",
  ].join("\n");
}

// Anúncio que deixa explícito que vem com aparelho/material/produto nunca é
// tratado como preço puro de mão de obra, mesmo que o modelo o classifique assim.
const SINAL_MISTURA = /(\+|\bcom\b)\s*(a\s+)?instala[çc][ãa]o|instala[çc][ãa]o\s+(inclusa|incluída|incluida|gr[áa]tis)|\b(kit|aparelho|equipamento|produto|material|pe[çc]as?)\s+(inclus[oa]s?|incluíd[oa]s?|incluid[oa]s?)\b|\b(com|\+)\s*(material|pe[çc]as?|aparelho|equipamento|vidro)\b/i;

// Título que não fala de nenhum serviço (ex.: "Box para Banheiro | Melhor
// Preço") é anúncio de produto: nunca aceito como preço de mão de obra.
const SINAL_SERVICO = /instala|m[ãa]o\s+de\s+obra|servi[çc]o|montag|monta\b|troca|manuten|consert|repar|limpez|pintur|reform|visita|di[áa]ria|\bhora\b|aplica[çc]|regulag|revis[ãa]o|higieniz|desentup|fia[çc][ãa]o|el[ée]tric|hidr[áa]ulic|assist[êe]ncia|t[ée]cnic/i;

export function classificarComposicao(bruta: unknown, titulo: string, diferenca: string | null): ComposicaoServico {
  const declarada: ComposicaoServico = bruta === "mao_de_obra" || bruta === "mao_de_obra_e_material" || bruta === "produto" ? bruta : "indefinida";
  const texto = `${titulo} ${diferenca ?? ""}`;
  if (declarada === "mao_de_obra" && SINAL_MISTURA.test(texto)) return "mao_de_obra_e_material";
  if (declarada === "mao_de_obra" && !SINAL_SERVICO.test(texto)) return "indefinida";
  return declarada;
}

/** Fatores qualitativos (sem valores): até 5, curtos, sem R$ nem números. */
export function sanitizarFatores(brutos: unknown): string[] {
  if (!Array.isArray(brutos)) return [];
  return brutos
    .filter((f): f is string => typeof f === "string")
    .map(f => f.trim().replace(/\s+/g, " "))
    .filter(f => f.length >= 3 && f.length <= 120 && !/r\$|\d/i.test(f))
    .slice(0, 5);
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
  const json = lerJson(texto) as { referencias?: unknown; fatores?: unknown } | null;
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
    const diferenca = typeof b.diferenca === "string" && b.diferenca.trim() ? b.diferenca.trim().slice(0, 200) : null;
    referencias.push({
      titulo, precoCentavos, url, fonte: host, tipo: ctx.tipo, localidade, comparabilidade, diferenca,
      confirmacao: paginas.has(pagina) ? "pagina_consultada" : "site_consultado",
      mesmaLocalidade: ctx.tipo === "servico" ? mesmaLocalidade(localidade, localidadeInformada) : null,
      ...(ctx.tipo === "servico" ? { composicao: classificarComposicao(b.composicao, titulo, diferenca) } : {}),
    });
  }
  return {
    referencias,
    descartadas: [...contagem.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade })),
    fontesConsultadas: paginas.size,
    respostaInterpretavel: json !== null,
    fatores: ctx.tipo === "servico" ? sanitizarFatores(json?.fatores) : [],
  };
}

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

// Números só a partir de referências comparáveis (não "baixa") e, para
// serviço, da mesma cidade informada e SÓ de preço de mão de obra (sem
// aparelho/material/produto junto). Sem cidade, serviço não conclui; com
// evidência fraca, serviço não forma faixa (só lista as referências).
export const MSG_SERVICO_EVIDENCIA_FRACA = "Não encontrei referências suficientes e comparáveis para formar uma faixa confiável deste serviço.";
export function resumirReferencias(refs: ReferenciaPreco[], ctx: { tipo: TipoConsultaPreco; localidade?: string | null; seuPrecoCentavos?: number | null; escopo?: EscopoServico }): ResumoReferencias {
  const escopo: EscopoServico = ctx.escopo ?? "mao_de_obra";
  const seu = typeof ctx.seuPrecoCentavos === "number" && ctx.seuPrecoCentavos > 0 ? ctx.seuPrecoCentavos : null;
  const vazio = (motivo: string, consideradas = 0, fontes = 0): ResumoReferencias => ({
    consideradas, fontesDistintas: fontes, minimoCentavos: null, maximoCentavos: null, medianaCentavos: null,
    confiavel: false, motivo, seuPrecoCentavos: seu, posicaoSeuPreco: null,
  });
  if (ctx.tipo === "servico" && !ctx.localidade?.trim()) {
    return vazio("Para serviço/mão de obra informe a cidade: preços de outras regiões não representam o seu mercado.");
  }
  const consideradas = refs.filter(r => r.comparabilidade !== "baixa"
    && (ctx.tipo === "produto" || (r.mesmaLocalidade === true && composicaoEntraNaConta(r.composicao, escopo))));
  const fontes = new Set(consideradas.map(r => r.fonte)).size;
  if (consideradas.length === 0) {
    return vazio(ctx.tipo === "servico" ? `${MSG_SERVICO_EVIDENCIA_FRACA} Nenhuma referência ${escopo === "mao_de_obra" ? "de mão de obra" : escopo === "mao_de_obra_e_material" ? "de mão de obra com material" : "de serviço"} comparável nessa cidade.` : "Nenhuma referência comparável encontrada.");
  }
  const precos = consideradas.map(r => r.precoCentavos);
  const minimo = Math.min(...precos), maximo = Math.max(...precos), med = mediana(precos);
  const confiavel = consideradas.length >= MIN_REFERENCIAS_CONFIAVEL && fontes >= MIN_FONTES_CONFIAVEL;
  if (ctx.tipo === "servico" && !confiavel) {
    return vazio(`${MSG_SERVICO_EVIDENCIA_FRACA} Encontrei ${consideradas.length} referência${consideradas.length === 1 ? "" : "s"} de ${fontes} fonte${fontes === 1 ? "" : "s"} — veja-as individualmente abaixo.`, consideradas.length, fontes);
  }
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
  apiKey: string | undefined; termo: string; tipo: TipoConsultaPreco; localidade?: string | null; especificacao?: string | null; escopo?: EscopoServico;
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
        input: montarConsultaBuscaWeb({ termo: args.termo, tipo: args.tipo, localidade: local, especificacao: args.especificacao, escopo: args.escopo }),
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
