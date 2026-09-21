// ── /api/memoria — Memória com Proveniência V1 (P1: Reintegração) ───────
// Reconecta lib/memoria-proveniencia.ts (motor puro, órfão até esta
// missão — nenhum arquivo real o importava) à camada inteligente, sem
// migration: reaproveita public.eventos_dominio (mesmo padrão já usado
// por Cobrador Digital, Follow-up Comercial e Auditoria das Decisões).
//
// GET também devolve, no mesmo payload, as evidências de Auditoria das
// Decisões da IA (auditoria.decisao/auditoria.resultado_posterior) já
// gravadas por app/api/follow-up/tentativa/route.ts — hoje write-only,
// sem nenhuma tela consumindo. Uma única resposta, um único painel em
// app/clientes/[id]/page.tsx: nunca duas superfícies para "o que o
// OrganizaPro sabe/decidiu sobre este cliente".
//
// V1 exige paciente_id real (o único identificador que app/clientes/[id]
// sempre tem) — fato humano vinculado só a telefone (sem cadastro) fica
// fora desta reintegração; eventos_dominio.entidade_id é uuid NOT NULL e
// telefone bruto não é um uuid (mesmo problema já resolvido para
// followup.tentativa via entidadeIdDeTelefone, não replicado aqui para
// não alargar o escopo desta missão).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { prepararRegistroMemoria, type FatoMemoria } from "../../../lib/memoria-proveniencia";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const clinica_id = url.searchParams.get("clinica_id");
  const paciente_id = url.searchParams.get("paciente_id");
  if (!clinica_id || !paciente_id) {
    return NextResponse.json({ error: "clinica_id e paciente_id são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) return NextResponse.json({ error: autorizacao.error }, { status: autorizacao.status });

  const [{ data: fatos, error: erroFatos }, { data: decisoes, error: erroDecisoes }] = await Promise.all([
    admin.from("eventos_dominio")
      .select("id, tipo, entidade_tipo, payload, criado_em")
      .eq("clinica_id", clinica_id)
      .eq("tipo", "memoria.fato")
      .eq("payload->cliente->>pacienteId", paciente_id)
      .order("criado_em", { ascending: false }),
    admin.from("eventos_dominio")
      .select("id, tipo, entidade_tipo, payload, criado_em")
      .eq("clinica_id", clinica_id)
      .in("tipo", ["auditoria.decisao", "auditoria.resultado_posterior"])
      .eq("payload->>cliente_id", paciente_id)
      .order("criado_em", { ascending: false }),
  ]);
  if (erroFatos || erroDecisoes) {
    return NextResponse.json({ error: "Não foi possível consultar memória/auditoria" }, { status: 500 });
  }

  return NextResponse.json({ fatos: fatos ?? [], decisoes: decisoes ?? [] });
}

export async function POST(req: NextRequest) {
  let body: {
    clinica_id?: string; paciente_id?: string; telefone?: string | null;
    tipo_fato?: string; conteudo?: string; observado_em?: string;
    valido_ate?: string | null; autor_nome?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, paciente_id, telefone, tipo_fato, conteudo, observado_em, valido_ate, autor_nome } = body;
  if (!clinica_id || !paciente_id || !tipo_fato?.trim() || !conteudo?.trim() || !observado_em || !autor_nome?.trim()) {
    return NextResponse.json({ error: "clinica_id, paciente_id, tipo_fato, conteudo, observado_em e autor_nome são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) return NextResponse.json({ error: autorizacao.error }, { status: autorizacao.status });

  const fato: FatoMemoria = {
    clinicaId: clinica_id,
    cliente: { pacienteId: paciente_id, telefone: telefone ?? null },
    origem: { tipo: "humano", autorId: autorizacao.userId, autorNome: autor_nome.trim() },
    tipoFato: tipo_fato.trim(),
    conteudo: conteudo.trim(),
    observadoEm: observado_em,
    validoAte: valido_ate ?? null,
  };

  const registro = prepararRegistroMemoria(fato);
  if (!registro) {
    return NextResponse.json({ error: "Fato sem proveniência válida — nunca registrado" }, { status: 400 });
  }

  const { error } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: registro.tipoEvento,
    entidade_tipo: registro.entidadeTipo,
    entidade_id: registro.entidadeId,
    chave_idempotencia: registro.chaveIdempotencia,
    payload: registro.payload,
    criado_em: new Date().toISOString(),
  });
  if (error && !/duplicate|unique/i.test(error.message ?? "")) {
    return NextResponse.json({ error: "Não foi possível registrar o fato" }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true });
}
