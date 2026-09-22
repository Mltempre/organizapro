// ── Onboarding — Provisionamento de Negócio V1 (P1.1: Fechar a Casa) ────
// Resolve a causa raiz confirmada pela auditoria funcional (7dd307d):
// zero provisionamento self-service de clinicas/clinica_usuarios existe
// no código — todo vínculo hoje é 100% manual/externo (confirmado por
// grep exaustivo: nenhum INSERT em clinica_usuarios em app/ ou lib/).
// Isso deixa Receita Perdida, Previsor de Faturamento, Linha Econômica,
// Google Presença e a Home (blank) visualmente bloqueados pela mesma
// causa quando o vínculo simplesmente não foi criado a tempo.
//
// Domínio puro (sem DB/HTTP): decide SE um usuário pode se
// auto-provisionar, nunca decide por fallback inseguro — um vínculo
// existente para outro produto (clinicaflow) ou inativo NUNCA é
// reaproveitado/reativado automaticamente (mesma regra de isolamento de
// ambientes já usada noutras missões: nunca repurpose um recurso
// dormente existente). Esse caso sempre bloqueia e pede suporte humano.
export type VinculoExistente = { ativo: boolean; produtoClinica: string | null } | null;

export type DecisaoProvisionamento =
  | { acao: "criar" }
  | { acao: "reaproveitar_existente" } // idempotente: já vinculado ao organizapro e ativo — nunca cria um segundo negócio
  | { acao: "bloqueado"; motivo: string };

export function decidirProvisionamento(vinculo: VinculoExistente, nome: string | null | undefined): DecisaoProvisionamento {
  if (vinculo !== null) {
    if (vinculo.ativo && vinculo.produtoClinica === "organizapro") {
      return { acao: "reaproveitar_existente" };
    }
    // Vínculo existente mas inativo, ou para outro produto (clinicaflow):
    // fail-closed — nunca reativa nem reatribui produto sozinho.
    return { acao: "bloqueado", motivo: "Você já tem um vínculo existente que não pode ser reaproveitado automaticamente. Fale com o suporte." };
  }

  const nomeLimpo = (nome ?? "").trim();
  if (nomeLimpo.length < 2) {
    return { acao: "bloqueado", motivo: "Informe o nome do seu negócio (mínimo 2 caracteres)." };
  }
  if (nomeLimpo.length > 120) {
    return { acao: "bloqueado", motivo: "Nome do negócio muito longo (máximo 120 caracteres)." };
  }
  return { acao: "criar" };
}
