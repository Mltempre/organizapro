import "server-only";
import type { EstadoConexaoGoogle } from "./google-business-profile-resources";

const erros = {
  CONFIGURACAO: ["erro_configuracao", "Integração Google não configurada no servidor.", 503],
  PERSISTENCIA: ["indisponivel", "Persistência Google indisponível. Verifique o preparo do banco.", 503],
  DESCONECTADO: ["desconectado", "Conecte o Google para continuar.", 409],
  RENOVACAO: ["renovacao_necessaria", "A autorização Google expirou ou foi revogada. Reconecte sua conta.", 409],
  SEM_LOCAL: ["erro_recuperavel", "Nenhuma localização Google utilizável foi encontrada. Verifique o acesso ao perfil.", 409],
  RECURSO: ["erro_recuperavel", "O recurso solicitado não pertence à localização conectada.", 403],
  PAGINACAO: ["erro_recuperavel", "Não foi possível concluir a listagem Google. Tente novamente.", 502],
  GOOGLE: ["erro_recuperavel", "Google recusou a operação. Verifique as permissões do perfil.", 502],
  INDISPONIVEL: ["indisponivel", "Google temporariamente indisponível. Tente novamente mais tarde.", 503],
  RESPOSTA: ["erro_recuperavel", "Google retornou uma resposta incompatível. Operação não confirmada.", 502],
  CONFLITO: ["erro_recuperavel", "Esta chave já foi utilizada com outro conteúdo.", 409],
  PENDENTE: ["indisponivel", "Operação em andamento ou com resultado pendente de confirmação. Não repita a publicação com outra chave.", 409],
  JA_RESPONDIDA: ["erro_recuperavel", "Esta avaliação já foi respondida. Atualize a lista.", 409],
  ENTRADA: ["erro_recuperavel", "Dados da solicitação inválidos.", 400],
  OAUTH: ["erro_recuperavel", "A conexão expirou ou não pôde ser validada. Inicie novamente.", 400],
} as const;
export type CodigoGoogle = keyof typeof erros;
export class ErroGoogle extends Error {
  constructor(public readonly codigo: CodigoGoogle, public readonly resultadoIncerto = false, public readonly httpGoogle?: number,
    public readonly diagnostico?: DiagnosticoGoogle | null) {
    super(erros[codigo][1]);
  }
}
export function erroGoogle(error: unknown): ErroGoogle {
  return error instanceof ErroGoogle ? error : new ErroGoogle("INDISPONIVEL", true);
}
// ── Diagnóstico sanitizado de uma recusa do Google ─────────────────────────
// O contrato do produto nunca expõe mensagem/payload do Google nem registra
// segredo — isso está correto, mas tornava a recusa indistinguível: o log de
// produção (2026-09-25) mostrou apenas `{ codigo: 'INDISPONIVEL',
// httpGoogle: 429 }`, sem endpoint, motivo ou quota. Sem isso não é possível
// provar a causa (quota 0 = acesso à GBP API ainda não concedido ao projeto,
// limite de taxa real, API ausente/desativada ou endpoint errado). A própria
// documentação do Google (Quota limits) diz: "If your quota limit for the
// Google Business Profile API is 0, you have not yet been granted access."
// O diferenciador verificável é `details[].metadata.quota_limit_value` e
// `error.status`, nunca o texto. Por isso aqui só são extraídos campos de
// máquina (enum/métrica) e o host do endpoint. Texto livre do Google é
// registrado apenas no log do callback OAuth, já redigido de credenciais —
// ver lib/google-business-profile-oauth.ts.
export type DiagnosticoGoogle = {
  servico: string | null;
  statusGoogle: string | null;
  razao: string | null;
  quota: { metrica: string | null; limite: string | null; valor: string | null; local: string | null } | null;
  mensagem: string | null;
};

export type CausaGoogle = "ACESSO_GBP_NAO_CONCEDIDO" | "LIMITE_DE_TAXA" | "PERMISSAO" | "API_AUSENTE_OU_DESATIVADA";

const LIMITE_MENSAGEM = 240;
const LARGURA_CAMPO = 200;
// Removido antes de qualquer registro: acesso/refresh/id token, código de
// autorização e client secret, em qualquer formato que o Google devolva.
const CREDENCIAL = /(ya29\.[A-Za-z0-9._~-]+)|(\b1\/\/[A-Za-z0-9._~-]+)|(Bearer\s+[A-Za-z0-9._~-]+)|((access_token|refresh_token|id_token|client_secret|authorization)\s*[=:]\s*[^\s,;"]+)/gi;

function objeto(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function lista(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(objeto).filter((item): item is Record<string, unknown> => item !== null) : [];
}
function campo(value: unknown, limite = LARGURA_CAMPO): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const texto = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(CREDENCIAL, "[redigido]").trim();
  return texto ? texto.slice(0, limite) : null;
}

export function diagnosticoGoogle(raw: unknown, servico: string | null = null): DiagnosticoGoogle | null {
  const body = objeto(raw);
  const erro = objeto(body?.error);
  const detalhes = lista(erro?.details);
  const listaErros = lista(erro?.errors);
  const metadata = objeto(detalhes[0]?.metadata);
  const diagnostico: DiagnosticoGoogle = {
    servico,
    statusGoogle: campo(erro?.status) ?? campo(body?.status),
    razao: campo(detalhes[0]?.reason) ?? campo(listaErros[0]?.reason) ?? (typeof body?.error === "string" ? campo(body.error) : null),
    quota: metadata ? { metrica: campo(metadata.quota_metric), limite: campo(metadata.quota_limit),
      valor: campo(metadata.quota_limit_value), local: campo(metadata.quota_location) } : null,
    mensagem: campo(erro?.message, LIMITE_MENSAGEM),
  };
  const vazio = !diagnostico.servico && !diagnostico.statusGoogle && !diagnostico.razao && !diagnostico.quota && !diagnostico.mensagem;
  return vazio ? null : diagnostico;
}

/**
 * Traduz o diagnóstico em uma causa única e verificável. `quota.valor === "0"`
 * vem antes de qualquer outro critério porque um 429 de quota zero chega com
 * `reason: RATE_LIMIT_EXCEEDED` — igual a um limite de taxa legítimo. Sem o
 * valor explícito da quota, nenhum 429 é classificado como limite de taxa.
 */
export function classificarDiagnosticoGoogle(diagnostico?: DiagnosticoGoogle | null): CausaGoogle | null {
  if (!diagnostico) return null;
  if (diagnostico.quota?.valor === "0") return "ACESSO_GBP_NAO_CONCEDIDO";
  if (diagnostico.statusGoogle === "RESOURCE_EXHAUSTED" || diagnostico.razao === "RATE_LIMIT_EXCEEDED") return "LIMITE_DE_TAXA";
  if (diagnostico.statusGoogle === "PERMISSION_DENIED" || diagnostico.razao === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") return "PERMISSAO";
  if (diagnostico.razao === "SERVICE_DISABLED" || diagnostico.razao === "API_NOT_ACTIVATED") return "API_AUSENTE_OU_DESATIVADA";
  return null;
}

// Projeção para o log do contrato do produto: nunca inclui `mensagem`
// (texto externo livre) — só campos de máquina e a causa derivada.
export function diagnosticoSeguro(diagnostico?: DiagnosticoGoogle | null) {
  if (!diagnostico) return {};
  const causa = classificarDiagnosticoGoogle(diagnostico);
  return { servico: diagnostico.servico, statusGoogle: diagnostico.statusGoogle, razao: diagnostico.razao,
    quota: diagnostico.quota, ...(causa ? { causa } : {}) };
}

export function respostaErroGoogle(error: unknown) {
  const e = erroGoogle(error);
  const [estado, mensagem, status] = erros[e.codigo];
  // Nunca inclui mensagem, payload, URL, token ou stack da exceção externa;
  // só campos de máquina do diagnóstico (serviço/status/razão/quota/causa).
  console.error("[GBP]", { codigo: e.codigo, httpGoogle: e.httpGoogle ?? null, ...diagnosticoSeguro(e.diagnostico) });
  return { status, body: { sucesso: false, estado: estado as EstadoConexaoGoogle, indisponivel: true,
    codigo: e.codigo, error: mensagem, motivo: mensagem, manterChave: e.resultadoIncerto || e.codigo === "PENDENTE" || e.codigo === "PERSISTENCIA" } };
}
