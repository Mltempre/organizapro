// Contador IA — Fechamento Inteligente V1.
// POST /api/fechamento/cobranca/tentativa — prepara (nunca envia) uma
// mensagem de cobrança citando SOMENTE o que ainda falta para o cliente
// fechar a competência. Reaproveita 100% o modelo de governança já
// homologado (SUGERIR .../tentativa -> APROVAR .../aprovar-envio -> ENVIAR
// POST /api/whatsapp) — mesmo desenho de app/api/follow-up/tentativa e
// app/api/cobrancas/[id]/tentativa. Nenhum motor de WhatsApp novo.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import {
  competenciaValida, calcularFechamentoCliente, pendenciasCobraveis, gerarMensagemCobrancaFechamento,
  type TipoDocumentoConfig, type ExcecaoClienteConfig, type DocumentoRegistrado,
} from "../../../../../lib/fechamento-contabil";
import { prepararRegistroAuditoria } from "../../../../../lib/auditoria-decisoes";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function hojeStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; cliente_id?: string; competencia?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, cliente_id, competencia } = body;
  if (!clinica_id || !cliente_id || !competencia) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, cliente_id e competencia são obrigatórios" }, { status: 400 });
  }
  if (!competenciaValida(competencia)) {
    return NextResponse.json({ sucesso: false, error: "competencia deve estar no formato AAAA-MM" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "fechamento.cobranca.tentativa", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const hoje = hojeStr();
  const agora = new Date().toISOString();
  const chaveTentativa = `${cliente_id}:fechamento.cobranca_tentativa:${competencia}:${hoje}`;

  const { data: tentativaExistente } = await admin
    .from("eventos_dominio").select("id").eq("clinica_id", clinica_id).eq("chave_idempotencia", chaveTentativa).maybeSingle();
  if (tentativaExistente) {
    return NextResponse.json({ sucesso: false, error: "Já existe uma tentativa registrada hoje para este cliente/competência — evita duplicidade." }, { status: 409 });
  }

  const { data: cliente } = await admin.from("pacientes").select("id, nome, telefone, whatsapp").eq("id", cliente_id).eq("clinica_id", clinica_id).maybeSingle();
  if (!cliente) {
    return NextResponse.json({ sucesso: false, error: "Cliente não encontrado nesta clínica" }, { status: 404 });
  }

  const [{ data: tiposRows }, { data: excecoesRows }, { data: documentosRows }] = await Promise.all([
    admin.from("fechamento_tipos_documento").select("nome, obrigatorio, ativo").eq("clinica_id", clinica_id),
    admin.from("fechamento_excecoes_cliente").select("cliente_id, tipo_documento, incluido").eq("clinica_id", clinica_id).eq("cliente_id", cliente_id),
    admin.from("fechamento_documentos").select("cliente_id, tipo_documento, status").eq("clinica_id", clinica_id).eq("cliente_id", cliente_id).eq("competencia", competencia),
  ]);
  const tipos: TipoDocumentoConfig[] = (tiposRows ?? []).map((t) => ({ nome: t.nome, obrigatorio: t.obrigatorio, ativo: t.ativo }));
  const excecoes: ExcecaoClienteConfig[] = (excecoesRows ?? []).map((e) => ({ clienteId: e.cliente_id, tipoDocumento: e.tipo_documento, incluido: e.incluido }));
  const documentos: DocumentoRegistrado[] = (documentosRows ?? []).map((d) => ({ clienteId: d.cliente_id, tipoDocumento: d.tipo_documento, status: d.status }));

  const resumoCliente = calcularFechamentoCliente({ id: cliente.id, nome: cliente.nome }, tipos, documentos, excecoes);
  const pendencias = pendenciasCobraveis(resumoCliente.checklist);

  if (pendencias.length === 0) {
    logOperacao({ operacao: "fechamento.cobranca.tentativa", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: "cliente sem pendencia cobravel — ja pronto ou so em revisao" });
    return NextResponse.json({ sucesso: false, error: "Este cliente não tem pendência a cobrar — já está pronto para fechamento, ou os itens em aberto estão em revisão (não com o cliente)." }, { status: 409 });
  }

  const telefone = cliente.whatsapp || cliente.telefone;
  const mensagem = gerarMensagemCobrancaFechamento(cliente.nome, competencia, pendencias);

  // Auditoria das Decisões da IA — evidência estruturada de POR QUE este
  // cliente foi considerado cobrável, nunca a narrativa/mensagem em si.
  const registroAuditoria = prepararRegistroAuditoria({
    clinicaId: clinica_id,
    motor: "fechamento-contabil",
    versaoRegra: "fechamento-contabil-v1",
    tipoDecisao: "documento_pendente",
    entidadeTipo: "cliente",
    entidadeId: cliente_id,
    clienteId: cliente_id, // aqui SEMPRE um paciente_id real — nunca telefone
    sinaisUtilizados: [
      { campo: "competencia", valor: competencia },
      { campo: "pendencias_count", valor: pendencias.length },
      { campo: "status_cliente", valor: resumoCliente.status },
    ],
    decisao: "cobrar_pendencias",
    observadoEm: agora,
  });
  if (registroAuditoria) {
    const { error: erroAuditoria } = await admin.from("eventos_dominio").insert({
      clinica_id, tipo: registroAuditoria.tipoEvento, entidade_tipo: registroAuditoria.entidadeTipo,
      entidade_id: registroAuditoria.entidadeId, chave_idempotencia: registroAuditoria.chaveIdempotencia,
      payload: registroAuditoria.payload, criado_em: agora,
    });
    if (erroAuditoria && !/duplicate|unique/i.test(erroAuditoria.message ?? "")) {
      logOperacao({ operacao: "auditoria.decisao", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: `evidencia nao gravada: ${erroAuditoria.message}` });
    }
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id, tipo: "fechamento.cobranca_tentativa", entidade_tipo: "cliente", entidade_id: cliente_id,
    chave_idempotencia: chaveTentativa,
    payload: { competencia, telefone, pendencias, mensagem, status_tentativa: "preparada", resultado: null },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "fechamento.cobranca.tentativa", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
    return NextResponse.json({ sucesso: false, error: "Não foi possível registrar a tentativa" }, { status: 500 });
  }

  logOperacao({ operacao: "fechamento.cobranca.tentativa", clinica_id, entidade_id: cliente_id, resultado: "sucesso", motivo: `${pendencias.length} pendencia(s)` });
  return NextResponse.json({
    sucesso: true, modo: "preparatorio",
    aviso: "Nenhum WhatsApp foi enviado — mensagem preparada e registrada, envio real depende de aprovação.",
    pendencias, mensagem, telefone,
  });
}
