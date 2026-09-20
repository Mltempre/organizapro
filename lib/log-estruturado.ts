// Log estruturado genérico — reutilizável por qualquer rota/motor do
// OrganizaPro, não específico de orçamentos. Nunca "Erro." sozinho: sempre
// operação, clínica, entidade, resultado, motivo. Portado do utilitário
// equivalente já homologado em produção (mesmo formato, sem nenhuma
// dependência de infraestrutura específica de outro produto).

export type ResultadoOperacao = "sucesso" | "erro" | "rejeitado";

export function logOperacao(params: {
  operacao: string;
  clinica_id: string | null;
  entidade_id?: string | null;
  resultado: ResultadoOperacao;
  motivo?: string;
}) {
  const linha = {
    operacao: params.operacao,
    clinica_id: params.clinica_id,
    entidade_id: params.entidade_id ?? null,
    resultado: params.resultado,
    motivo: params.motivo ?? null,
    em: new Date().toISOString(),
  };
  const texto = `[ORGANIZAPRO] ${JSON.stringify(linha)}`;
  if (params.resultado === "erro") console.error(texto);
  else if (params.resultado === "rejeitado") console.warn(texto);
  else console.log(texto);
}
