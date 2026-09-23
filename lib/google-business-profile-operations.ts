import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErroGoogle, erroGoogle } from "./google-business-profile-errors";

type Resultado = { sucesso: true; estado?: string; texto?: string; reviewId?: string; reviewName?: string; google_post_name?: string };
type Operacao = { clinica: string; tipo: "oauth" | "rascunho" | "resposta" | "post"; chave: string; recurso: string; conteudo: string };
function identidade(value: string): string {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20)}`;
}
export async function executarOperacaoGoogle(admin: SupabaseClient, op: Operacao, executar: (iniciarEscrita: () => void) => Promise<Resultado>): Promise<Resultado> {
  if (!op.chave || op.chave.length > 128) throw new ErroGoogle("ENTRADA");
  const { data, error } = await admin.rpc("gbp_iniciar_operacao", { p_clinica: op.clinica, p_operacao: op.tipo, p_chave: op.chave,
    p_recurso: op.recurso, p_hash: createHash("sha256").update(JSON.stringify([op.recurso, op.conteudo])).digest("hex") });
  if (error || !data) throw new ErroGoogle("PERSISTENCIA");
  if (data.estado === "sucesso" && data.resultado?.sucesso === true) return data.resultado as Resultado;
  if (data.estado === "conflito") throw new ErroGoogle("CONFLITO");
  if (data.estado !== "adquirido" || typeof data.ticket !== "string") throw new ErroGoogle("PENDENTE", true);
  const ticket: string = data.ticket;
  let escritaIniciada = false;
  let confirmado = false;
  async function finalizar(estado: string, resultado: Resultado | { codigo: string }) {
    const { data: ok, error: erro } = await admin.rpc("gbp_finalizar_operacao", { p_clinica: op.clinica, p_operacao: op.tipo,
      p_chave: op.chave, p_ticket: ticket, p_estado: estado, p_resultado: resultado, p_entidade: identidade(`${op.clinica}:${op.recurso}`) });
    if (erro || ok !== true) throw new ErroGoogle("PERSISTENCIA", true);
  }
  try {
    const resultado = await executar(() => { escritaIniciada = true; });
    confirmado = true;
    await finalizar("sucesso", resultado);
    return resultado;
  } catch (error) {
    const e = erroGoogle(error);
    // Falha da persistencia apos sucesso externo conserva pendente: sem repetir.
    if (confirmado) throw new ErroGoogle("PERSISTENCIA", true);
    const incerto = escritaIniciada && e.resultadoIncerto;
    await finalizar(incerto ? "incerto" : "falhou", { codigo: e.codigo });
    throw incerto ? new ErroGoogle("PENDENTE", true, e.httpGoogle) : e;
  }
}
