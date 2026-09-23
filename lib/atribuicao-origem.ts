// ── Atribuição de origem · captura canônica de UTM/GCLID/FBCLID ─────────────
// Ver docs/google-presenca-reputacao-ads-v1-arquitetura.md para o desenho
// completo (cadeia Presença → Descoberta → Contato/Lead → Oportunidade →
// Conversão → Avaliação → Reputação → Nova Demanda → Resultado). Código
// puro (sem Supabase, sem fetch, sem chamada a Google/Meta) — mesma
// filosofia de lib/orcamentos-state-machine.ts: testável antes de qualquer
// migration ou credencial de Ads existir.
//
// Regra de ouro deste módulo: NUNCA inventa origem. Um campo ausente vira
// `null`, nunca um valor adivinhado; uma classificação sem evidência
// suficiente vira "direto"/"outro", nunca "google_ads" por suposição. Isso
// é o mesmo princípio já aplicado a dinheiro em
// lib/orcamentos-state-machine.ts (`valorCentavos === null` nunca vira 0)
// e a receita em docs/orcamento-venda-receita-v1-arquitetura.md seção 8
// (nunca chamar de "comprovado" o que é só inferido).

export type OrigemCaptada = {
  utmSource:    string | null;
  utmMedium:    string | null;
  utmCampaign:  string | null;
  utmContent:   string | null;
  gclid:        string | null; // presente só quando o Google efetivamente anexou (auto-tagging de um clique em anúncio)
  fbclid:       string | null; // referência capturada; sozinha não comprova mídia paga
  referrerHost: string | null; // host do Referer, quando o navegador o envia (nem sempre envia)
  capturadoEm:  string;        // ISO — momento da captura, nunca reconstruído depois
};

export type TipoOrigem =
  | "google_ads"     // gclid presente — sinal forte de clique em anúncio Google
  | "meta_ads"        // marcação explícita de mídia paga Meta; fbclid sozinho não basta
  | "campanha_utm"    // algum utm_* presente, sem click id reconhecido (campanha marcada manualmente)
  | "busca_organica"  // referrer de um motor de busca conhecido, sem utm/click id
  | "referencia"      // outro site encaminhou o visitante, sem utm/click id
  | "direto";         // nenhum dado de origem capturado

const MOTORES_BUSCA_CONHECIDOS = ["google.", "bing.", "duckduckgo.", "yahoo."];

type EntradaParams = Record<string, string | string[] | undefined> | URLSearchParams;

function lerParam(params: EntradaParams, chave: string): string | null {
  if (params instanceof URLSearchParams) {
    return params.get(chave);
  }
  const valor = params[chave];
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

function normalizarTexto(v: string | null): string | null {
  if (v === null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function extrairHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Captura pura da origem a partir dos query params da requisição real e do
 * cabeçalho Referer (quando presente). Nunca consulta nada — quem chama
 * entrega os dados já lidos da requisição (mesmo padrão de
 * `gerarOportunidadesClientes`: função pura sobre dado já resolvido).
 */
export function capturarOrigem(params: EntradaParams, referrer: string | null, agoraISO: string): OrigemCaptada {
  return {
    utmSource:    normalizarTexto(lerParam(params, "utm_source")),
    utmMedium:    normalizarTexto(lerParam(params, "utm_medium")),
    utmCampaign:  normalizarTexto(lerParam(params, "utm_campaign")),
    utmContent:   normalizarTexto(lerParam(params, "utm_content")),
    gclid:        normalizarTexto(lerParam(params, "gclid")),
    fbclid:       normalizarTexto(lerParam(params, "fbclid")),
    referrerHost: extrairHost(referrer),
    capturadoEm:  agoraISO,
  };
}

/**
 * Classificação conservadora da marcação capturada, sem autenticar um clique
 * perante plataformas. Conflitos não escolhem um vencedor. FBCLID isolado
 * é referência, e UTM de mídia paga deve estar explícito.
 */
export function origemTemConflito(o: OrigemCaptada): boolean {
  const source = o.utmSource?.toLowerCase();
  return !!((o.gclid && (o.fbclid || ['facebook', 'instagram', 'meta', 'fb', 'ig'].includes(source || '')))
    || (o.fbclid && source === 'google'));
}

export function classificarOrigem(o: OrigemCaptada): TipoOrigem {
  const source = o.utmSource?.toLowerCase();
  const pago = ['cpc', 'ppc', 'paid', 'paid_social', 'paid_search'].includes(o.utmMedium?.toLowerCase() || '');
  const meta = ['facebook', 'instagram', 'meta', 'fb', 'ig'].includes(source || '');
  // Identificadores/UTMs são evidência capturada, não validação da plataforma.
  if (origemTemConflito(o)) return 'campanha_utm';
  if (o.gclid) return "google_ads";
  if (pago && meta) return 'meta_ads';
  if (pago && source === 'google') return 'google_ads';
  if (o.utmSource || o.utmMedium || o.utmCampaign || o.utmContent) return "campanha_utm";
  if (o.fbclid) return 'referencia';
  if (o.referrerHost && MOTORES_BUSCA_CONHECIDOS.some(m => o.referrerHost!.includes(m))) return "busca_organica";
  if (o.referrerHost) return "referencia";
  return "direto";
}

// ── Link rastreado no WhatsApp: fecha o loop sem precisar de API de Ads ────
// O clique num anúncio leva o visitante ao site público (onde a origem É
// capturável via query string); dali, o contato de fato acontece pelo
// WhatsApp — um link externo, fora do controle deste sistema. Para não
// perder a origem nessa transição, o texto pré-preenchido do WhatsApp leva
// um código curto que a conversa recebida pode devolver.

const PREFIXO_REF = "ref:";

/**
 * Adiciona o código de rastreio ao texto pré-preenchido de um link
 * `wa.me`/`api.whatsapp.com`. Nunca modifica o número/destino — só o
 * parâmetro `text`. Se `linkBase` não tiver `text`, cria um texto mínimo
 * só com a referência.
 */
export function construirLinkComRastreio(linkBase: string, codigo: string): string {
  const url = new URL(linkBase);
  const textoAtual = url.searchParams.get("text");
  const referencia = `${PREFIXO_REF}${codigo}`;
  url.searchParams.set("text", textoAtual ? `${textoAtual}\n\n${referencia}` : referencia);
  return url.toString();
}

/**
 * Extrai o código de rastreio de um texto de mensagem recebida (ex.: corpo
 * de um webhook do WhatsApp). Só reconhece o formato exato `ref:<código>`
 * — nunca adivinha a partir de texto livre do cliente. Retorna `null`
 * quando ausente, nunca uma string vazia.
 */
export function extrairCodigoRastreio(mensagemTexto: string | null | undefined): string | null {
  if (!mensagemTexto) return null;
  const match = mensagemTexto.match(/ref:([a-z0-9]{6,20})/i);
  return match ? match[1] : null;
}

// ── CAC/ROAS: só quando custo E receita atribuída são fatos reais ──────────
// Mesmo princípio de `calcularStatusPagamento` em
// lib/orcamentos-state-machine.ts: `null` quando falta o dado real, nunca
// um número fabricado. Sem custo de campanha real (API oficial de Ads ou
// lançamento manual confirmado), CAC/ROAS simplesmente não existem aqui.

/**
 * CAC em centavos. `null` quando não há custo real informado ou não há
 * nenhuma conversão para dividir (divisão por zero nunca vira Infinity).
 */
export function calcularCAC(custoCentavos: number | null, numeroConversoes: number): number | null {
  if (custoCentavos === null || custoCentavos <= 0) return null;
  if (numeroConversoes <= 0) return null;
  return Math.round(custoCentavos / numeroConversoes);
}

/**
 * ROAS como razão (ex.: 4.2 = R$4,20 retornado por R$1,00 investido).
 * `null` sem custo real. `receitaAtribuidaCentavos` pode ser 0 (campanha
 * rodou, ainda não gerou receita comprovada) — 0 é um fato, não ausência.
 */
export function calcularROAS(custoCentavos: number | null, receitaAtribuidaCentavos: number): number | null {
  if (custoCentavos === null || custoCentavos <= 0) return null;
  return receitaAtribuidaCentavos / custoCentavos;
}

// ── Persistência de origem (Fase 1 — Origem Real) ───────────────────────────
// As duas funções abaixo continuam puras (sem Supabase, sem fetch) — só a
// decisão/formato, nunca a I/O. A gravação de verdade (INSERT/UPDATE em
// `origem_captacoes`) vive em lib/origem-persistencia.ts, que usa estas
// funções em vez de reimplementar a lógica. Gerador dedicado (não
// reaproveita gerarCodigoRastreio de motor-reputacao.ts de propósito —
// são domínios diferentes: origem de lead vs. clique em avaliação; a
// separação existe para não acoplar dois conceitos que o Capitão pediu
// para nunca confundir).

/**
 * Código curto de rastreio de ORIGEM (distinto do código de rastreio de
 * avaliação em motor-reputacao.ts). Mesmo alfabeto sem ambiguidade visual.
 */
export function gerarCodigoOrigem(random: () => number = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296): string {
  const alfabeto = "23456789abcdefghjkmnpqrstuvwxyz";
  let codigo = "";
  for (let i = 0; i < 10; i++) {
    codigo += alfabeto[Math.floor(random() * alfabeto.length)];
  }
  return codigo;
}

/**
 * Idempotência do vínculo origem→paciente: só o primeiro webhook que
 * apresentar o código pode vincular. Replays/retentativas do WhatsApp não
 * revinculam nem sobrescrevem o vínculo original — mesmo princípio de
 * `podeRegistrarClique` em motor-reputacao.ts.
 */
export function podeVincularOrigem(o: { vinculadoEm: string | null }): boolean {
  return o.vinculadoEm === null;
}
