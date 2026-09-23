// ── Contador IA · Fechamento Inteligente V1 ──────────────────────────────
// Responde: "quais clientes ainda não estão prontos para o fechamento do
// mês, exatamente o que falta de cada um, e quem já está pronto?" Domínio
// puro (sem DB/HTTP), mesma filosofia de lib/linha-economica.ts e
// lib/receita-perdida.ts: nenhuma consulta aqui, nenhum número fabricado —
// tudo entra por parâmetro, já carregado por quem chama.
//
// ── Auditoria prévia (o que já existia e foi reaproveitado) ─────────────
// - "Cliente" = public.pacientes, a mesma entidade usada em todo o
//   produto — nenhuma tabela de cliente nova.
// - Isolamento por clinica_id = lib/auth-clinica.ts (autorizarUsuarioNaClinica).
// - eventos_dominio continua só como trilha de auditoria, nunca a fonte
//   do estado — mesmo padrão de orcamentos/tratamentos/cobrancas/pedidos.
// - Cobrança reaproveita 100% o WhatsApp Governado (lib/whatsapp-governado.ts)
//   e o adaptador real (POST /api/whatsapp) — nenhum motor de envio novo.
// - Auditoria da decisão de cobrar reaproveita lib/auditoria-decisoes.ts
//   (motor "fechamento-contabil" registrado ali, mesmo padrão de
//   "cobrador-digital"/"follow-up-comercial") — nenhuma estrutura de
//   auditoria paralela.
// - NÃO alimenta SinalCanonico/Radar/Missão do Dia/Diretor Digital/Gerente
//   Comercial: pendência de documento contábil é uma categoria operacional
//   diferente de oportunidade comercial — misturar infla o Radar comercial
//   com itens de outra natureza. Decisão deliberada, não uma lacuna.
//
// ── V2 (continuação): fluxo operacional completo ─────────────────────────
// - REVISÃO NECESSÁRIA: 4º status de documento e de cliente. Nunca dá baixa
//   automática num documento que a identificação (lib/fechamento-
//   identificacao.ts) não conseguiu classificar com confiança alta —
//   precedência: invalido > revisao_necessaria > pendente > pronto.
// - Exceções por cliente (fechamento_excecoes_cliente): PADRÃO DA CLÍNICA +
//   EXCEÇÕES DO CLIENTE, nunca uma configuração paralela duplicada por
//   cliente — um cliente sem nenhuma exceção usa exatamente o padrão.
// - pendenciasCobraveis: só 'pendente'/'invalido' (o CLIENTE precisa agir);
//   'revisao_necessaria' nunca aparece numa cobrança (quem precisa agir
//   ali é o contador, revisando a identificação — cobrar o cliente de novo
//   seria pedir um documento que ele JÁ enviou).

export type StatusDocumento = "pendente" | "recebido" | "invalido" | "revisao_necessaria";
export type StatusFechamento = "pronto" | "pendente" | "bloqueado" | "revisao_necessaria";

export type TipoDocumentoConfig = {
  nome: string;
  obrigatorio: boolean;
  ativo: boolean;
};

export type ClienteParaFechamento = {
  id: string;
  nome: string;
};

export type ExcecaoClienteConfig = {
  clienteId: string;
  tipoDocumento: string;
  incluido: boolean; // true: força incluir mesmo se não for padrão da clínica; false: força excluir mesmo sendo padrão
};

export type DocumentoRegistrado = {
  clienteId: string;
  tipoDocumento: string;
  status: StatusDocumento;
  atualizadoEm?: string | null; // ISO — usado só para exibir "última atualização", nunca para decidir status
};

export type ItemChecklist = {
  tipoDocumento: string;
  status: StatusDocumento;
  atualizadoEm: string | null;
};

export type ResumoClienteFechamento = {
  clienteId: string;
  nome: string;
  percentual: number; // 0-100, arredondado — nunca fracionário na UI
  status: StatusFechamento;
  checklist: ItemChecklist[];
  faltando: string[]; // status 'pendente' — nunca inclui um item já 'recebido'
  invalidos: string[]; // status 'invalido' — bloqueiam o fechamento
  emRevisao: string[]; // status 'revisao_necessaria' — nunca cobrados do cliente
  ultimaAtualizacao: string | null; // maior atualizadoEm entre os itens do checklist, ou null
  proximaAcao: string; // frase curta e real, nunca genérica quando há algo concreto a fazer
};

export type ResumoFechamento = {
  competencia: string;
  prontos: number;
  pendentes: number;
  bloqueados: number;
  emRevisao: number;
  clientes: ResumoClienteFechamento[];
};

/** Formato único aceito para competência: AAAA-MM. Nunca uma data completa
 * (que confundiria mês de emissão do documento com mês de referência). */
export function competenciaValida(competencia: string): boolean {
  return /^\d{4}-\d{2}$/.test(competencia);
}

/**
 * Nomes efetivamente exigidos de UM cliente: padrão da clínica (tipos
 * ativos+obrigatórios) com as exceções DESSE cliente aplicadas por cima —
 * nunca uma configuração paralela duplicada por cliente. incluido:true
 * força a entrada mesmo que o tipo não seja padrão (ou esteja inativo/
 * opcional na clínica); incluido:false remove mesmo sendo padrão. Exportada
 * para a rota de upload usar o MESMO conjunto de tipos "conhecidos" na
 * identificação — nunca uma segunda lista divergente.
 */
export function nomesEfetivos(
  clienteId: string,
  tiposObrigatorios: TipoDocumentoConfig[],
  excecoes: ExcecaoClienteConfig[]
): string[] {
  const efetivos = new Set(tiposObrigatorios.filter((t) => t.ativo && t.obrigatorio).map((t) => t.nome));
  for (const e of excecoes.filter((e) => e.clienteId === clienteId)) {
    if (e.incluido) efetivos.add(e.tipoDocumento);
    else efetivos.delete(e.tipoDocumento);
  }
  return [...efetivos];
}

function gerarProximaAcao(invalidos: string[], emRevisao: string[], faltando: string[]): string {
  if (invalidos.length > 0) return `Solicitar reenvio: ${invalidos.join(", ")}`;
  if (emRevisao.length > 0) return `Revisar identificação: ${emRevisao.join(", ")}`;
  if (faltando.length > 0) return `Cobrar: ${faltando.join(", ")}`;
  return "Nenhuma — pronto para fechamento";
}

/**
 * Calcula a prontidão de UM cliente para UMA competência. Ausência de
 * registro para um tipo obrigatório é sempre tratada como 'pendente' —
 * nunca fabrica um "recebido" por omissão (Princípio da Transparência,
 * mesma regra de lib/nucleo-inteligente.ts).
 *
 * Precedência de status: invalido > revisao_necessaria > pendente > pronto.
 * Um documento em revisão nunca é tratado como resolvido nem como bloqueio
 * definitivo — é um estado à parte, que exige o contador (não o cliente).
 */
export function calcularFechamentoCliente(
  cliente: ClienteParaFechamento,
  tiposObrigatorios: TipoDocumentoConfig[],
  documentos: DocumentoRegistrado[],
  excecoes: ExcecaoClienteConfig[] = []
): ResumoClienteFechamento {
  const nomes = nomesEfetivos(cliente.id, tiposObrigatorios, excecoes);
  const porTipo = new Map(
    documentos.filter((d) => d.clienteId === cliente.id).map((d) => [d.tipoDocumento, d])
  );

  const checklist: ItemChecklist[] = nomes.map((nome) => {
    const doc = porTipo.get(nome);
    return { tipoDocumento: nome, status: doc?.status ?? "pendente", atualizadoEm: doc?.atualizadoEm ?? null };
  });

  const faltando = checklist.filter((i) => i.status === "pendente").map((i) => i.tipoDocumento);
  const invalidos = checklist.filter((i) => i.status === "invalido").map((i) => i.tipoDocumento);
  const emRevisao = checklist.filter((i) => i.status === "revisao_necessaria").map((i) => i.tipoDocumento);
  const recebidos = checklist.filter((i) => i.status === "recebido").length;
  const total = checklist.length;
  const percentual = total === 0 ? 0 : Math.round((recebidos / total) * 100);

  const status: StatusFechamento =
    invalidos.length > 0 ? "bloqueado"
    : emRevisao.length > 0 ? "revisao_necessaria"
    : total > 0 && recebidos === total ? "pronto"
    : "pendente";

  const ultimaAtualizacao = checklist
    .map((i) => i.atualizadoEm)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1) ?? null;

  return {
    clienteId: cliente.id, nome: cliente.nome, percentual, status, checklist,
    faltando, invalidos, emRevisao, ultimaAtualizacao,
    proximaAcao: gerarProximaAcao(invalidos, emRevisao, faltando),
  };
}

/**
 * Gera o resumo agregado (PRONTOS/PENDENTES/BLOQUEADOS/EM REVISÃO) de uma
 * competência para todos os clientes ativos — determinístico, sem I/O.
 */
export function gerarResumoFechamento(
  competencia: string,
  clientes: ClienteParaFechamento[],
  tiposObrigatorios: TipoDocumentoConfig[],
  documentos: DocumentoRegistrado[],
  excecoes: ExcecaoClienteConfig[] = []
): ResumoFechamento {
  const clientesResumo = clientes
    .map((c) => calcularFechamentoCliente(c, tiposObrigatorios, documentos, excecoes))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return {
    competencia,
    prontos: clientesResumo.filter((c) => c.status === "pronto").length,
    pendentes: clientesResumo.filter((c) => c.status === "pendente").length,
    bloqueados: clientesResumo.filter((c) => c.status === "bloqueado").length,
    emRevisao: clientesResumo.filter((c) => c.status === "revisao_necessaria").length,
    clientes: clientesResumo,
  };
}

/**
 * Documentos que ainda podem ser cobrados DO CLIENTE — nunca inclui um
 * item 'recebido' (já resolvido, nunca relembrado) nem 'revisao_necessaria'
 * (o cliente já enviou algo; quem precisa agir é o contador, revisando a
 * identificação — cobrar de novo pediria um documento que já chegou).
 */
export function pendenciasCobraveis(checklist: ItemChecklist[]): string[] {
  return checklist.filter((i) => i.status === "pendente" || i.status === "invalido").map((i) => i.tipoDocumento);
}

/**
 * Mensagem de cobrança determinística — cita SOMENTE o que ainda falta
 * (nunca reafirma um documento já recebido). Mesmo estilo já usado por
 * lib/follow-up-comercial.ts/lib/motor-cobranca.ts (template fixo, nunca
 * texto gerado por modelo).
 */
export function gerarMensagemCobrancaFechamento(
  nomeCliente: string,
  competencia: string,
  pendencias: string[]
): string {
  const [ano, mes] = competencia.split("-");
  const nomesMes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const mesLabel = nomesMes[Number(mes) - 1] ?? competencia;
  return `Olá, ${nomeCliente}! Para fechar ${mesLabel} de ${ano}, falta somente: ${pendencias.join(", ")}.`;
}
