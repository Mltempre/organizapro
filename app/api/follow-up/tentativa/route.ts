// POST /api/follow-up/tentativa — prepara e registra uma tentativa de
// follow-up comercial (Follow-up Comercial Inteligente V1). Rota
// autenticada de staff, ação humana explícita — nenhuma automação chama
// esta rota. Escopo: só os 5 tipos SEM dono hoje (oportunidade_parada,
// orcamento_parado, tratamento_sem_retorno, pedido_nao_concluido,
// recompra_possivel) — cobranca_atrasada usa POST /api/cobrancas/[id]/
// tentativa (Cobrador
// Digital V1) e os sinais de Agenda Autônoma usam sua própria ação
// (POST .../confirmar); esta rota nunca aceita esses tipos.
//
// Modo estritamente PREPARATÓRIO nesta versão: nunca chama o adaptador
// de envio real (POST /api/whatsapp, Z-API). Mesmo gate de autonomia/
// consentimento ainda inexistente já documentado no Cobrador Digital V1.
//
// Fail-closed: a entidade é sempre relida do banco (nunca confia no que
// o client mandou) e reavaliada pela MESMA função pura que gera a lista
// (gerarFollowUpsComerciais, com uma entrada de um item só) — se ela não
// aparecer mais como elegível, a tentativa é rejeitada. Nenhuma segunda
// implementação da regra de elegibilidade.
//
// Idempotência: reaproveita public.eventos_dominio (mesmo padrão já
// usado por orcamentos/tratamentos/pedidos/cobrancas) — a chave de
// idempotência inclui a data (AAAA-MM-DD), então no máximo uma
// tentativa por caso por dia é registrada.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { logOperacao } from "../../../../lib/log-estruturado";
import { prepararMensagemFollowUp, type TipoFollowUpProprio } from "../../../../lib/follow-up-comercial";
import { reavaliarCasoFollowUp } from "../../../../lib/follow-up-persistencia";
import { prepararRegistroAuditoria } from "../../../../lib/auditoria-decisoes";
import { entidadeIdDeTelefone } from "../../../../lib/whatsapp-governado";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TIPOS_VALIDOS: TipoFollowUpProprio[] = ["oportunidade_parada", "orcamento_parado", "tratamento_sem_retorno", "pedido_nao_concluido", "recompra_possivel"];

// oportunidade_parada e recompra_possivel usam telefone normalizado como
// "id de caso" (ver lib/follow-up-comercial.ts, comentário do tipo
// CasoFollowUp.entidadeId) — mas eventos_dominio.entidade_id é uuid NOT
// NULL, nunca aceitaria o texto bruto do telefone. Descoberto durante a
// missão WhatsApp Governado V1 (que lê estes mesmos eventos para decidir
// se pode aprovar um envio): entidadeIdParaEvento deriva um uuid estável a
// partir do telefone real, sem fabricar nenhum dado novo — o texto do
// telefone continua real no payload, só a COLUNA passa a ser válida.
function entidadeIdParaEvento(tipo: TipoFollowUpProprio, entidadeId: string, clinica_id: string): string {
  return tipo === "oportunidade_parada" || tipo === "recompra_possivel"
    ? entidadeIdDeTelefone(clinica_id, entidadeId)
    : entidadeId;
}

function hojeStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; tipo?: string; entidade_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, tipo, entidade_id } = body;
  if (!clinica_id || !tipo || !entidade_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, tipo e entidade_id são obrigatórios" }, { status: 400 });
  }
  if (!TIPOS_VALIDOS.includes(tipo as TipoFollowUpProprio)) {
    return NextResponse.json({ sucesso: false, error: `tipo deve ser um de: ${TIPOS_VALIDOS.join(", ")} (cobrança e agenda têm fluxo próprio)` }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "followup.tentativa", clinica_id, entidade_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const hoje = hojeStr();
  const agora = new Date().toISOString();
  const chaveIdempotencia = `${entidade_id}:followup.tentativa:${hoje}`;

  const { data: tentativaExistente } = await admin
    .from("eventos_dominio")
    .select("id")
    .eq("clinica_id", clinica_id)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();
  if (tentativaExistente) {
    return NextResponse.json({ sucesso: false, error: "Já existe uma tentativa registrada hoje para este caso — evita duplicidade." }, { status: 409 });
  }

  const caso = await reavaliarCasoFollowUp(admin, tipo as TipoFollowUpProprio, entidade_id, clinica_id, hoje, agora);
  if (!caso) {
    logOperacao({ operacao: "followup.tentativa", clinica_id, entidade_id, resultado: "rejeitado", motivo: "caso não é mais elegível (dado real mudou)" });
    return NextResponse.json({ sucesso: false, error: "Este caso não está mais elegível — o dado real já mudou (resolvido, avançou ou não encontrado)." }, { status: 409 });
  }

  const mensagem = prepararMensagemFollowUp(tipo as TipoFollowUpProprio, caso.pacienteNome, caso.motivo);

  // Auditoria das Decisões da IA V1 — evidência estruturada de POR QUE
  // este caso foi considerado elegível, nunca a narrativa/mensagem (que
  // é apresentação, não fonte). sinaisUtilizados vem só de campos que o
  // motor puro já calculou (tipo, status, dono do fluxo) — nenhum texto
  // livre, nenhum raciocínio de modelo. Falha ao registrar auditoria
  // nunca bloqueia a tentativa em si (evidência é best-effort, a ação
  // real do usuário não pode depender dela).
  const registroAuditoria = prepararRegistroAuditoria({
    clinicaId: clinica_id,
    motor: "follow-up-comercial",
    versaoRegra: "follow-up-comercial-v1",
    tipoDecisao: caso.tipo,
    entidadeTipo: caso.entidadeTipo,
    entidadeId: entidadeIdParaEvento(tipo as TipoFollowUpProprio, caso.entidadeId, clinica_id),
    clienteId: caso.telefone ? caso.telefone.replace(/\D/g, "") : null,
    sinaisUtilizados: [
      { campo: "tipo_caso", valor: caso.tipo },
      { campo: "status_elegibilidade", valor: caso.status },
      { campo: "dono_do_fluxo", valor: caso.donoDoFluxo },
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
      logOperacao({ operacao: "auditoria.decisao", clinica_id, entidade_id, resultado: "erro", motivo: `evidencia nao gravada: ${erroAuditoria.message}` });
    }
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: "followup.tentativa",
    entidade_tipo: caso.entidadeTipo,
    entidade_id: entidadeIdParaEvento(tipo as TipoFollowUpProprio, entidade_id, clinica_id),
    chave_idempotencia: chaveIdempotencia,
    payload: {
      tipo_followup: tipo,
      telefone: caso.telefone,
      motivo: caso.motivo,
      mensagem: mensagem.texto,
      canal: mensagem.canal,
      status_tentativa: "preparada",
      resultado: null, // nunca enviado nesta versão — sem gate de autonomia/consentimento ainda
    },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "followup.tentativa", clinica_id, entidade_id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
    return NextResponse.json({ sucesso: false, error: "Não foi possível registrar a tentativa" }, { status: 500 });
  }

  logOperacao({ operacao: "followup.tentativa", clinica_id, entidade_id, resultado: "sucesso", motivo: `tentativa de ${tipo} preparada` });
  return NextResponse.json({
    sucesso: true,
    modo: "preparatorio",
    aviso: "Nenhum WhatsApp foi enviado — mensagem preparada e registrada, envio real depende de autorização futura.",
    canal: mensagem.canal,
    mensagem: mensagem.texto,
  });
}
