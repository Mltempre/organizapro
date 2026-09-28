import "server-only";

// ── Meta Ads V1 — chamadas de LEITURA à Graph API (somente servidor) ───────
// Nenhum token aparece em mensagem de erro ou log: ErroMeta carrega apenas o
// código classificado (PERMISSAO/REDE/CONFIG). URLs com access_token nunca
// são registradas. Criação/edição de campanhas NÃO existe aqui (ads_management
// + App Review — dependência externa declarada, fora do V1).
import { META_GRAPH_VERSION } from "./meta-ads";
import type { CampanhaMeta } from "./meta-ads-metricas";

const GRAFO = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export class ErroMeta extends Error {
  readonly codigo: "PERMISSAO" | "REDE" | "CONFIG";
  constructor(codigo: "PERMISSAO" | "REDE" | "CONFIG") {
    super(codigo);
    this.name = "ErroMeta";
    this.codigo = codigo;
  }
}

type CorpoGrafo = Record<string, unknown>;

async function getGrafo(url: string): Promise<CorpoGrafo> {
  let resposta: Response;
  try {
    resposta = await fetch(url, { cache: "no-store" });
  } catch {
    throw new ErroMeta("REDE");
  }
  let corpo: CorpoGrafo | null = null;
  try {
    corpo = (await resposta.json()) as CorpoGrafo;
  } catch {
    corpo = null;
  }
  const erro = corpo && typeof corpo === "object" ? (corpo as { error?: { code?: unknown; message?: unknown } }).error : undefined;
  if (!resposta.ok || erro) {
    const codigo = Number(erro?.code ?? 0);
    const texto = String(erro?.message ?? "");
    const ehPermissao = codigo === 200 || codigo === 10 || /permission|not authorized|ads_read/i.test(texto);
    throw new ErroMeta(ehPermissao ? "PERMISSAO" : "REDE");
  }
  return corpo ?? {};
}

function comToken(caminho: string, params: Record<string, string>, token: string): string {
  const url = new URL(`${GRAFO}/${caminho}`);
  const busca = new URLSearchParams(params);
  // Endpoints de troca de token (oauth/access_token) não recebem
  // access_token; só as leituras de dados o incluem.
  if (token) busca.set("access_token", token);
  url.search = busca.toString();
  return String(url);
}

/** Guarda de forma: conta de anúncios só no formato act_<dígitos> — defesa
 *  extra antes de qualquer interpolação em caminho de URL. */
function contaValida(contaId: string): string {
  if (!/^act_\d+$/.test(contaId)) throw new ErroMeta("CONFIG");
  return contaId;
}

/** Fluxo server-side: code → access token persistente (oficial). */
export async function trocarCodigoMeta(code: string, redirect: string, cfg: { appId: string; appSecret: string }): Promise<string> {
  const corpo = await getGrafo(comToken("oauth/access_token", {
    client_id: cfg.appId,
    redirect_uri: redirect,
    client_secret: cfg.appSecret,
    code,
  }, ""));
  const token = corpo.access_token;
  if (typeof token !== "string" || !token) throw new ErroMeta("REDE");
  return token;
}

/** Troca por long-lived (~60 dias, conforme documentação oficial). Melhor
 *  esforço: se a troca falhar, o token persistente do fluxo server-side é
 *  mantido — nunca derruba a conexão por causa da extensão. */
export async function estenderTokenMeta(token: string, cfg: { appId: string; appSecret: string }): Promise<string> {
  try {
    const corpo = await getGrafo(comToken("oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: token,
    }, ""));
    return typeof corpo.access_token === "string" && corpo.access_token ? corpo.access_token : token;
  } catch {
    return token;
  }
}

export type ContaAdsMeta = { id: string; nome: string | null; ativa: boolean; moeda: string | null };

/** Lista contas de anúncios acessíveis ao usuário autorizador (ads_read). */
export async function listarContasMeta(token: string): Promise<ContaAdsMeta[]> {
  const corpo = await getGrafo(comToken("me/adaccounts", {
    fields: "id,account_id,name,account_status,currency",
    limit: "50",
  }, token));
  const dados = Array.isArray(corpo.data) ? (corpo.data as Array<Record<string, unknown>>) : [];
  const contas: ContaAdsMeta[] = [];
  for (const linha of dados) {
    const idBruto = typeof linha.id === "string" ? linha.id : "";
    const numerico = typeof linha.account_id === "string" ? linha.account_id : "";
    const id = idBruto.startsWith("act_") ? idBruto : numerico ? `act_${numerico}` : idBruto;
    if (!/^act_\d+$/.test(id)) continue;
    contas.push({
      id,
      nome: typeof linha.name === "string" ? linha.name : null,
      ativa: Number(linha.account_status) === 1,
      moeda: typeof linha.currency === "string" ? linha.currency : null,
    });
  }
  return contas;
}

/** Campanhas da conta (id, nome, status) — leitura, nunca escrita. */
export async function listarCampanhasMeta(contaId: string, token: string): Promise<CampanhaMeta[]> {
  const corpo = await getGrafo(comToken(`${contaValida(contaId)}/campaigns`, {
    fields: "id,name,status,effective_status",
    limit: "100",
  }, token));
  const dados = Array.isArray(corpo.data) ? (corpo.data as Array<Record<string, unknown>>) : [];
  return dados
    .filter((linha): linha is Record<string, unknown> & { id: string } => typeof linha.id === "string" && !!linha.id)
    .map((linha) => ({
      id: linha.id,
      nome: typeof linha.name === "string" ? linha.name : null,
      status: typeof linha.effective_status === "string" && linha.effective_status
        ? linha.effective_status
        : typeof linha.status === "string" ? linha.status : null,
    }));
}

/** Insights por campanha do período (spend/impressions/reach/clicks/ctr) —
 *  exatamente as métricas de negócio pedidas; nenhum dado além do que a API
 *  oficial devolve. */
export async function listarInsightsMeta(contaId: string, token: string, periodo: string): Promise<Array<Record<string, unknown>>> {
  const corpo = await getGrafo(comToken(`${contaValida(contaId)}/insights`, {
    fields: "campaign_id,campaign_name,spend,impressions,reach,clicks,ctr",
    date_preset: periodo,
    level: "campaign",
    limit: "100",
  }, token));
  return Array.isArray(corpo.data) ? (corpo.data as Array<Record<string, unknown>>) : [];
}