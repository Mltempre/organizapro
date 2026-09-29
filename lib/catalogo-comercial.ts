// ── Catálogo Comercial — regra ÚNICA de cadastro de itens ─────────────────
// Um só catálogo (tabela clinica_servicos, nome interno herdado — não é
// renomeada): produtos, serviços ou ambos, para qualquer tipo de negócio.
// Usado por Catálogo e Pedidos (/pedidos, administração para venda) e por
// Meu Site → Serviços (/site/servicos, vitrine pública) — as duas telas
// chamam ESTE módulo, nunca uma cópia da regra de persistência.
//
// Regra de persistência preservada byte a byte do que já estava homologado
// em /site/servicos (ver docs da frente E-commerce V1): o salvamento
// principal (nome/descrição/ícone/imagem/ordem) e o de preço/disponibilidade
// são chamadas SEPARADAS — falha no segundo vira aviso não-bloqueante e
// nunca desfaz o primeiro. Toda escrita é filtrada por clinica_id (RLS do
// banco continua sendo a barreira; o filtro é defesa em profundidade).
// O preço de um PEDIDO continua sendo calculado no servidor (/api/pedidos),
// nunca a partir do que esta tela envia.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ItemCatalogo = {
  id: string; clinica_id?: string; icone: string; imagem_url: string | null; nome: string;
  descricao: string | null; ordem: number; preco_centavos?: number | null; disponivel?: boolean;
};
export type FormItemCatalogo = { icone: string; imagem_url: string; nome: string; descricao: string; preco: string; disponivel: boolean };

// Ícones são decoração da vitrine do site. As chaves são dado interno já
// gravado (inclusive a legada "tooth", exibida como "⭐ Destaque") — nunca
// mostradas ao usuário; o que aparece é emoji + rótulo.
export const ICONES_CATALOGO = [
  { key: "tooth",      emoji: "⭐", label: "Destaque"    },
  { key: "smile",      emoji: "😊", label: "Atendimento" },
  { key: "gem",        emoji: "💎", label: "Premium"     },
  { key: "microscope", emoji: "🔍", label: "Detalhes"    },
  { key: "shield",     emoji: "🛡️", label: "Garantia"    },
  { key: "sparkle",    emoji: "✨", label: "Especial"    },
  { key: "heart",      emoji: "❤️", label: "Cuidado"     },
  { key: "clinic",     emoji: "🏢", label: "Negocio"     },
] as const;
export const CORES_ICONE_CATALOGO: Record<string, string> = {
  tooth: "#00c896", smile: "#3b82f6", gem: "#8b5cf6",
  microscope: "#f59e0b", shield: "#ef4444", sparkle: "#06b6d4",
  heart: "#ec4899", clinic: "#10b981",
};
export const ICONE_PADRAO_CATALOGO = "tooth";
export const FORM_ITEM_VAZIO: FormItemCatalogo = { icone: ICONE_PADRAO_CATALOGO, imagem_url: "", nome: "", descricao: "", preco: "", disponivel: true };

// Nunca float — mesma convenção de preco_centavos em todo o schema real.
export function parsePrecoParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3},)/g, "").replace(",", ".");
  if (!limpo) return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return Math.round(valor * 100);
}
export function formatarCentavosParaInput(centavos?: number | null): string {
  if (centavos === null || centavos === undefined) return "";
  return (centavos / 100).toFixed(2).replace(".", ",");
}
export function formularioDoItem(item: ItemCatalogo): FormItemCatalogo {
  return { icone: item.icone, imagem_url: item.imagem_url ?? "", nome: item.nome, descricao: item.descricao ?? "", preco: formatarCentavosParaInput(item.preco_centavos), disponivel: item.disponivel !== false };
}

/** Item pode entrar num pedido: disponível e com preço definido (> 0). */
export function itemVendavel(item: Pick<ItemCatalogo, "disponivel" | "preco_centavos">): boolean {
  return item.disponivel !== false && typeof item.preco_centavos === "number" && item.preco_centavos > 0;
}

export type ResultadoSalvarItem = { ok: true; id: string; avisoPreco: string } | { ok: false; erro: string };

export async function salvarItemCatalogo(db: SupabaseClient, args: {
  clinicaId: string; form: FormItemCatalogo; itemId?: string | null; ordemNova?: number;
}): Promise<ResultadoSalvarItem> {
  const { clinicaId, form, itemId } = args;
  if (!form.nome.trim()) return { ok: false, erro: "Informe o nome do item." };
  const payload = { clinica_id: clinicaId, icone: form.icone, imagem_url: form.imagem_url || null, nome: form.nome.trim(), descricao: form.descricao.trim() || null };
  let id: string;
  if (!itemId) {
    const { data, error } = await db.from("clinica_servicos").insert({ ...payload, ordem: args.ordemNova ?? 0 }).select("id").single();
    if (error || !data) return { ok: false, erro: "Erro ao salvar." };
    id = (data as { id: string }).id;
  } else {
    const { error } = await db.from("clinica_servicos").update(payload).eq("id", itemId).eq("clinica_id", clinicaId);
    if (error) return { ok: false, erro: "Erro ao salvar." };
    id = itemId;
  }
  const precoCentavos = parsePrecoParaCentavos(form.preco);
  const { error: erroPreco } = await db.from("clinica_servicos")
    .update({ preco_centavos: precoCentavos, disponivel: form.disponivel }).eq("id", id).eq("clinica_id", clinicaId);
  return { ok: true, id, avisoPreco: erroPreco ? "Preço/disponibilidade ainda não pôde ser salvo (funcionalidade em ativação)." : "" };
}

/** Upload da imagem do item — mesmo endpoint e tipo já homologados. */
export async function enviarImagemItem(accessToken: string, clinicaId: string, file: File): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const fd = new FormData();
  fd.append("file", file); fd.append("tipo", "servico"); fd.append("clinica_id", clinicaId);
  const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.url !== "string") return { ok: false, erro: data?.error || "Erro no upload." };
  return { ok: true, url: data.url };
}
