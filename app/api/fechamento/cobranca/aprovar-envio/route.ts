// Contador IA — Fechamento Inteligente V1.
// POST /api/fechamento/cobranca/aprovar-envio — Bloco APROVAR: um humano
// autenticado aprova o envio de uma cobrança de documentos já preparada
// hoje, e só então o adaptador real (POST /api/whatsapp, Z-API,
// inalterado) é chamado. Nunca automático — mesmo desenho de
// app/api/cobrancas/[id]/aprovar-envio e app/api/follow-up/aprovar-envio.
//
// Revalida TUDO no momento da aprovação (nunca confia na tentativa
// antiga): recalcula a prontidão fresca — se o cliente resolveu tudo
// entre a tentativa e agora, a aprovação é recusada (nunca cobra
// novamente documento já resolvido).

import { reservarOperacao, finalizarOperacao } from "../../../../../lib/seguranca-operacoes";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import {
  competenciaValida, calcularFechamentoCliente, pendenciasCobraveis, gerarMensagemCobrancaFechamento,
  type TipoDocumentoConfig, type ExcecaoClienteConfig, type DocumentoRegistrado,
} from "../../../../../lib/fechamento-contabil";
import {
  entidadeIdDeTelefone, estadoConsentimentoAtual, podeAprovarEnvio,
  mensagemMotivoBloqueioEnvio, chaveIdempotenciaEnvioAprovado, type EstadoConsentimento,
} from "../../../../../lib/whatsapp-governado";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function hojeStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; cliente_id?: string; competencia?: string; idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, cliente_id, competencia, idempotency_key } = body;
  if (!clinica_id || !cliente_id || !competencia || !idempotency_key) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, cliente_id, competencia e idempotency_key são obrigatórios" }, { status: 400 });
  }
  if (!competenciaValida(competencia)) {
    return NextResponse.json({ sucesso: false, error: "competencia deve estar no formato AAAA-MM" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "fechamento.cobranca.aprovar_envio", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: cliente } = await admin.from("pacientes").select("id, nome, telefone, whatsapp").eq("id", cliente_id).eq("clinica_id", clinica_id).maybeSingle();
  if (!cliente) {
    return NextResponse.json({ sucesso: false, error: "Cliente não encontrado nesta clínica" }, { status: 404 });
  }

  const hoje = hojeStr();

  // Recalcula a prontidão AGORA — nunca confia na tentativa antiga.
  const consultas = await Promise.all([
    admin.from("fechamento_tipos_documento").select("nome, obrigatorio, ativo").eq("clinica_id", clinica_id),
    admin.from("fechamento_excecoes_cliente").select("cliente_id, tipo_documento, incluido").eq("clinica_id", clinica_id).eq("cliente_id", cliente_id),
    admin.from("fechamento_documentos").select("cliente_id, tipo_documento, status").eq("clinica_id", clinica_id).eq("cliente_id", cliente_id).eq("competencia", competencia),
  ]);
  if (consultas.some(r => r.error)) return NextResponse.json({ sucesso: false, error: "Não foi possível verificar as pendências. Nenhum envio realizado." }, { status: 503 });
  const [{ data: tiposRows }, { data: excecoesRows }, { data: documentosRows }] = consultas;
  const tipos: TipoDocumentoConfig[] = (tiposRows ?? []).map((t) => ({ nome: t.nome, obrigatorio: t.obrigatorio, ativo: t.ativo }));
  const excecoes: ExcecaoClienteConfig[] = (excecoesRows ?? []).map((e) => ({ clienteId: e.cliente_id, tipoDocumento: e.tipo_documento, incluido: e.incluido }));
  const documentos: DocumentoRegistrado[] = (documentosRows ?? []).map((d) => ({ clienteId: d.cliente_id, tipoDocumento: d.tipo_documento, status: d.status }));
  const resumoCliente = calcularFechamentoCliente({ id: cliente.id, nome: cliente.nome }, tipos, documentos, excecoes);
  const pendencias = pendenciasCobraveis(resumoCliente.checklist);

  if (pendencias.length === 0) {
    logOperacao({ operacao: "fechamento.cobranca.aprovar_envio", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: "cliente ja resolveu tudo desde a tentativa — nunca cobra item ja resolvido" });
    return NextResponse.json({ sucesso: false, error: "Este cliente já resolveu todas as pendências desde a tentativa — nada a cobrar agora." }, { status: 409 });
  }

  const chaveTentativa = `${cliente_id}:fechamento.cobranca_tentativa:${competencia}:${hoje}`;
  const { data: tentativaHoje, error: erroTentativa } = await admin.from("eventos_dominio").select("id").eq("clinica_id", clinica_id).eq("chave_idempotencia", chaveTentativa).maybeSingle();

  const { data: enviosHoje, error: erroEnvios } = await admin.from("eventos_dominio").select("payload")
    .eq("clinica_id", clinica_id).eq("entidade_tipo", "cliente").eq("entidade_id", cliente_id).eq("tipo", "fechamento.cobranca_envio");
  if (erroTentativa || erroEnvios) return NextResponse.json({ sucesso: false, error: "Histórico de envio indisponível." }, { status: 503 });
  const jaEnviadoComSucessoHoje = (enviosHoje ?? []).some((e) => {
    const p = e.payload as { dia?: string; competencia?: string; resultado?: string };
    return p.dia === hoje && p.competencia === competencia && p.resultado === "sucesso";
  });

  const telefone = cliente.whatsapp || cliente.telefone;
  let consentimento: EstadoConsentimento = "desconhecido";
  if (telefone) {
    const entidadeIdTelefone = entidadeIdDeTelefone(clinica_id, telefone);
    const { data: eventosConsentimento, error: erroConsentimento } = await admin.from("eventos_dominio").select("payload, criado_em")
      .eq("clinica_id", clinica_id).eq("entidade_tipo", "contato_whatsapp").eq("entidade_id", entidadeIdTelefone).eq("tipo", "whatsapp.consentimento");
    if (erroConsentimento) return NextResponse.json({ sucesso: false, error: "Consentimento indisponível." }, { status: 503 });
    consentimento = estadoConsentimentoAtual(
      (eventosConsentimento ?? []).map((e) => ({ criadoEm: e.criado_em as string, estado: (e.payload as { estado: "permitido" | "bloqueado" }).estado }))
    );
  }

  const decisao = podeAprovarEnvio({
    telefone,
    statusTentativa: !tentativaHoje ? null : jaEnviadoComSucessoHoje ? "enviada" : "preparada",
    consentimento,
  });
  if (!decisao.pode) {
    logOperacao({ operacao: "fechamento.cobranca.aprovar_envio", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: decisao.motivo });
    return NextResponse.json({ sucesso: false, error: mensagemMotivoBloqueioEnvio(decisao.motivo) }, { status: 409 });
  }

  const chaveEnvio = chaveIdempotenciaEnvioAprovado("fechamento.cobranca_envio", `${cliente_id}:${competencia}`, idempotency_key);
  const { data: mesmaChave } = await admin.from("eventos_dominio").select("id").eq("clinica_id", clinica_id).eq("chave_idempotencia", chaveEnvio).maybeSingle();
  if (mesmaChave) {
    return NextResponse.json({ sucesso: false, error: "Este envio já foi solicitado — evita duplicidade." }, { status: 409 });
  }

  const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;
  if (!internalServiceSecret) {
    logOperacao({ operacao: "fechamento.cobranca.aprovar_envio", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: "INTERNAL_SERVICE_SECRET ausente" });
    return NextResponse.json({ sucesso: false, error: "Serviço de envio indisponível por configuração interna." }, { status: 503 });
  }

  const mensagem = gerarMensagemCobrancaFechamento(cliente.nome, competencia, pendencias);
  // Identidade derivada no servidor; trocar a chave do browser não libera reenvio.
  const operacao = `fechamento:${cliente_id}:${competencia}:${hoje}`;
  const reserva = await reservarOperacao(admin, clinica_id, operacao, JSON.stringify([telefone, mensagem]), true);
  if (!reserva) return NextResponse.json({ sucesso: false, error: "Envio reservado ou persistência indisponível; verifique antes de repetir." }, { status: 409 });
  let rejeitadoAntesDoEnvio = false;
  const baseUrl = new URL(req.url).origin;
  let zapiOk = false;
  let motivoFalha: string | null = null;
  try {
    const r = await fetch(`${baseUrl}/api/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${internalServiceSecret}` },
      body: JSON.stringify({ clinica_id, telefone, mensagem, operacao }),
    });
    zapiOk = r.ok;
    if (!zapiOk) {
      const j = await r.json().catch(() => null);
      rejeitadoAntesDoEnvio = (j as { nao_enviado?: boolean } | null)?.nao_enviado === true;
      motivoFalha = "Serviço de envio recusou a operação";
    }
  } catch {
    zapiOk = false;
    motivoFalha = "Resultado desconhecido após falha de comunicação";
  }

  const finalizado = await finalizarOperacao(admin, reserva, zapiOk ? "sucesso" : rejeitadoAntesDoEnvio ? "rejeitado" : "incerto");
  if (!finalizado) return NextResponse.json({ sucesso: false, error: "Resultado não persistido; não repita sem verificar." }, { status: 503 });
  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id, tipo: "fechamento.cobranca_envio", entidade_tipo: "cliente", entidade_id: cliente_id,
    chave_idempotencia: chaveEnvio,
    payload: { dia: hoje, competencia, telefone, pendencias, mensagem, resultado: zapiOk ? "sucesso" : rejeitadoAntesDoEnvio ? "falhou" : "incerto", motivo: zapiOk ? null : motivoFalha },
    criado_em: new Date().toISOString(),
  });
  if (erroEvento) return NextResponse.json({ sucesso: false, error: "Registro do resultado indisponível; verifique antes de repetir." }, { status: 503 });

  if (!zapiOk) {
    logOperacao({ operacao: "fechamento.cobranca.aprovar_envio", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: motivoFalha ?? "falha ao enviar" });
    return NextResponse.json({ sucesso: false, error: "Envio não confirmado — verifique o resultado antes de repetir." }, { status: 502 });
  }

  logOperacao({ operacao: "fechamento.cobranca.aprovar_envio", clinica_id, entidade_id: cliente_id, resultado: "sucesso", motivo: "envio aprovado e realizado" });
  return NextResponse.json({ sucesso: true, enviado: true });
}
