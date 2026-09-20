import assert from "node:assert/strict";

const preparar = (cobranca) => {
  const valor = cobranca.valor_pago === null || cobranca.valor_pago === "" ? null : Number(cobranca.valor_pago);
  const pendencias = [];
  if (!cobranca.paciente_nome?.trim()) pendencias.push("cliente não identificado");
  if (!cobranca.descricao?.trim()) pendencias.push("descrição do serviço ou produto ausente");
  if (valor === null || !Number.isFinite(valor)) pendencias.push("valor efetivamente pago ausente");
  if (!cobranca.pago_em) pendencias.push("data do pagamento ausente");
  pendencias.push("CPF/CNPJ e endereço do cliente não estão disponíveis no cadastro atual");
  pendencias.push("dados fiscais do emitente e classificação do serviço devem ser confirmados externamente");
  return {
    status: pendencias.length === 2 ? "pronta_para_preparacao" : "pendente_preparacao",
    valor: Number.isFinite(valor) ? valor : null,
    pendencias,
  };
};

const completa = preparar({ paciente_nome: "Ana", descricao: "Consulta", valor_pago: "180.00", pago_em: "2026-09-20T10:00:00Z" });
assert.equal(completa.status, "pronta_para_preparacao");
assert.equal(completa.valor, 180);
assert.equal(completa.pendencias.length, 2);

const incompleta = preparar({ paciente_nome: "", descricao: null, valor_pago: null, pago_em: null });
assert.equal(incompleta.status, "pendente_preparacao");
assert.equal(incompleta.valor, null);
assert.equal(incompleta.pendencias.length, 6);

console.log("notafacil-inteligente: 6 assertions OK");