import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { entidadeIdDeterministico, entidadeIdDeTelefone, estadoConsentimentoAtual } from "./whatsapp-governado";

export async function produtoOrganizaPro(db: SupabaseClient, clinicaId: string): Promise<boolean> {
  const { data, error } = await db.from("clinicas").select("produto").eq("id", clinicaId).maybeSingle();
  return !error && data?.produto === "organizapro";
}

export async function consentimentoEnvio(db: SupabaseClient, clinicaId: string, telefone: string): Promise<boolean> {
  const { data, error } = await db.from("eventos_dominio").select("payload, criado_em")
    .eq("clinica_id", clinicaId).eq("entidade_tipo", "contato_whatsapp")
    .eq("entidade_id", entidadeIdDeTelefone(clinicaId, telefone)).eq("tipo", "whatsapp.consentimento");
  if (error || !data) return false;
  return estadoConsentimentoAtual(data.map(e => ({ criadoEm: e.criado_em, estado: e.payload?.estado }))) !== "bloqueado";
}

export type Reserva = { id: string; clinicaId: string; ticket: string; hash: string };
export type EstadoOperacao = "sucesso" | "incerto" | "rejeitado";

// INSERT com PK determinística: exclusão mútua entre processos, sem depender
// de UNIQUE parcial/chave_idempotencia de uma migration ainda não aplicada.
// Pendente/incerto nunca expira automaticamente: timeout não prova não envio.
export async function reservarOperacao(db: SupabaseClient, clinicaId: string, chave: string, conteudo: string,
  permitirRetry = false): Promise<Reserva | null> {
  const id = entidadeIdDeterministico("seguranca.p1", JSON.stringify([clinicaId, chave]));
  const hash = createHash("sha256").update(conteudo).digest("hex");
  const ticket = randomUUID();
  const payload = { estado: "pendente", ticket, hash };
  const { error } = await db.from("eventos_dominio").insert({ id, clinica_id: clinicaId,
    tipo: "seguranca.operacao", entidade_tipo: "operacao", entidade_id: id,
    chave_idempotencia: `seguranca:${id}`, payload, criado_em: new Date().toISOString() });
  if (!error) return { id, clinicaId, ticket, hash };
  if (error.code !== "23505" || !permitirRetry) return null;
  // Somente rejeição comprovada antes do efeito permite nova tentativa.
  // CAS: um único processo pode trocar rejeitado por pendente.
  const { data, error: retryError } = await db.from("eventos_dominio").update({ payload })
    .eq("id", id).eq("clinica_id", clinicaId).eq("payload->>estado", "rejeitado")
    .eq("payload->>hash", hash).select("id").maybeSingle();
  return !retryError && data ? { id, clinicaId, ticket, hash } : null;
}

export async function finalizarOperacao(db: SupabaseClient, reserva: Reserva, estado: EstadoOperacao): Promise<boolean> {
  const { data, error } = await db.from("eventos_dominio")
    .update({ payload: { estado, ticket: reserva.ticket, hash: reserva.hash } })
    .eq("id", reserva.id).eq("clinica_id", reserva.clinicaId)
    .eq("payload->>ticket", reserva.ticket).eq("payload->>estado", "pendente")
    .select("id").maybeSingle();
  return !error && !!data;
}

// Cota durável por hora; inserir slots por PK limita o total mesmo em workers
// concorrentes. Erro de persistência fecha o gate, nunca libera por fallback.
export async function consumirCotaIa(db: SupabaseClient, clinicaId: string, sujeito: string, limite: number): Promise<boolean> {
  const hora = new Date().toISOString().slice(0, 13);
  for (let slot = 0; slot < limite; slot++) {
    const id = entidadeIdDeterministico("ia.cota", JSON.stringify([clinicaId, sujeito, hora, slot]));
    const { error } = await db.from("eventos_dominio").insert({ id, clinica_id: clinicaId,
      tipo: "ia.consumo", entidade_tipo: "operacao", entidade_id: id,
      chave_idempotencia: `ia:${id}`, payload: { hora }, criado_em: new Date().toISOString() });
    if (!error) return true;
    if (error.code !== "23505") return false;
  }
  return false;
}
