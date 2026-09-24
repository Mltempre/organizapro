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

// eventos_dominio é append-only no banco: trigger BEFORE UPDATE/DELETE rejeita
// qualquer alteração, inclusive via service role (schema compartilhado com o
// ClínicaFlow). Toda transição de estado aqui é um INSERT novo com PK
// determinística — a PK é a exclusão mútua entre processos. Nunca UPDATE/DELETE.
// Pendente/incerto nunca expira automaticamente: timeout não prova não envio.
const MAX_TENTATIVAS = 20;

// Tentativa 0 mantém o ID original (reservas já gravadas e o dedup do webhook).
function idReserva(clinicaId: string, chave: string, tentativa: number): string {
  return tentativa === 0
    ? entidadeIdDeterministico("seguranca.p1", JSON.stringify([clinicaId, chave]))
    : entidadeIdDeterministico("seguranca.p1.tentativa", JSON.stringify([clinicaId, chave, tentativa]));
}

export function idResultadoOperacao(clinicaId: string, reservaId: string): string {
  return entidadeIdDeterministico("seguranca.p1.resultado", JSON.stringify([clinicaId, reservaId]));
}

type ResultadoOperacao = { estado?: string; ticket?: string; hash?: string };

// Erro de leitura equivale a "sem resultado": fecha o gate, nunca libera retry.
async function lerResultado(db: SupabaseClient, clinicaId: string, reservaId: string): Promise<ResultadoOperacao | null> {
  const { data, error } = await db.from("eventos_dominio").select("payload")
    .eq("id", idResultadoOperacao(clinicaId, reservaId)).eq("clinica_id", clinicaId)
    .eq("tipo", "seguranca.operacao_resultado").maybeSingle();
  return error || !data ? null : (data.payload as ResultadoOperacao);
}

export async function reservarOperacao(db: SupabaseClient, clinicaId: string, chave: string, conteudo: string,
  permitirRetry = false): Promise<Reserva | null> {
  const hash = createHash("sha256").update(conteudo).digest("hex");
  const ticket = randomUUID();
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    const id = idReserva(clinicaId, chave, tentativa);
    const { error } = await db.from("eventos_dominio").insert({ id, clinica_id: clinicaId,
      tipo: "seguranca.operacao", entidade_tipo: "operacao", entidade_id: id,
      chave_idempotencia: `seguranca:${id}`, payload: { estado: "pendente", ticket, hash }, criado_em: new Date().toISOString() });
    if (!error) return { id, clinicaId, ticket, hash };
    if (error.code !== "23505" || !permitirRetry) return null;
    // Somente rejeição comprovada antes do efeito, com o mesmo conteúdo, abre
    // a próxima tentativa; o INSERT dela serializa retries concorrentes.
    const anterior = await lerResultado(db, clinicaId, id);
    if (anterior?.estado !== "rejeitado" || anterior.hash !== hash) return null;
  }
  return null;
}

// Um único resultado por reserva (PK determinística). Conflito só é aceito
// quando o resultado existente é desta mesma reserva/ticket e do mesmo estado.
export async function finalizarOperacao(db: SupabaseClient, reserva: Reserva, estado: EstadoOperacao): Promise<boolean> {
  const { error } = await db.from("eventos_dominio").insert({ id: idResultadoOperacao(reserva.clinicaId, reserva.id),
    clinica_id: reserva.clinicaId, tipo: "seguranca.operacao_resultado", entidade_tipo: "operacao", entidade_id: reserva.id,
    chave_idempotencia: `seguranca-resultado:${reserva.id}`, payload: { estado, ticket: reserva.ticket, hash: reserva.hash },
    criado_em: new Date().toISOString() });
  if (!error) return true;
  if (error.code !== "23505") return false;
  const existente = await lerResultado(db, reserva.clinicaId, reserva.id);
  return existente?.estado === estado && existente.ticket === reserva.ticket && existente.hash === reserva.hash;
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
