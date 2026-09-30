// ── Navegação "← Voltar" do OrganizaPro — regra pura ──────────────────────
// Histórico de navegação INTERNA do sistema (renderizado uma única vez pelo
// shell persistente, app/components/AdminShellFrame.tsx). Sem React, sem
// DOM: só decide PARA ONDE voltar.
//
// Regra:
//   - cada tela interna aberta nesta aba entra numa pilha (sessionStorage —
//     sobrevive a recarregamento e a links <a> comuns);
//   - cada clique em "← Voltar" volta exatamente UM passo dessa sequência;
//     voltar não empilha, então cliques seguidos percorrem o caminho de trás
//     para frente, sem pular etapas;
//   - sem histórico interno não há destino (nenhum destino fixo ou "pai");
//   - nunca sai do OrganizaPro: só aceita caminho interno ("/...") de tela
//     com shell; não depende do histórico do navegador.

export const CHAVE_PILHA = "organizapro:voltar:pilha";
export const CHAVE_ATUAL = "organizapro:voltar:atual";
export const CHAVE_VOLTANDO = "organizapro:voltar:voltando";
export const LIMITE_PILHA = 50;

export function caminhoDe(rota: string): string {
  const i = rota.search(/[?#]/);
  return i === -1 ? rota : rota.slice(0, i);
}

function casaPrefixo(caminho: string, rota: string): boolean {
  return caminho === rota || caminho.startsWith(rota + "/");
}

/** Só caminhos internos, relativos à raiz, de telas que usam o shell. */
export function rotaInternaValida(rota: unknown, rotasShell: readonly string[]): rota is string {
  if (typeof rota !== "string" || rota.length > 600) return false;
  if (!rota.startsWith("/") || rota.startsWith("//") || rota.includes("\\")) return false;
  const caminho = caminhoDe(rota);
  return rotasShell.some(r => casaPrefixo(caminho, r));
}

/** Registra a tela anterior ao mudar de tela (não registra ao voltar pelo botão). */
export function registrarVisita(pilha: string[], anterior: string | null, atual: string, rotasShell: readonly string[]): string[] {
  if (!anterior || !rotaInternaValida(anterior, rotasShell)) return pilha;
  if (caminhoDe(anterior) === caminhoDe(atual)) return pilha;
  const base = pilha.length && caminhoDe(pilha[pilha.length - 1]) === caminhoDe(anterior) ? pilha.slice(0, -1) : pilha;
  return [...base, anterior].slice(-LIMITE_PILHA);
}

/** Um passo para trás: a tela anterior e a pilha depois de voltar. Sem histórico → destino null. */
export function destinoVoltar(atual: string, pilha: string[], rotasShell: readonly string[]): { destino: string | null; pilha: string[] } {
  const caminhoAtual = caminhoDe(atual);
  const resto = [...pilha];
  while (resto.length) {
    const candidato = resto.pop()!;
    if (rotaInternaValida(candidato, rotasShell) && caminhoDe(candidato) !== caminhoAtual) {
      return { destino: candidato, pilha: resto };
    }
  }
  return { destino: null, pilha: [] };
}

/** Nome da tela de destino (rótulo do menu), para o aria-label/título. */
export function nomeDaTela(rota: string, itens: readonly { l: string; h: string }[]): string | null {
  const caminho = caminhoDe(rota);
  const candidatos = itens.filter(i => casaPrefixo(caminho, i.h)).sort((a, b) => b.h.length - a.h.length);
  return candidatos[0]?.l ?? null;
}

/** Lê a pilha guardada, descartando qualquer coisa inválida. */
export function lerPilha(bruto: string | null, rotasShell: readonly string[]): string[] {
  if (!bruto) return [];
  try {
    const v = JSON.parse(bruto);
    return Array.isArray(v) ? v.filter(r => rotaInternaValida(r, rotasShell)).slice(-LIMITE_PILHA) : [];
  } catch {
    return [];
  }
}
