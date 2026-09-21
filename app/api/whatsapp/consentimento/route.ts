// GET/POST /api/whatsapp/consentimento — representa e consulta o estado
// de consentimento de um contato (permitido / bloqueado / desconhecido),
// peça que faltava para o WhatsApp Governado V1 (nenhuma tabela/coluna de
// consentimento existia antes desta missão — auditado). Nenhuma migration:
// reaproveita eventos_dominio, indexando o telefone via um uuid
// determinístico (lib/whatsapp-governado.entidadeIdDeTelefone) já que
// entidade_id é uuid NOT NULL. Ação humana explícita (staff autenticado);
// o webhook (app/api/webhook/zapi/route.ts) também pode gravar aqui
// quando detecta uma palavra-chave de opt-out — nunca é automático além
// disso.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { logOperacao } from "../../../../lib/log-estruturado";
import {
  entidadeIdDeTelefone, estadoConsentimentoAtual, chaveIdempotenciaConsentimento,
  normalizarTelefone,
} from "../../../../lib/whatsapp-governado";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  const telefone = req.nextUrl.searchParams.get("telefone");
  if (!clinicaId || !telefone) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e telefone são obrigatórios" }, { status: 400 });
  }
  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) {
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const entidadeId = entidadeIdDeTelefone(clinicaId, telefone);
  const { data: eventos } = await admin.from("eventos_dominio").select("payload, criado_em")
    .eq("clinica_id", clinicaId).eq("entidade_tipo", "contato_whatsapp").eq("entidade_id", entidadeId).eq("tipo", "whatsapp.consentimento");
  const estado = estadoConsentimentoAtual(
    (eventos ?? []).map((e) => ({ criadoEm: e.criado_em as string, estado: (e.payload as { estado: "permitido" | "bloqueado" }).estado }))
  );
  return NextResponse.json({ sucesso: true, estado });
}

export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; telefone?: string; estado?: string; idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, telefone, estado, idempotency_key } = body;
  if (!clinica_id || !telefone || !estado || !idempotency_key) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, telefone, estado e idempotency_key são obrigatórios" }, { status: 400 });
  }
  if (estado !== "permitido" && estado !== "bloqueado") {
    return NextResponse.json({ sucesso: false, error: "estado deve ser 'permitido' ou 'bloqueado'" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "whatsapp.consentimento", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const entidadeId = entidadeIdDeTelefone(clinica_id, telefone);
  const chaveIdempotencia = chaveIdempotenciaConsentimento(entidadeId, idempotency_key);

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id, tipo: "whatsapp.consentimento", entidade_tipo: "contato_whatsapp", entidade_id: entidadeId,
    chave_idempotencia: chaveIdempotencia,
    payload: { telefone: normalizarTelefone(telefone), estado },
    criado_em: new Date().toISOString(),
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "whatsapp.consentimento", clinica_id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
    return NextResponse.json({ sucesso: false, error: "Não foi possível registrar o consentimento" }, { status: 500 });
  }

  logOperacao({ operacao: "whatsapp.consentimento", clinica_id, resultado: "sucesso", motivo: `contato marcado como ${estado}` });
  return NextResponse.json({ sucesso: true, estado });
}
