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
// - Isolamento por clinica_id = lib/auth-clinica.ts (autorizarUsuarioNaClinica),
//   mesmo padrão de toda API do produto — nenhuma checagem nova.
// - eventos_dominio continua só como trilha de auditoria (quem mudou o
//   quê, quando) sobre o estado real, nunca como a própria fonte do
//   estado — mesmo padrão de orcamentos/tratamentos/cobrancas/pedidos.
// - NÃO alimenta SinalCanonico/Radar/Missão do Dia/Diretor Digital:
//   pendência de documento contábil é uma categoria diferente de
//   "oportunidade comercial" (orçamento parado, cobrança atrasada) — misturar
//   os dois inflaria o Radar comercial com itens de natureza operacional
//   distinta. Decisão deliberada, não uma lacuna.
//
// ── O que realmente faltava (o único "coração novo" desta missão) ───────
// Nenhuma estrutura existente representava "checklist de documentos
// obrigatórios, por cliente, por competência (mês/ano), com estado
// pendente/recebido/inválido e prontidão calculada". Este arquivo + duas
// tabelas novas (fechamento_tipos_documento, fechamento_documentos) são
// esse gap, e nada além dele.

export type StatusDocumento = "pendente" | "recebido" | "invalido";
export type StatusFechamento = "pronto" | "pendente" | "bloqueado";

export type TipoDocumentoConfig = {
  nome: string;
  obrigatorio: boolean;
  ativo: boolean;
};

export type ClienteParaFechamento = {
  id: string;
  nome: string;
};

export type DocumentoRegistrado = {
  clienteId: string;
  tipoDocumento: string;
  status: StatusDocumento;
};

export type ItemChecklist = {
  tipoDocumento: string;
  status: StatusDocumento;
};

export type ResumoClienteFechamento = {
  clienteId: string;
  nome: string;
  percentual: number; // 0-100, arredondado — nunca fracionário na UI
  status: StatusFechamento;
  checklist: ItemChecklist[];
  faltando: string[]; // tipos ainda pendentes — nunca inclui um item já 'recebido'
  invalidos: string[]; // tipos marcados inválidos — bloqueiam o fechamento
};

export type ResumoFechamento = {
  competencia: string;
  prontos: number;
  pendentes: number;
  bloqueados: number;
  clientes: ResumoClienteFechamento[];
};

/** Formato único aceito para competência: AAAA-MM. Nunca uma data completa
 * (que confundiria mês de emissão do documento com mês de referência). */
export function competenciaValida(competencia: string): boolean {
  return /^\d{4}-\d{2}$/.test(competencia);
}

/**
 * Calcula a prontidão de UM cliente para UMA competência. Ausência de
 * registro para um tipo obrigatório é sempre tratada como 'pendente' —
 * nunca fabrica um "recebido" por omissão (Princípio da Transparência,
 * mesma regra de lib/nucleo-inteligente.ts).
 *
 * Regra de status:
 * - Qualquer item 'invalido' -> BLOQUEADO (precisa de novo envio, nunca
 *   "quase pronto").
 * - Sem inválidos e todos os obrigatórios 'recebido' -> PRONTO.
 * - Caso contrário -> PENDENTE (inclui o caso de zero tipos configurados
 *   — sinaliza falta de configuração, nunca "pronto" vazio por acidente).
 */
export function calcularFechamentoCliente(
  cliente: ClienteParaFechamento,
  tiposObrigatorios: TipoDocumentoConfig[],
  documentos: DocumentoRegistrado[]
): ResumoClienteFechamento {
  const tiposAtivos = tiposObrigatorios.filter((t) => t.ativo && t.obrigatorio);
  const statusPorTipo = new Map(
    documentos.filter((d) => d.clienteId === cliente.id).map((d) => [d.tipoDocumento, d.status])
  );

  const checklist: ItemChecklist[] = tiposAtivos.map((t) => ({
    tipoDocumento: t.nome,
    status: statusPorTipo.get(t.nome) ?? "pendente",
  }));

  const faltando = checklist.filter((i) => i.status === "pendente").map((i) => i.tipoDocumento);
  const invalidos = checklist.filter((i) => i.status === "invalido").map((i) => i.tipoDocumento);
  const recebidos = checklist.filter((i) => i.status === "recebido").length;
  const total = checklist.length;
  const percentual = total === 0 ? 0 : Math.round((recebidos / total) * 100);

  const status: StatusFechamento =
    invalidos.length > 0 ? "bloqueado" : total > 0 && recebidos === total ? "pronto" : "pendente";

  return { clienteId: cliente.id, nome: cliente.nome, percentual, status, checklist, faltando, invalidos };
}

/**
 * Gera o resumo agregado (PRONTOS/PENDENTES/BLOQUEADOS) de uma competência
 * para todos os clientes ativos — mesma filosofia de gerarLinhaEconomica:
 * determinístico, sem I/O, sem aleatoriedade.
 */
export function gerarResumoFechamento(
  competencia: string,
  clientes: ClienteParaFechamento[],
  tiposObrigatorios: TipoDocumentoConfig[],
  documentos: DocumentoRegistrado[]
): ResumoFechamento {
  const clientesResumo = clientes
    .map((c) => calcularFechamentoCliente(c, tiposObrigatorios, documentos))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return {
    competencia,
    prontos: clientesResumo.filter((c) => c.status === "pronto").length,
    pendentes: clientesResumo.filter((c) => c.status === "pendente").length,
    bloqueados: clientesResumo.filter((c) => c.status === "bloqueado").length,
    clientes: clientesResumo,
  };
}
