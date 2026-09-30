// ── Navegação "← Voltar" do OrganizaPro — regra pura ──────────────────────
// Padrão global de navegação das telas internas (renderizado uma única vez
// pelo shell persistente, app/components/AdminShellFrame.tsx). Sem React,
// sem DOM: só decide PARA ONDE voltar.
//
// Regra de destino:
//   1. a última tela INTERNA visitada nesta aba (pilha própria, guardada em
//      sessionStorage — sobrevive a recarregamento e a links <a> comuns);
//   2. sem origem válida (acesso direto pela URL, aba nova): o pai canônico
//      da tela (ex.: Pesquisa de Preços → Catálogo e Pedidos);
//   3. nunca sai do OrganizaPro: só aceita caminho interno ("/..."), de rota
//      com shell; nunca usa history.back() nem document.referrer.

export const CHAVE_PILHA = "organizapro:voltar:pilha";
export const CHAVE_ATUAL = "organizapro:voltar:atual";
export const CHAVE_VOLTANDO = "organizapro:voltar:voltando";
export const LIMITE_PILHA = 30;
export const INICIO = "/dashboard";

/** Telas onde "Voltar" não faz sentido: a Visão Geral é o ponto de partida. */
export const SEM_VOLTAR: readonly string[] = [INICIO];

/** Pai funcional de telas que nascem de outra (fallback sem origem registrada). */
const PAI_CANONICO: { prefixo: string; pai: string }[] = [
  { prefixo: "/pesquisa-precos", pai: "/pedidos" },
  { prefixo: "/estoque", pai: "/pedidos" },
  { prefixo: "/agenda-autonoma", pai: "/agendamentos" },
  { prefixo: "/clientes/", pai: "/clientes" },
  { prefixo: "/site/", pai: "/site" },
];

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

export function mostrarVoltar(caminho: string): boolean {
  return !SEM_VOLTAR.includes(caminho);
}

export function paiCanonico(caminho: string): string {
  const achado = PAI_CANONICO.find(p => p.prefixo.endsWith("/") ? caminho.startsWith(p.prefixo) : casaPrefixo(caminho, p.prefixo));
  return achado?.pai ?? INICIO;
}

/** Registra a tela anterior ao mudar de tela (não registra ao voltar pelo botão). */
export function registrarVisita(pilha: string[], anterior: string | null, atual: string, rotasShell: readonly string[]): string[] {
  if (!anterior || !rotaInternaValida(anterior, rotasShell)) return pilha;
  if (caminhoDe(anterior) === caminhoDe(atual)) return pilha;
  const base = pilha.length && caminhoDe(pilha[pilha.length - 1]) === caminhoDe(anterior) ? pilha.slice(0, -1) : pilha;
  return [...base, anterior].slice(-LIMITE_PILHA);
}

/** Para onde o botão leva agora, e como fica a pilha depois de voltar. */
export function destinoVoltar(atual: string, pilha: string[], rotasShell: readonly string[]): { destino: string; pilha: string[]; origem: "historico" | "pai" } {
  const caminhoAtual = caminhoDe(atual);
  const resto = [...pilha];
  while (resto.length) {
    const candidato = resto.pop()!;
    if (rotaInternaValida(candidato, rotasShell) && caminhoDe(candidato) !== caminhoAtual) {
      return { destino: candidato, pilha: resto, origem: "historico" };
    }
  }
  return { destino: paiCanonico(caminhoAtual), pilha: [], origem: "pai" };
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
