export type NotaFacilStatus = "pendente_preparacao" | "pronta_para_preparacao";

export type NotaFacilOperacao = {
  id: string;
  origem: "cobranca";
  origemId: string;
  cliente: string | null;
  clienteId: string | null;
  descricao: string | null;
  valor: number | null;
  data: string | null;
  status: NotaFacilStatus;
  pendencias: string[];
  evidencias: string[];
};

export type NotaFacilCobranca = {
  id: string;
  paciente_id: string | null;
  paciente_nome: string | null;
  descricao: string | null;
  valor: number | string | null;
  valor_pago: number | string | null;
  pago_em: string | null;
};

function numeroValido(valor: number | string | null): number | null {
  if (valor === null || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function prepararCobrancaPaga(cobranca: NotaFacilCobranca): NotaFacilOperacao {
  const valor = numeroValido(cobranca.valor_pago);
  const pendencias: string[] = [];

  if (!cobranca.paciente_nome?.trim()) pendencias.push("cliente não identificado");
  if (!cobranca.descricao?.trim()) pendencias.push("descrição do serviço ou produto ausente");
  if (valor === null) pendencias.push("valor efetivamente pago ausente");
  if (!cobranca.pago_em) pendencias.push("data do pagamento ausente");
  pendencias.push("CPF/CNPJ e endereço do cliente não estão disponíveis no cadastro atual");
  pendencias.push("dados fiscais do emitente e classificação do serviço devem ser confirmados externamente");

  const prontaParaPreparacao = pendencias.length === 2;

  return {
    id: `cobranca:${cobranca.id}`,
    origem: "cobranca",
    origemId: cobranca.id,
    cliente: cobranca.paciente_nome?.trim() || null,
    clienteId: cobranca.paciente_id,
    descricao: cobranca.descricao?.trim() || null,
    valor,
    data: cobranca.pago_em,
    status: prontaParaPreparacao ? "pronta_para_preparacao" : "pendente_preparacao",
    pendencias,
    evidencias: [
      "origem=cobranca",
      "status=pago",
      `valor_pago=${valor === null ? "ausente" : valor}`,
      `pago_em=${cobranca.pago_em ?? "ausente"}`,
    ],
  };
}

export function ordenarOperacoes(operacoes: NotaFacilOperacao[]): NotaFacilOperacao[] {
  return [...operacoes].sort((a, b) =>
    (b.data ?? "").localeCompare(a.data ?? "") || a.id.localeCompare(b.id),
  );
}