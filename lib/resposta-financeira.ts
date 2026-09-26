// As APIs financeiras retornam listas, inclusive quando vazias. HTTP de erro,
// JSON inválido ou ausência da lista não representam ausência de registros.
export async function lerRespostaFinanceira(resposta: Response, campo: string) {
  if (!resposta.ok) throw new Error('Não foi possível carregar os dados financeiros.');
  const dado = await resposta.json();
  if (!dado || !Array.isArray(dado[campo])) {
    throw new Error('Resposta financeira inválida.');
  }
  return dado;
}
