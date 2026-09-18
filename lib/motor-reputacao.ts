// ── Motor de Reputação · rastreio honesto de clique ─────────────────────────
// Ver docs/google-presenca-reputacao-ads-v1-arquitetura.md para o desenho
// completo. Código puro (sem Supabase, sem fetch) — mesma filosofia de
// lib/orcamentos-state-machine.ts: testável antes de qualquer migration.
//
// Por que "clicado", nunca "respondeu"/"avaliou":
// A tabela `avaliacoes` de produção hoje tem uma coluna `respondeu` que
// NUNCA é escrita por nenhum caminho real (auditoria confirmou: só aparece
// em scripts/seed de demonstração). app/reputacao/page.tsx já lê e exibe
// essa coluna como "✅ Respondeu" — hoje ela só mostra 0% de resposta em
// produção real, mas o rótulo promete um dado que o sistema não tem como
// confirmar (não existe integração com a API do Google para saber se um
// cliente de fato deixou uma avaliação). Este módulo NUNCA tenta resolver
// isso por inferência: ele resolve um problema mais estreito e honesto —
// saber se o cliente clicou no link que levamos até ele. Clique é um fato
// que o próprio sistema pode confirmar (é ele quem serve o redirect);
// "avaliou" não é, e não deve ser fingido.

export type EstadoSolicitacaoAvaliacao = "enviado" | "clicado";

export type SolicitacaoAvaliacao = {
  id:             string;
  codigoRastreio: string;
  linkDestino:    string;       // link_google da clínica, capturado no envio (nunca recalculado depois)
  enviadoEm:      string;       // ISO
  clicadoEm:      string | null; // null = nunca clicou (ou clicou fora deste link) — nunca inferido
};

export function estadoDaSolicitacao(s: SolicitacaoAvaliacao): EstadoSolicitacaoAvaliacao {
  return s.clicadoEm !== null ? "clicado" : "enviado";
}

/**
 * Idempotência do registro de clique: só o primeiro clique é gravado.
 * Cliques repetidos (o cliente abre o link de novo) não sobrescrevem o
 * horário original nem geram um segundo evento — mesmo princípio de
 * idempotência já usado no domínio de orçamentos (seção 6 daquele
 * documento): a pergunta nunca é "quantas vezes", é "já aconteceu?".
 */
export function podeRegistrarClique(s: Pick<SolicitacaoAvaliacao, "clicadoEm">): boolean {
  return s.clicadoEm === null;
}

/**
 * Gera um código de rastreio curto e URL-safe. Unicidade REAL é garantida
 * por índice único no banco (clinica_id, codigo_rastreio) — esta função só
 * reduz a chance de colisão a um nível desprezível; nunca é a fonte de
 * verdade de unicidade.
 */
export function gerarCodigoRastreio(random: () => number = Math.random): string {
  const alfabeto = "23456789abcdefghjkmnpqrstuvwxyz"; // sem 0/1/i/l/o — evita confusão visual
  let codigo = "";
  for (let i = 0; i < 10; i++) {
    codigo += alfabeto[Math.floor(random() * alfabeto.length)];
  }
  return codigo;
}

/**
 * Só aceita http(s) como destino do redirect. Protege contra um
 * `link_google` corrompido/malicioso virar um open-redirect para
 * `javascript:`/`data:`/etc. — nunca confia no valor armazenado sem checar.
 */
export function validarLinkDestino(link: string | null | undefined): boolean {
  if (!link) return false;
  try {
    const url = new URL(link);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Guarda anti-spam: não permite uma nova solicitação de avaliação para o
 * mesmo cliente antes de `janelaDias` dias desde a última. `ultimaEm=null`
 * (nunca solicitado) sempre libera. Mesmo formato de data (YYYY-MM-DD) já
 * usado em lib/orcamentos-state-machine.ts.
 */
export function janelaAntiSpamExpirada(ultimaSolicitacaoEm: string | null, hoje: string, janelaDias = 7): boolean {
  if (ultimaSolicitacaoEm === null) return true;
  const dias = diasEntre(ultimaSolicitacaoEm, hoje);
  return dias >= janelaDias;
}

function diasEntre(de: string, ate: string): number {
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = ate.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}

/**
 * "Taxa de clique", nunca "taxa de resposta" — é o rótulo honesto para o
 * que este motor consegue medir. `solicitacoes` vazio devolve 0, nunca
 * NaN/Infinity.
 */
export function taxaDeCliquePct(solicitacoes: SolicitacaoAvaliacao[]): number {
  if (solicitacoes.length === 0) return 0;
  const clicadas = solicitacoes.filter(s => s.clicadoEm !== null).length;
  return Math.round((clicadas / solicitacoes.length) * 100);
}
