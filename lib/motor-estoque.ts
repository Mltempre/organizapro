// ── Estoque Comercial Básico V1 — regras puras ───────────────────────────
// Operacional/comercial apenas: nenhuma função fiscal, tributária ou
// contábil. Sem DB/HTTP. O saldo e as movimentações vivem no banco
// (supabase/migrations/20261001000001_estoque_basico_v1.sql), sempre
// alterados por funções transacionais chamadas pelo servidor.
//
// Regra canônica de baixa (fluxo real de lib/motor-pedidos.ts):
//   - baixa quando o lojista CONFIRMA o pedido (criado → confirmado): todo
//     pedido pago passa por "confirmado", e é o compromisso de entregar;
//   - estorno quando o pedido é CANCELADO (possível a partir de confirmado
//     e aguardando pagamento; "pago" é terminal e não cancela);
//   - nenhum outro evento mexe no estoque. Repetição nunca baixa/estorna de
//     novo (índice único por pedido + item + tipo no banco).

export type TipoItemCatalogo = "produto" | "servico";
export type TipoMovimentoManual = "entrada" | "ajuste";
export type TipoMovimento = TipoMovimentoManual | "venda" | "estorno_venda";

export type EfeitoEstoque = "baixa" | "estorno" | null;

export const STATUS_NOVO_POR_EFEITO: Record<Exclude<EfeitoEstoque, null>, "confirmado" | "cancelado"> = {
  baixa: "confirmado",
  estorno: "cancelado",
};

/** Qual efeito de estoque um evento de pedido tem. Único ponto dessa decisão. */
export function efeitoEstoqueDoEvento(evento: string): EfeitoEstoque {
  if (evento === "confirmar_pedido") return "baixa";
  if (evento === "cancelar_pedido") return "estorno";
  return null;
}

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  entrada: "Entrada",
  ajuste: "Ajuste",
  venda: "Venda (pedido confirmado)",
  estorno_venda: "Estorno (pedido cancelado)",
};

export const LIMITE_SKU = 60;
export const LIMITE_MOTIVO = 300;
export const LIMITE_QUANTIDADE = 1_000_000;

/** SKU/código interno opcional: vazio → null; espaços internos colapsados. */
export function normalizarSku(valor: unknown): { ok: true; sku: string | null } | { ok: false; erro: string } {
  if (valor === null || valor === undefined) return { ok: true, sku: null };
  if (typeof valor !== "string") return { ok: false, erro: "SKU inválido." };
  const sku = valor.trim().replace(/\s+/g, " ");
  if (!sku) return { ok: true, sku: null };
  if (sku.length > LIMITE_SKU) return { ok: false, erro: `SKU deve ter até ${LIMITE_SKU} caracteres.` };
  return { ok: true, sku };
}

/** Código de barras opcional (EAN/GTIN ou código próprio): letras, números e hífen. */
export function normalizarCodigoBarras(valor: unknown): { ok: true; codigo: string | null } | { ok: false; erro: string } {
  if (valor === null || valor === undefined) return { ok: true, codigo: null };
  if (typeof valor !== "string") return { ok: false, erro: "Código de barras inválido." };
  const codigo = valor.replace(/\s+/g, "");
  if (!codigo) return { ok: true, codigo: null };
  if (!/^[0-9A-Za-z-]{1,64}$/.test(codigo)) return { ok: false, erro: "Código de barras aceita só letras, números e hífen (até 64)." };
  return { ok: true, codigo };
}

export type ConfigEstoqueItem = {
  tipo_item: TipoItemCatalogo; sku: string | null; codigo_barras: string | null;
  controla_estoque: boolean; estoque_minimo: number | null;
};

/** Valida a configuração de estoque de um item vinda do formulário. */
export function validarConfigEstoque(entrada: Record<string, unknown>): { ok: true; config: ConfigEstoqueItem } | { ok: false; erro: string } {
  const tipo = entrada.tipo_item;
  if (tipo !== "produto" && tipo !== "servico") return { ok: false, erro: "Tipo deve ser produto ou serviço." };
  const sku = normalizarSku(entrada.sku);
  if (!sku.ok) return sku;
  const codigo = normalizarCodigoBarras(entrada.codigo_barras);
  if (!codigo.ok) return codigo;
  const controla = entrada.controla_estoque === true;
  if (controla && tipo !== "produto") return { ok: false, erro: "Só produto físico controla estoque." };
  let minimo: number | null = null;
  if (entrada.estoque_minimo !== null && entrada.estoque_minimo !== undefined && entrada.estoque_minimo !== "") {
    const n = Number(entrada.estoque_minimo);
    if (!Number.isInteger(n) || n < 0 || n > LIMITE_QUANTIDADE) return { ok: false, erro: "Estoque mínimo deve ser um número inteiro de 0 em diante." };
    minimo = n;
  }
  return { ok: true, config: { tipo_item: tipo, sku: sku.sku, codigo_barras: codigo.codigo, controla_estoque: controla, estoque_minimo: controla ? minimo : null } };
}

/** Movimento manual: entrada soma; ajuste informa o saldo CONTADO (exige motivo). */
export function validarMovimentoManual(entrada: { tipo: unknown; quantidade: unknown; motivo: unknown }):
  { ok: true; tipo: TipoMovimentoManual; quantidade: number; motivo: string | null } | { ok: false; erro: string } {
  if (entrada.tipo !== "entrada" && entrada.tipo !== "ajuste") return { ok: false, erro: "Movimento deve ser entrada ou ajuste." };
  const q = Number(entrada.quantidade);
  if (!Number.isInteger(q) || q > LIMITE_QUANTIDADE) return { ok: false, erro: "Quantidade deve ser um número inteiro." };
  if (entrada.tipo === "entrada" && q <= 0) return { ok: false, erro: "Entrada deve ser maior que zero." };
  if (entrada.tipo === "ajuste" && q < 0) return { ok: false, erro: "O saldo contado não pode ser negativo." };
  const motivo = typeof entrada.motivo === "string" ? entrada.motivo.trim() : "";
  if (motivo.length > LIMITE_MOTIVO) return { ok: false, erro: `Motivo deve ter até ${LIMITE_MOTIVO} caracteres.` };
  if (entrada.tipo === "ajuste" && !motivo) return { ok: false, erro: "Informe o motivo do ajuste (ex.: contagem, perda, avaria)." };
  return { ok: true, tipo: entrada.tipo, quantidade: q, motivo: motivo || null };
}

/** Estoque baixo: só quando há mínimo definido e o saldo chegou nele ou abaixo. */
export function estoqueBaixo(saldo: number, minimo: number | null | undefined): boolean {
  return typeof minimo === "number" && saldo <= minimo;
}

export type ItemBusca = { id: string; nome: string; sku?: string | null; codigo_barras?: string | null };

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Busca por nome (sem acento/maiúsculas), SKU ou código de barras. Um leitor
 * de código de barras funciona como teclado: digita o código no campo — o
 * item com código ou SKU idêntico vem primeiro (correspondência exata).
 */
export function buscarItens<T extends ItemBusca>(itens: T[], termo: string): T[] {
  const t = termo.trim();
  if (!t) return itens;
  const tn = semAcento(t);
  const exato = (i: T) => (!!i.codigo_barras && i.codigo_barras === t.replace(/\s+/g, "")) || (!!i.sku && semAcento(i.sku) === tn);
  const parcial = (i: T) => semAcento(i.nome).includes(tn) || (!!i.sku && semAcento(i.sku).includes(tn)) || (!!i.codigo_barras && i.codigo_barras.includes(t));
  return [...itens.filter(exato), ...itens.filter(i => !exato(i) && parcial(i))];
}

/** Mensagem clara para pedido bloqueado por saldo. */
export function mensagemEstoqueInsuficiente(itens: { nome: string; saldo: number; necessario: number }[]): string {
  const partes = itens.map(i => `${i.nome} (saldo ${i.saldo}, pedido ${i.necessario})`);
  return `Estoque insuficiente para confirmar: ${partes.join("; ")}. Registre uma entrada em Estoque ou ajuste o pedido.`;
}

/** Mensagens da função de movimento manual do banco → texto para a tela. */
export const MENSAGEM_ERRO_MOVIMENTO: Record<string, string> = {
  item_nao_encontrado: "Item não encontrado neste negócio.",
  estoque_nao_controlado: "Este item não controla estoque. Ative no cadastro do Catálogo.",
  sem_diferenca: "O saldo contado é igual ao atual — nada a ajustar.",
  motivo_obrigatorio: "Informe o motivo do ajuste.",
  quantidade_invalida: "Quantidade inválida.",
  tipo_invalido: "Movimento inválido.",
  chave_obrigatoria: "Não foi possível registrar. Tente novamente.",
};

/** Erro do Supabase/PostgREST que indica que a migration ainda não foi aplicada. */
export function estoqueIndisponivelNoBanco(erro: { code?: string; message?: string } | null | undefined): boolean {
  if (!erro) return false;
  return ["PGRST202", "PGRST205", "42P01", "42883", "42703", "PGRST204"].includes(erro.code ?? "")
    || /does not exist|could not find the (function|table)/i.test(erro.message ?? "");
}
