// POST /api/oportunidades/[id]/gerar-orcamento — última milha: fecha a
// passagem Oportunidade → Orçamento usando exclusivamente os contratos já
// canônicos. Nenhum motor novo: o INSERT em `orcamentos` replica campo a
// campo o mesmo contrato de POST /api/orcamentos (mesmo formato de
// idempotência via eventos_dominio, mesmo shape de linha) — não existe
// aqui nenhuma regra de orçamento que a API canônica não defina.
//
// Elegibilidade e o guard contra duplicação vêm de
// lib/oportunidades-demanda.ts (oportunidadeElegivelParaOrcamento), a
// mesma lib já portada — nenhum segundo motor de oportunidade.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import { oportunidadeElegivelParaOrcamento, type OportunidadeStatus } from "../../../../../lib/oportunidades-demanda";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Mesmo padrão local já usado em app/api/oportunidades/route.ts e
// .../[id]/transicao/route.ts: clinica_id nunca vem do body/query, só do
// vínculo real do usuário autenticado.
async function resolverClinica(req: NextRequest): Promise<
  | { ok: true; clinicaId: string; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) return { ok: false, response: NextResponse.json({ error: "Autenticação obrigatória" }, { status: 401 }) };

  const { data: { user } } = await supabaseAnon.auth.getUser(bearer);
  if (!user) return { ok: false, response: NextResponse.json({ error: "Sessão inválida ou expirada" }, { status: 401 }) };

  const { data: vinculo, error } = await supabase
    .from("clinica_usuarios")
    .select("clinica_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (error || !vinculo?.clinica_id) {
    return { ok: false, response: NextResponse.json({ error: "Usuário não tem vínculo com uma clínica" }, { status: 403 }) };
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, vinculo.clinica_id);
  if (!autorizacao.ok) return { ok: false, response: NextResponse.json({ error: autorizacao.error }, { status: autorizacao.status }) };
  return { ok: true, clinicaId: vinculo.clinica_id, userId: autorizacao.userId };
}

type OportunidadeLinha = {
  id: string;
  clinica_id: string;
  status: OportunidadeStatus;
  telefone: string;
  nome_informado: string | null;
  orcamento_vinculado_id: string | null;
};

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await resolverClinica(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  let body: { paciente_nome?: string; procedimento?: string; valor?: number; observacao?: string; idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }
  const { procedimento, valor, observacao, idempotency_key } = body;

  if (!procedimento?.trim() || !idempotency_key?.trim()) {
    return NextResponse.json({ sucesso: false, error: "procedimento e idempotency_key são obrigatórios" }, { status: 400 });
  }
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ sucesso: false, error: "valor deve ser um número positivo" }, { status: 400 });
  }

  const { data: oportunidade, error: erroBusca } = await supabase
    .from("oportunidades_demanda")
    .select("id, clinica_id, status, telefone, nome_informado, orcamento_vinculado_id")
    .eq("id", id)
    .eq("clinica_id", auth.clinicaId)
    .maybeSingle<OportunidadeLinha>();

  if (erroBusca || !oportunidade) {
    logOperacao({ operacao: "oportunidade.gerar_orcamento", clinica_id: auth.clinicaId, entidade_id: id, resultado: "rejeitado", motivo: "oportunidade não encontrada nesta clínica" });
    return NextResponse.json({ sucesso: false, error: "Oportunidade não encontrada" }, { status: 404 });
  }

  // Replay idempotente: já vinculada = devolve o orçamento já existente,
  // nunca cria um segundo. Único fato que decide isso é orcamento_vinculado_id
  // — nunca o status.
  if (oportunidade.orcamento_vinculado_id !== null) {
    const { data: orcamentoExistente } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("id", oportunidade.orcamento_vinculado_id)
      .maybeSingle();
    logOperacao({ operacao: "oportunidade.gerar_orcamento", clinica_id: auth.clinicaId, entidade_id: id, resultado: "sucesso", motivo: "já vinculada — replay idempotente" });
    return NextResponse.json({ sucesso: true, idempotente: true, orcamento: orcamentoExistente ?? null });
  }

  if (!oportunidadeElegivelParaOrcamento(oportunidade)) {
    logOperacao({ operacao: "oportunidade.gerar_orcamento", clinica_id: auth.clinicaId, entidade_id: id, resultado: "rejeitado", motivo: `oportunidade encerrada (status: ${oportunidade.status})` });
    return NextResponse.json({ sucesso: false, error: `Oportunidade encerrada (status: ${oportunidade.status}) não pode gerar orçamento` }, { status: 409 });
  }

  const nomeCliente = body.paciente_nome?.trim() || oportunidade.nome_informado?.trim() || "";
  if (!nomeCliente) {
    return NextResponse.json({ sucesso: false, error: "paciente_nome é obrigatório (oportunidade não tem nome informado)" }, { status: 400 });
  }

  // ─── Daqui em diante, contrato IDÊNTICO a POST /api/orcamentos ──────────
  const chaveIdempotencia = `criar-orcamento:${idempotency_key}`;
  const { data: eventoExistente } = await supabase
    .from("eventos_dominio")
    .select("entidade_id")
    .eq("clinica_id", auth.clinicaId)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();

  let novoOrcamento: { id: string } | null = null;

  if (eventoExistente) {
    const { data: orcamentoExistente } = await supabase.from("orcamentos").select("*").eq("id", eventoExistente.entidade_id).maybeSingle();
    if (orcamentoExistente) novoOrcamento = orcamentoExistente;
  }

  if (!novoOrcamento) {
    const agora = new Date().toISOString();
    const { data: novo, error: erroInsert } = await supabase
      .from("orcamentos")
      .insert({
        clinica_id: auth.clinicaId,
        paciente_nome: nomeCliente,
        telefone: oportunidade.telefone,
        procedimento: procedimento.trim(),
        valor,
        observacao: observacao?.trim() || null,
        status: "apresentado",
        created_by: auth.userId,
        apresentado_em: agora,
      })
      .select()
      .single();

    if (erroInsert) {
      logOperacao({ operacao: "oportunidade.gerar_orcamento", clinica_id: auth.clinicaId, entidade_id: id, resultado: "erro", motivo: erroInsert.message });
      return NextResponse.json({ sucesso: false, error: "Não foi possível criar o orçamento" }, { status: 500 });
    }

    const { error: erroEvento } = await supabase.from("eventos_dominio").insert({
      clinica_id: auth.clinicaId,
      tipo: "orcamento.criado",
      entidade_tipo: "orcamento",
      entidade_id: novo.id,
      chave_idempotencia: chaveIdempotencia,
      payload: { status_anterior: null, status_novo: "apresentado", origem: "oportunidade", oportunidade_id: id },
      criado_em: agora,
    });

    if (erroEvento) {
      // Mesma corrida real já tratada em POST /api/orcamentos: outra
      // requisição com a mesma idempotency_key venceu.
      await supabase.from("orcamentos").delete().eq("id", novo.id);
      const { data: vencedor } = await supabase.from("eventos_dominio").select("entidade_id").eq("clinica_id", auth.clinicaId).eq("chave_idempotencia", chaveIdempotencia).maybeSingle();
      const { data: orcamentoVencedor } = vencedor ? await supabase.from("orcamentos").select("*").eq("id", vencedor.entidade_id).maybeSingle() : { data: null };
      if (!orcamentoVencedor) {
        return NextResponse.json({ sucesso: false, error: "Erro de concorrência ao registrar auditoria — tente novamente" }, { status: 409 });
      }
      novoOrcamento = orcamentoVencedor;
    } else {
      novoOrcamento = novo;
    }
  }

  // ─── Vínculo oportunidade → orçamento — guarda contra duplicação ────────
  // UPDATE só é aceito se orcamento_vinculado_id AINDA for null (guarda
  // otimista, mesmo padrão de defesa em profundidade já usado nas
  // transições de tratamentos/cobrancas): se outra requisição venceu a
  // corrida e já vinculou, esta chamada perde — o orçamento acima já foi
  // criado de forma válida (não é desfeito), só o vínculo não se repete.
  const { data: vinculado, error: erroVinculo } = await supabase
    .from("oportunidades_demanda")
    .update({ orcamento_vinculado_id: novoOrcamento!.id, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("clinica_id", auth.clinicaId)
    .is("orcamento_vinculado_id", null)
    .select("id, orcamento_vinculado_id")
    .maybeSingle();

  if (erroVinculo) {
    logOperacao({ operacao: "oportunidade.gerar_orcamento", clinica_id: auth.clinicaId, entidade_id: id, resultado: "erro", motivo: erroVinculo.message });
    return NextResponse.json({ sucesso: false, error: "Orçamento criado, mas não foi possível vincular à oportunidade" }, { status: 500 });
  }
  if (!vinculado) {
    logOperacao({ operacao: "oportunidade.gerar_orcamento", clinica_id: auth.clinicaId, entidade_id: id, resultado: "rejeitado", motivo: "oportunidade foi vinculada por outra requisição concorrente" });
    return NextResponse.json({ sucesso: false, error: "Esta oportunidade já foi vinculada a um orçamento por outra requisição" }, { status: 409 });
  }

  logOperacao({ operacao: "oportunidade.gerar_orcamento", clinica_id: auth.clinicaId, entidade_id: id, resultado: "sucesso", motivo: `orcamento ${novoOrcamento!.id} vinculado` });
  return NextResponse.json({ sucesso: true, idempotente: false, orcamento: novoOrcamento });
}
