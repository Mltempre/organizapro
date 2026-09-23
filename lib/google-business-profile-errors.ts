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
  constructor(public readonly codigo: CodigoGoogle, public readonly resultadoIncerto = false, public readonly httpGoogle?: number) {
    super(erros[codigo][1]);
  }
}
export function erroGoogle(error: unknown): ErroGoogle {
  return error instanceof ErroGoogle ? error : new ErroGoogle("INDISPONIVEL", true);
}
export function respostaErroGoogle(error: unknown) {
  const e = erroGoogle(error);
  const [estado, mensagem, status] = erros[e.codigo];
  // Nunca inclui mensagem, payload, URL, token ou stack da exceção externa.
  console.error("[GBP]", { codigo: e.codigo, httpGoogle: e.httpGoogle ?? null });
  return { status, body: { sucesso: false, estado: estado as EstadoConexaoGoogle, indisponivel: true,
    codigo: e.codigo, error: mensagem, motivo: mensagem, manterChave: e.resultadoIncerto || e.codigo === "PENDENTE" || e.codigo === "PERSISTENCIA" } };
}
