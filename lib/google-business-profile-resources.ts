// Contratos de recursos: v1/Performance usam location; reviews/posts v4 usam parent.
export function recursoGoogle(account: string, location: string) {
  if (!/^accounts\/[A-Za-z0-9_-]+$/.test(account)) throw new Error("Conta Google inválida");
  const local = location.startsWith(`${account}/`) ? location.slice(account.length + 1) : location;
  if (!/^locations\/[A-Za-z0-9_-]+$/.test(local)) throw new Error("Localização Google inválida");
  return { account, location: local, parent: `${account}/${local}` };
}

export function recursoAvaliacao(parent: string, reviewId: string): string {
  if (!/^accounts\/[A-Za-z0-9_-]+\/locations\/[A-Za-z0-9_-]+$/.test(parent)
    || !/^[A-Za-z0-9_-]+={0,2}$/.test(reviewId)) throw new Error("Avaliação Google inválida");
  return `${parent}/reviews/${reviewId}`;
}

export type EstadoConexaoGoogle = "conectado" | "desconectado" | "renovacao_necessaria" | "indisponivel" | "erro_recuperavel" | "erro_configuracao";
