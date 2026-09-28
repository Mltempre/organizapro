// Liga/desliga das automações WhatsApp (lembretes e avaliações) por negócio.
// WhatsApp conectado ≠ automações ativas: salvar credenciais Z-API não libera
// os crons; só este ato explícito de um membro do próprio negócio libera.
// Estado append-only em eventos_dominio (ver lib/seguranca-operacoes.ts).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { automacoesWhatsappAtivas, registrarAutomacoesWhatsapp } from "../../../../lib/seguranca-operacoes";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const resposta = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  if (!clinicaId) return resposta({ error: "Negócio obrigatório" }, 400);
  const auth = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!auth.ok) return resposta({ error: auth.error }, auth.status);
  return resposta({ automacoes_ativas: await automacoesWhatsappAtivas(admin, clinicaId) });
}

export async function POST(req: NextRequest) {
  let body: { clinica_id?: unknown; ativas?: unknown; idempotency_key?: unknown };
  try { body = await req.json(); } catch { return resposta({ error: "JSON inválido" }, 400); }
  const { clinica_id, ativas, idempotency_key } = body ?? {};
  if (typeof clinica_id !== "string" || !clinica_id || typeof ativas !== "boolean"
    || typeof idempotency_key !== "string" || !idempotency_key || idempotency_key.length > 100) {
    return resposta({ error: "Negócio, estado e chave da operação são obrigatórios" }, 400);
  }
  const auth = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!auth.ok) return resposta({ error: auth.error }, auth.status);
  if (!await registrarAutomacoesWhatsapp(admin, clinica_id, ativas, auth.userId, idempotency_key)) {
    return resposta({ error: "Não foi possível alterar as automações agora. Nada foi alterado." }, 503);
  }
  console.info("[whatsapp/automacoes] estado alterado", { ativas });
  return resposta({ automacoes_ativas: await automacoesWhatsappAtivas(admin, clinica_id) });
}
