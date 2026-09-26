import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const campos = ["nome_clinica", "telefone", "email", "endereco", "logo_url", "link_google", "msg_lembrete", "msg_confirmacao", "msg_avaliacao", "msg_reagendamento", "horario_funcionamento", "zapi_instance"] as const;
const secretos = ["zapi_token", "zapi_client_token"] as const;
const selecao = [...campos, ...secretos].join(",");
const resposta = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function publica(row: Record<string, unknown> | null) {
  return {
    config: Object.fromEntries(campos.map(c => [c, typeof row?.[c] === "string" ? row[c] : ""])),
    zapi_configurado: !!(row?.zapi_instance && row?.zapi_token && row?.zapi_client_token),
  };
}

export async function GET(req: NextRequest) {
  try {
    const tenant = req.nextUrl.searchParams.get("clinica_id");
    if (!tenant) return resposta({ error: "Negócio obrigatório" }, 400);
    const auth = await autorizarUsuarioNaClinica(req, tenant);
    if (!auth.ok) return resposta({ error: auth.error }, auth.status);
    const { data, error } = await admin.from("clinica_config").select(selecao).eq("clinica_id", tenant).maybeSingle<Record<string, unknown>>();
    if (error) return resposta({ error: "Configuração indisponível" }, 503);
    return resposta(publica(data));
  } catch {
    return resposta({ error: "Configuração indisponível" }, 503);
  }
}

export async function PUT(req: NextRequest) {
  let body;
  try { body = await req.json(); } catch { return resposta({ error: "JSON inválido" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.clinica_id !== "string" || !body.clinica_id) return resposta({ error: "Negócio obrigatório" }, 400);
  try {
    const auth = await autorizarUsuarioNaClinica(req, body.clinica_id);
    if (!auth.ok) return resposta({ error: auth.error }, auth.status);
    const values: Record<string, string> = {};
    for (const c of [...campos, ...secretos]) {
      if (body[c] === undefined) continue;
      if (typeof body[c] !== "string" || body[c].length > 10000) return resposta({ error: "Campo inválido" }, 400);
      // Campo secreto vazio significa manter o valor persistido, nunca apagá-lo.
      if (secretos.includes(c as typeof secretos[number]) && !body[c].trim()) continue;
      values[c] = body[c];
    }
    if (values.link_google && !/^https?:\/\//i.test(values.link_google)) return resposta({ error: "Link inválido" }, 400);
    const { data: atual, error: leitura } = await admin.from("clinica_config").select("user_id").eq("clinica_id", body.clinica_id).maybeSingle();
    if (leitura) return resposta({ error: "Configuração indisponível" }, 503);
    const registro = { ...values, updated_at: new Date().toISOString() };
    const result = atual
      ? await admin.from("clinica_config").update(registro).eq("clinica_id", body.clinica_id).select(selecao).single<Record<string, unknown>>()
      : await admin.from("clinica_config").insert({ ...registro, clinica_id: body.clinica_id, user_id: auth.userId }).select(selecao).single<Record<string, unknown>>();
    if (result.error || !result.data) return resposta({ error: "Não foi possível salvar a configuração" }, 503);
    return resposta(publica(result.data));
  } catch {
    return resposta({ error: "Não foi possível salvar a configuração" }, 503);
  }
}
