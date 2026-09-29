// POST /api/tratamentos/[id]/transicao — avança um tratamento para o
// próximo estado (em_andamento, retorno_agendado, concluido, interrompido,
// abandonado). Rota autenticada de staff. Nenhuma automação chama esta
// rota — só ação humana explícita.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import {
  transicionar, MOTIVOS_INTERRUPCAO,
  type Tratamento, type StatusTratamento, type MotivoInterrupcao,
} from "../../../../../lib/motor-tratamento";
import { registrarResultadoSeHouveDecisao } from "../../../../../lib/auditoria-resultado-persistencia";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_VALIDOS: StatusTratamento[] = ["em_andamento", "retorno_agendado", "concluido", "interrompido", "abandonado"];
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { clinica_id?: string; novo_status?: string; motivo_interrupcao?: string; proxima_data_prevista?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, novo_status, motivo_interrupcao, proxima_data_prevista } = body;

  if (!clinica_id || !novo_status) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e novo_status são obrigatórios" }, { status: 400 });
  }
  if (!STATUS_VALIDOS.includes(novo_status as StatusTratamento)) {
    return NextResponse.json(
      { sucesso: false, error: `novo_status deve ser um de: ${STATUS_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }
  if (motivo_interrupcao !== undefined && !MOTIVOS_INTERRUPCAO.includes(motivo_interrupcao as MotivoInterrupcao)) {
    return NextResponse.json(
      { sucesso: false, error: `motivo_interrupcao deve ser um de: ${MOTIVOS_INTERRUPCAO.join(", ")}` },
      { status: 400 }
    );
  }
  if (proxima_data_prevista !== undefined && !REGEX_DATA.test(proxima_data_prevista)) {
    return NextResponse.json({ sucesso: false, error: "proxima_data_prevista deve estar no formato AAAA-MM-DD" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "tratamento.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: tratamento, error: erroBusca } = await admin
    .from("tratamentos")
    .select("*")
    .eq("id", id)
    .eq("clinica_id", clinica_id)
    .maybeSingle<Tratamento>();

  if (erroBusca || !tratamento) {
    logOperacao({ operacao: "tratamento.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "tratamento nao encontrado nesta clinica" });
    return NextResponse.json({ sucesso: false, error: "Tratamento não encontrado" }, { status: 404 });
  }

  if (tratamento.status === novo_status) {
    logOperacao({ operacao: "tratamento.transicao", clinica_id, entidade_id: id, resultado: "sucesso", motivo: "replay — já estava neste status" });
    return NextResponse.json({ sucesso: true, idempotente: true, tratamento });
  }

  const agora = new Date().toISOString();
  const resultado = transicionar(
    tratamento,
    novo_status as StatusTratamento,
    { motivoInterrupcao: motivo_interrupcao as MotivoInterrupcao | undefined, proximaDataPrevista: proxima_data_prevista },
    agora
  );

  if (!resultado) {
    logOperacao({ operacao: "tratamento.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: `transicao invalida: ${tratamento.status} -> ${novo_status}` });
    return NextResponse.json(
      { sucesso: false, error: `Transição inválida: '${tratamento.status}' não pode ir para '${novo_status}'` },
      { status: 409 }
    );
  }

  const { data: atualizado, error: erroUpdate } = await admin
    .from("tratamentos")
    .update({ ...resultado, updated_at: agora })
    .eq("id", id)
    .eq("clinica_id", clinica_id) // defesa em profundidade — nenhuma escrita fica sem filtro de tenant
    .eq("status", tratamento.status) // guarda otimista contra concorrência
    .select()
    .maybeSingle();

  if (erroUpdate) {
    logOperacao({ operacao: "tratamento.transicao", clinica_id, entidade_id: id, resultado: "erro", motivo: erroUpdate.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível processar a transição" }, { status: 400 });
  }
  if (!atualizado) {
    logOperacao({ operacao: "tratamento.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "estado mudou entre leitura e escrita (concorrência)" });
    return NextResponse.json({ sucesso: false, error: "O tratamento foi alterado por outra requisição — tente novamente" }, { status: 409 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: `tratamento.${resultado.status}`,
    entidade_tipo: "tratamento",
    entidade_id: id,
    chave_idempotencia: `${id}:tratamento.${resultado.status}`,
    payload: { status_anterior: tratamento.status, status_novo: resultado.status },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "tratamento.transicao", clinica_id, entidade_id: id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
  }

  // P1.3 (Missão 3) — fecha SINAL → RECOMENDAÇÃO → AÇÃO → RESULTADO: se
  // este tratamento já teve uma decisão auditada (Follow-up Comercial
  // registrou "tratamento_sem_retorno"), vincula este status real como
  // resultado. Best-effort — nunca bloqueia a transição já confirmada.
  await registrarResultadoSeHouveDecisao(admin, {
    clinicaId: clinica_id, entidadeTipo: "tratamento", entidadeId: id,
    fatoObservado: `tratamento_${resultado.status}`, observadoEm: agora,
  });

  logOperacao({ operacao: "tratamento.transicao", clinica_id, entidade_id: id, resultado: "sucesso", motivo: `${tratamento.status} -> ${resultado.status}` });
  return NextResponse.json({ sucesso: true, idempotente: false, tratamento: atualizado });
}
