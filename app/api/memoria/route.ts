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
import { normalizarTelefone } from "../../../lib/oportunidades-demanda";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const clinica_id = url.searchParams.get("clinica_id");
  const paciente_id = url.searchParams.get("paciente_id");
  const telefoneParam = url.searchParams.get("telefone");
  if (!clinica_id || !paciente_id) {
    return NextResponse.json({ error: "clinica_id e paciente_id são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) return NextResponse.json({ error: autorizacao.error }, { status: autorizacao.status });

  // auditoria.decisao nem sempre tem paciente_id disponível na origem: o
  // Gerente Comercial/Follow-up (lib/follow-up-comercial.ts, CasoFollowUp)
  // identifica o caso por telefone, nunca por cadastro — mesmo quando o
  // telefone já pertence a um paciente cadastrado. `cliente_id` no payload
  // é documentado em lib/auditoria-decisoes.ts como "paciente_id OU
  // telefone normalizado, quando disponível" — por isso a consulta aqui
  // precisa casar com QUALQUER um dos dois, nunca só paciente_id, senão
  // toda decisão hoje instrumentada (follow-up/tentativa) fica invisível
  // nesta tela. memoria.fato não tem esse problema: /api/memoria POST
  // sempre grava paciente_id real quando a tela envia (única origem hoje).
  const telefoneNormalizado = telefoneParam ? normalizarTelefone(telefoneParam) : "";
  let decisoesQuery = admin.from("eventos_dominio")
    .select("id, tipo, entidade_tipo, payload, criado_em, chave_idempotencia")
    .eq("clinica_id", clinica_id)
    .eq("tipo", "auditoria.decisao");
  decisoesQuery = telefoneNormalizado
    ? decisoesQuery.or(`payload->>cliente_id.eq.${paciente_id},payload->>cliente_id.eq.${telefoneNormalizado}`)
    : decisoesQuery.eq("payload->>cliente_id", paciente_id);

  const [{ data: fatos, error: erroFatos }, { data: decisoes, error: erroDecisoes }] = await Promise.all([
    admin.from("eventos_dominio")
      .select("id, tipo, entidade_tipo, payload, criado_em")
      .eq("clinica_id", clinica_id)
      .eq("tipo", "memoria.fato")
      .eq("payload->cliente->>pacienteId", paciente_id)
      .order("criado_em", { ascending: false }),
    decisoesQuery.order("criado_em", { ascending: false }),
  ]);
  if (erroFatos || erroDecisoes) {
    return NextResponse.json({ error: "Não foi possível consultar memória/auditoria" }, { status: 500 });
  }

  // auditoria.resultado_posterior (P1.3, Missão 3) nunca duplica cliente_id
  // no próprio payload (referência, nunca duplicação — ver lib/auditoria-
  // decisoes.ts) — só é encontrável via decisao_origem_chave apontando
  // para uma das decisões deste cliente, já resolvidas acima.
  const chavesDecisao = (decisoes ?? []).map((d) => d.chave_idempotencia);
  const { data: resultados, error: erroResultados } = chavesDecisao.length > 0
    ? await admin.from("eventos_dominio")
        .select("id, tipo, entidade_tipo, payload, criado_em")
        .eq("clinica_id", clinica_id)
        .eq("tipo", "auditoria.resultado_posterior")
        .in("payload->>decisao_origem_chave", chavesDecisao)
        .order("criado_em", { ascending: false })
    : { data: [], error: null };
  if (erroResultados) {
    return NextResponse.json({ error: "Não foi possível consultar resultados de auditoria" }, { status: 500 });
  }

  return NextResponse.json({ fatos: fatos ?? [], decisoes: [...(decisoes ?? []), ...(resultados ?? [])] });
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
