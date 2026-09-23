import { reservarOperacao, finalizarOperacao } from "../../../../../lib/seguranca-operacoes";
// POST /api/cobrancas/[id]/aprovar-envio — Bloco APROVAR do WhatsApp
// Governado V1: fecha o elo que faltava depois de POST /api/cobrancas/[id]/
// tentativa (Cobrador Digital V1, que só prepara e nunca envia). Um humano
// autenticado aprova explicitamente o envio de uma cobrança já preparada
// hoje, e só então o adaptador real (POST /api/whatsapp, Z-API, inalterado)
// é chamado. Nunca automático: esta rota só aceita autorizarUsuarioNaClinica
// (usuário real), nunca o segredo de serviço interno — nenhum cron/webhook
// pode chamar isto.
//
// Revalida tudo no momento da chamada: cobrança relida do banco (nunca
// confia no que a tela mandou), elegibilidade real (mesma função pura do
// Cobrador Digital), tentativa "preparada" de hoje precisa existir,
// consentimento do contato não pode estar bloqueado. Falha do provider
// nunca vira sucesso; um envio com sucesso hoje bloqueia um novo envio no
// mesmo dia (evita duplicidade), mas uma falha permite nova tentativa no
// mesmo dia com uma nova idempotency_key (gerada pelo cliente a cada
// clique, mesmo padrão de app/cobrancas/page.tsx).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import { elegivelParaTentativaCobranca, prepararMensagemCobranca, diasAtraso, type Cobranca } from "../../../../../lib/motor-cobranca";
import {
  entidadeIdDeTelefone, estadoConsentimentoAtual, podeAprovarEnvio,
  mensagemMotivoBloqueioEnvio, chaveIdempotenciaEnvioAprovado,
  type EstadoConsentimento,
} from "../../../../../lib/whatsapp-governado";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function hojeStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { clinica_id?: string; idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }
  const { clinica_id, idempotency_key } = body;
  if (!clinica_id || !idempotency_key) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e idempotency_key são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "cobranca.aprovar_envio", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: cobranca, error: erroBusca } = await admin
    .from("cobrancas").select("*").eq("id", id).eq("clinica_id", clinica_id).maybeSingle<Cobranca>();
  if (erroBusca || !cobranca) {
    logOperacao({ operacao: "cobranca.aprovar_envio", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "cobranca nao encontrada nesta clinica" });
    return NextResponse.json({ sucesso: false, error: "Cobrança não encontrada" }, { status: 404 });
  }

  const hoje = hojeStr();

  const elegibilidade = elegivelParaTentativaCobranca(cobranca, hoje, false);
  if (!elegibilidade.elegivel) {
    logOperacao({ operacao: "cobranca.aprovar_envio", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: elegibilidade.motivo });
    return NextResponse.json({ sucesso: false, error: `A cobrança não está mais elegível (${elegibilidade.motivo}) — prepare novamente.` }, { status: 409 });
  }

  const { data: tentativaHoje } = await admin.from("eventos_dominio").select("id")
    .eq("clinica_id", clinica_id).eq("chave_idempotencia", `${id}:cobranca.tentativa:${hoje}`).maybeSingle();

  const { data: enviosHoje } = await admin.from("eventos_dominio").select("payload")
    .eq("clinica_id", clinica_id).eq("entidade_tipo", "cobranca").eq("entidade_id", id).eq("tipo", "cobranca.envio");
  const jaEnviadoComSucessoHoje = (enviosHoje ?? []).some((e) => {
    const p = e.payload as { dia?: string; resultado?: string };
    return p.dia === hoje && p.resultado === "sucesso";
  });

  const telefone = cobranca.paciente_telefone;
  let consentimento: EstadoConsentimento = "desconhecido";
  if (telefone) {
    const entidadeIdTelefone = entidadeIdDeTelefone(clinica_id, telefone);
    const { data: eventosConsentimento } = await admin.from("eventos_dominio").select("payload, criado_em")
      .eq("clinica_id", clinica_id).eq("entidade_tipo", "contato_whatsapp").eq("entidade_id", entidadeIdTelefone).eq("tipo", "whatsapp.consentimento");
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
    logOperacao({ operacao: "cobranca.aprovar_envio", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: decisao.motivo });
    return NextResponse.json({ sucesso: false, error: mensagemMotivoBloqueioEnvio(decisao.motivo) }, { status: 409 });
  }

  const chaveEnvio = chaveIdempotenciaEnvioAprovado("cobranca.envio", id, idempotency_key);
  const { data: mesmaChave } = await admin.from("eventos_dominio").select("id")
    .eq("clinica_id", clinica_id).eq("chave_idempotencia", chaveEnvio).maybeSingle();
  if (mesmaChave) {
    return NextResponse.json({ sucesso: false, error: "Este envio já foi solicitado — evita duplicidade." }, { status: 409 });
  }

  const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;
  if (!internalServiceSecret) {
    logOperacao({ operacao: "cobranca.aprovar_envio", clinica_id, entidade_id: id, resultado: "erro", motivo: "INTERNAL_SERVICE_SECRET ausente" });
    return NextResponse.json({ sucesso: false, error: "Serviço de envio indisponível por configuração interna." }, { status: 503 });
  }

  const dias = diasAtraso(cobranca.vencimento, hoje);
  const mensagem = prepararMensagemCobranca(cobranca, dias);

  const operacao = `cobranca:${id}:${hoje}`;
  const reserva = await reservarOperacao(admin, clinica_id, operacao, JSON.stringify([telefone, mensagem.texto]), true);
  if (!reserva) return NextResponse.json({ sucesso: false, error: "Envio reservado ou persistência indisponível; verifique antes de repetir" }, { status: 409 });
  let rejeitadoAntesDoEnvio = false;
  const baseUrl = new URL(req.url).origin;
  let zapiOk = false;
  let motivoFalha: string | null = null;
  try {
    const r = await fetch(`${baseUrl}/api/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${internalServiceSecret}` },
      body: JSON.stringify({ clinica_id, telefone, mensagem: mensagem.texto, operacao }),
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
  if (!finalizado) return NextResponse.json({ sucesso: false, error: "Resultado não persistido; não repita sem verificar" }, { status: 503 });
  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id, tipo: "cobranca.envio", entidade_tipo: "cobranca", entidade_id: id,
    chave_idempotencia: chaveEnvio,
    payload: { dia: hoje, telefone, mensagem: mensagem.texto, resultado: zapiOk ? "sucesso" : rejeitadoAntesDoEnvio ? "falhou" : "incerto", motivo: zapiOk ? null : motivoFalha },
    criado_em: new Date().toISOString(),
  });
  if (erroEvento) return NextResponse.json({ sucesso: false, error: "Registro do resultado indisponível; verifique antes de repetir" }, { status: 503 });

  if (!zapiOk) {
    logOperacao({ operacao: "cobranca.aprovar_envio", clinica_id, entidade_id: id, resultado: "erro", motivo: motivoFalha ?? "falha ao enviar" });
    return NextResponse.json({ sucesso: false, error: "Envio não confirmado — verifique o resultado antes de repetir." }, { status: 502 });
  }

  logOperacao({ operacao: "cobranca.aprovar_envio", clinica_id, entidade_id: id, resultado: "sucesso", motivo: "envio aprovado e realizado" });
  return NextResponse.json({ sucesso: true, enviado: true });
}
