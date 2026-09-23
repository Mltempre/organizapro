// POST /api/cobrancas/[id]/tentativa — prepara e registra uma tentativa
// de cobrança (Cobrador Digital V1). Rota autenticada de staff, ação
// humana explícita — nenhuma automação chama esta rota.
//
// Modo estritamente PREPARATÓRIO nesta versão: nunca chama o adaptador
// de envio real (POST /api/whatsapp, Z-API). O gate de autonomia/
// consentimento necessário para envio automático ainda não existe —
// quando existir, uma versão futura pode chamar internamente
// POST /api/whatsapp (mesmo padrão de autenticarServicoInterno já usado
// por cron/webhook) a partir daqui, nunca duplicando o adaptador.
//
// Idempotência: reaproveita public.eventos_dominio (mesmo padrão já
// usado por orcamentos/tratamentos/pedidos/transição de cobranças) — a
// chave de idempotência inclui a data (AAAA-MM-DD), então no máximo uma
// tentativa por cobrança por dia é registrada, nunca duplicada.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import {
  elegivelParaTentativaCobranca, prepararMensagemCobranca, diasAtraso,
  type Cobranca,
} from "../../../../../lib/motor-cobranca";
import { prepararRegistroAuditoria } from "../../../../../lib/auditoria-decisoes";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MOTIVO_HTTP: Record<string, number> = {
  ja_paga: 409,
  cancelada: 409,
  nao_vencida: 400,
  sem_telefone: 400,
  tentativa_ja_registrada_hoje: 409,
};

const MOTIVO_MENSAGEM: Record<string, string> = {
  ja_paga: "Cobrança já está paga — nenhuma tentativa é necessária.",
  cancelada: "Cobrança cancelada — nenhuma tentativa é permitida.",
  nao_vencida: "Cobrança ainda não venceu.",
  sem_telefone: "Cliente não tem telefone cadastrado — impossível preparar contato.",
  tentativa_ja_registrada_hoje: "Já existe uma tentativa registrada hoje para esta cobrança — evita duplicidade.",
};

function hojeStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { clinica_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id } = body;
  if (!clinica_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "cobranca.tentativa", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: cobranca, error: erroBusca } = await admin
    .from("cobrancas")
    .select("*")
    .eq("id", id)
    .eq("clinica_id", clinica_id)
    .maybeSingle<Cobranca>();

  if (erroBusca || !cobranca) {
    logOperacao({ operacao: "cobranca.tentativa", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "cobranca nao encontrada nesta clinica" });
    return NextResponse.json({ sucesso: false, error: "Cobrança não encontrada" }, { status: 404 });
  }

  const hoje = hojeStr();
  const chaveIdempotencia = `${id}:cobranca.tentativa:${hoje}`;

  const { data: tentativaExistente } = await admin
    .from("eventos_dominio")
    .select("id")
    .eq("clinica_id", clinica_id)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();

  const elegibilidade = elegivelParaTentativaCobranca(cobranca, hoje, !!tentativaExistente);
  if (!elegibilidade.elegivel) {
    logOperacao({ operacao: "cobranca.tentativa", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: elegibilidade.motivo });
    return NextResponse.json(
      { sucesso: false, error: MOTIVO_MENSAGEM[elegibilidade.motivo] ?? elegibilidade.motivo },
      { status: MOTIVO_HTTP[elegibilidade.motivo] ?? 400 }
    );
  }

  const dias = diasAtraso(cobranca.vencimento, hoje);
  const mensagem = prepararMensagemCobranca(cobranca, dias);
  const agora = new Date().toISOString();

  // Auditoria das Decisões da IA V1 — mesmo padrão já instrumentado em
  // app/api/follow-up/tentativa/route.ts (motor "cobrador-digital" já
  // fazia parte do vocabulário conhecido em lib/auditoria-decisoes.ts,
  // mas nunca tinha sido de fato instrumentado). Evidência estruturada
  // real (dias de atraso + status), nunca a mensagem/narrativa. Best-
  // effort: falha aqui nunca bloqueia a tentativa real do usuário.
  const registroAuditoria = prepararRegistroAuditoria({
    clinicaId: clinica_id,
    motor: "cobrador-digital",
    versaoRegra: "motor-cobranca-v1",
    tipoDecisao: "cobranca_atrasada",
    entidadeTipo: "cobranca",
    entidadeId: id,
    clienteId: cobranca.paciente_id || (cobranca.paciente_telefone ? cobranca.paciente_telefone.replace(/\D/g, "") : null),
    sinaisUtilizados: [
      { campo: "dias_atraso", valor: dias },
      { campo: "status_cobranca", valor: cobranca.status },
    ],
    decisao: "registrar_contato",
    observadoEm: agora,
  });
  if (registroAuditoria) {
    const { error: erroAuditoria } = await admin.from("eventos_dominio").insert({
      clinica_id,
      tipo: registroAuditoria.tipoEvento,
      entidade_tipo: registroAuditoria.entidadeTipo,
      entidade_id: registroAuditoria.entidadeId,
      chave_idempotencia: registroAuditoria.chaveIdempotencia,
      payload: registroAuditoria.payload,
      criado_em: agora,
    });
    if (erroAuditoria && !/duplicate|unique/i.test(erroAuditoria.message ?? "")) {
      logOperacao({ operacao: "auditoria.decisao", clinica_id, entidade_id: id, resultado: "erro", motivo: `evidencia nao gravada: ${erroAuditoria.message}` });
    }
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: "cobranca.tentativa",
    entidade_tipo: "cobranca",
    entidade_id: id,
    chave_idempotencia: chaveIdempotencia,
    payload: {
      canal: mensagem.canal,
      telefone: cobranca.paciente_telefone,
      valor: cobranca.valor,
      vencimento: cobranca.vencimento,
      dias_atraso: dias,
      mensagem: mensagem.texto,
      status_tentativa: "preparada",
      resultado: null, // nunca enviado nesta versão — sem gate de autonomia/consentimento ainda
    },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "cobranca.tentativa", clinica_id, entidade_id: id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
    return NextResponse.json({ sucesso: false, error: "Não foi possível registrar a tentativa" }, { status: 500 });
  }

  logOperacao({ operacao: "cobranca.tentativa", clinica_id, entidade_id: id, resultado: "sucesso", motivo: `tentativa preparada, ${dias} dias de atraso` });
  return NextResponse.json({
    sucesso: true,
    modo: "preparatorio",
    aviso: "Nenhum WhatsApp foi enviado — mensagem preparada e registrada, envio real depende de autorização futura.",
    canal: mensagem.canal,
    mensagem: mensagem.texto,
  });
}
