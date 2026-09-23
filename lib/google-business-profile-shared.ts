// ── Prompt para a resposta sugerida — reaproveita /api/ia existente ────
// Nunca cria uma segunda chamada de IA: o texto abaixo é o PROMPT que a
// TELA envia para o já existente /api/ia (mesmo endpoint de app/conteudo/
// page.tsx), nunca uma chamada nova ao OpenAI feita daqui.

export type DadosAvaliacaoParaPrompt = {
  nomeEmpresa: string;
  nota: number; // 1-5, real, do Google
  comentario: string | null; // texto real do cliente, ou null quando a avaliação não tem comentário (só nota)
};

/**
 * Monta o prompt determinístico para /api/ia — nunca inclui um fato que
 * não veio da avaliação real (nunca inventa produto/atendimento/entrega
 * específicos), nunca instrui a admitir culpa/responsabilidade jurídica,
 * nunca instrui a oferecer desconto/reembolso/promessa.
 */
export function montarPromptRespostaAvaliacao(dados: DadosAvaliacaoParaPrompt): string {
  const comentarioTexto = dados.comentario && dados.comentario.trim()
    ? `O comentário do cliente foi: "${dados.comentario.trim()}"`
    : "O cliente não deixou comentário, só a nota.";
  return [
    `Escreva uma resposta profissional e cordial, em português do Brasil, para uma avaliação do Google recebida pela empresa "${dados.nomeEmpresa}".`,
    `A nota dada foi ${dados.nota} de 5 estrelas. ${comentarioTexto}`,
    "Regras obrigatórias: nunca invente detalhes sobre a compra, atendimento, entrega ou produto que não estejam no comentário acima.",
    "Nunca admita culpa ou responsabilidade jurídica. Nunca ofereça desconto, reembolso, indenização ou qualquer promessa.",
    "Se a nota for baixa, agradeça o retorno e convide a pessoa a entrar em contato diretamente para resolver, sem prometer nada específico.",
    "Responda só com o texto da resposta, sem aspas, sem explicações, com no máximo 3 frases.",
  ].join(" ");
}
