// POST /api/follow-up/aprovar-envio — Bloco APROVAR do WhatsApp Governado
// V1 para os 5 tipos próprios do Follow-up Comercial Inteligente V1 (que
// só prepara via POST /api/follow-up/tentativa, nunca envia). Mesmo
// desenho de app/api/cobrancas/[id]/aprovar-envio: só um humano
// autenticado aprova, nunca automação; tudo é relido e revalidado no
// momento da chamada; falha do provider nunca vira sucesso; um envio com
// sucesso hoje bloqueia um novo envio no mesmo dia, mas uma falha permite
// nova tentativa no mesmo dia com uma nova idempotency_key.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { logOperacao } from "../../../../lib/log-estruturado";
import { prepararMensagemFollowUp, type TipoFollowUpProprio } from "../../../../lib/follow-up-comercial";
import { reavaliarCasoFollowUp } from "../../../../lib/follow-up-persistencia";
import {
  entidadeIdDeTelefone, estadoConsentimentoAtual, podeAprovarEnvio,
  mensagemMotivoBloqueioEnvio, chaveIdempotenciaEnvioAprovado,
  type EstadoConsentimento,
} from "../../../../lib/whatsapp-governado";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TIPOS_VALIDOS: TipoFollowUpProprio[] = ["oportunidade_parada", "orcamento_parado", "tratamento_sem_retorno", "pedido_nao_concluido", "recompra_possivel"];

function hojeStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// oportunidade_parada e recompra_possivel usam telefone normalizado como
// "id de caso" — eventos_dominio.entidade_id é uuid NOT NULL, nunca
// aceitaria o texto bruto (mesma correção aplicada em .../tentativa).
function entidadeIdParaEvento(tipo: TipoFollowUpProprio, entidadeId: string, clinica_id: string): string {
  return tipo === "oportunidade_parada" || tipo === "recompra_possivel"
    ? entidadeIdDeTelefone(clinica_id, entidadeId)
    : entidadeId;
}

export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; tipo?: string; entidade_id?: string; idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, tipo, entidade_id, idempotency_key } = body;
  if (!clinica_id || !tipo || !entidade_id || !idempotency_key) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, tipo, entidade_id e idempotency_key são obrigatórios" }, { status: 400 });
  }
  if (!TIPOS_VALIDOS.includes(tipo as TipoFollowUpProprio)) {
    return NextResponse.json({ sucesso: false, error: `tipo deve ser um de: ${TIPOS_VALIDOS.join(", ")}` }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "followup.aprovar_envio", clinica_id, entidade_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const hoje = hojeStr();
  const agora = new Date().toISOString();
  const tipoTyped = tipo as TipoFollowUpProprio;

  const caso = await reavaliarCasoFollowUp(admin, tipoTyped, entidade_id, clinica_id, hoje, agora);
  if (!caso) {
    logOperacao({ operacao: "followup.aprovar_envio", clinica_id, entidade_id, resultado: "rejeitado", motivo: "caso não é mais elegível (dado real mudou)" });
    return NextResponse.json({ sucesso: false, error: "Este caso não está mais elegível — o dado real já mudou (resolvido, avançou ou não encontrado)." }, { status: 409 });
  }

  const entidadeIdEvento = entidadeIdParaEvento(tipoTyped, entidade_id, clinica_id);

  const { data: tentativaHoje } = await admin.from("eventos_dominio").select("id")
    .eq("clinica_id", clinica_id).eq("chave_idempotencia", `${entidade_id}:followup.tentativa:${hoje}`).maybeSingle();

  const { data: enviosHoje } = await admin.from("eventos_dominio").select("payload")
    .eq("clinica_id", clinica_id).eq("entidade_tipo", caso.entidadeTipo).eq("entidade_id", entidadeIdEvento).eq("tipo", "followup.envio");
  const jaEnviadoComSucessoHoje = (enviosHoje ?? []).some((e) => {
    const p = e.payload as { dia?: string; resultado?: string };
    return p.dia === hoje && p.resultado === "sucesso";
  });

  let consentimento: EstadoConsentimento = "desconhecido";
  if (caso.telefone) {
    const entidadeIdTelefone = entidadeIdDeTelefone(clinica_id, caso.telefone);
    const { data: eventosConsentimento } = await admin.from("eventos_dominio").select("payload, criado_em")
      .eq("clinica_id", clinica_id).eq("entidade_tipo", "contato_whatsapp").eq("entidade_id", entidadeIdTelefone).eq("tipo", "whatsapp.consentimento");
    consentimento = estadoConsentimentoAtual(
      (eventosConsentimento ?? []).map((e) => ({ criadoEm: e.criado_em as string, estado: (e.payload as { estado: "permitido" | "bloqueado" }).estado }))
    );
  }

  const decisao = podeAprovarEnvio({
    telefone: caso.telefone,
    statusTentativa: !tentativaHoje ? null : jaEnviadoComSucessoHoje ? "enviada" : "preparada",
    consentimento,
  });
  if (!decisao.pode) {
    logOperacao({ operacao: "followup.aprovar_envio", clinica_id, entidade_id, resultado: "rejeitado", motivo: decisao.motivo });
    return NextResponse.json({ sucesso: false, error: mensagemMotivoBloqueioEnvio(decisao.motivo) }, { status: 409 });
  }

  const chaveEnvio = chaveIdempotenciaEnvioAprovado("followup.envio", entidadeIdEvento, idempotency_key);
  const { data: mesmaChave } = await admin.from("eventos_dominio").select("id")
    .eq("clinica_id", clinica_id).eq("chave_idempotencia", chaveEnvio).maybeSingle();
  if (mesmaChave) {
    return NextResponse.json({ sucesso: false, error: "Este envio já foi solicitado — evita duplicidade." }, { status: 409 });
  }

  const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;
  if (!internalServiceSecret) {
    logOperacao({ operacao: "followup.aprovar_envio", clinica_id, entidade_id, resultado: "erro", motivo: "INTERNAL_SERVICE_SECRET ausente" });
    return NextResponse.json({ sucesso: false, error: "Serviço de envio indisponível por configuração interna." }, { status: 503 });
  }

  const mensagem = prepararMensagemFollowUp(tipoTyped, caso.pacienteNome, caso.motivo);

  const baseUrl = new URL(req.url).origin;
  let zapiOk = false;
  let motivoFalha: string | null = null;
  try {
    const r = await fetch(`${baseUrl}/api/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${internalServiceSecret}` },
      body: JSON.stringify({ clinica_id, telefone: caso.telefone, mensagem: mensagem.texto }),
    });
    zapiOk = r.ok;
    if (!zapiOk) {
      const j = await r.json().catch(() => null);
      motivoFalha = (j as { error?: string } | null)?.error ?? `Z-API retornou status ${r.status}`;
    }
  } catch (e) {
    zapiOk = false;
    motivoFalha = e instanceof Error ? e.message : "falha de rede ao chamar /api/whatsapp";
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id, tipo: "followup.envio", entidade_tipo: caso.entidadeTipo, entidade_id: entidadeIdEvento,
    chave_idempotencia: chaveEnvio,
    payload: { dia: hoje, tipo_followup: tipoTyped, telefone: caso.telefone, mensagem: mensagem.texto, resultado: zapiOk ? "sucesso" : "falhou", motivo: zapiOk ? null : motivoFalha },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "followup.aprovar_envio", clinica_id, entidade_id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
  }

  if (!zapiOk) {
    logOperacao({ operacao: "followup.aprovar_envio", clinica_id, entidade_id, resultado: "erro", motivo: motivoFalha ?? "falha ao enviar" });
    return NextResponse.json({ sucesso: false, error: "Falha ao enviar pelo WhatsApp — tente novamente." }, { status: 502 });
  }

  logOperacao({ operacao: "followup.aprovar_envio", clinica_id, entidade_id, resultado: "sucesso", motivo: `envio de ${tipoTyped} aprovado e realizado` });
  return NextResponse.json({ sucesso: true, enviado: true });
}
