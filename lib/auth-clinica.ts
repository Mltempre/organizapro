// Autorização compartilhada para rotas autenticadas de staff — mesmo padrão
// já homologado e em produção no ClínicaFlow (lib/auth-clinica.ts de lá),
// replicado aqui como referência arquitetural para fechar o gate de
// segurança do chatbot (auditoria 2026-08-17): app/api/chatbot/config e
// app/api/chatbot/treinamento não tinham nenhuma autenticação.
//
// Nunca confia em clinica_id sozinho — sempre exige prova de vínculo ativo
// entre auth.uid() (derivado do token, nunca do body/query) e a clinica_id
// pedida, e confirma clinicas.produto = 'organizapro' (literal, nunca lido
// de input do cliente) antes de liberar.

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type AutorizacaoClinica =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string };

export async function autorizarUsuarioNaClinica(
  req: NextRequest,
  clinicaId: string
): Promise<AutorizacaoClinica> {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) {
    return { ok: false, status: 401, error: "Autenticação obrigatória" };
  }

  const { data: { user }, error: userErr } = await supabaseAnon.auth.getUser(bearer);
  if (userErr || !user) {
    return { ok: false, status: 401, error: "Sessão inválida ou expirada" };
  }

  const { data: vinculo } = await supabase
    .from("clinica_usuarios")
    .select("clinica_id")
    .eq("usuario_id", user.id)
    .eq("clinica_id", clinicaId)
    .eq("ativo", true)
    .maybeSingle();

  if (!vinculo) {
    return { ok: false, status: 403, error: "Usuário não tem vínculo com esta clínica" };
  }

  // 'organizapro' é literal — nunca lido do body, query string ou header.
  // produto ausente (NULL) ou diferente reprova com a mesma mensagem do
  // caso "sem vínculo", para não revelar a um chamador não autorizado se
  // o problema foi vínculo ou produto.
  const { data: clinica } = await supabase
    .from("clinicas")
    .select("produto")
    .eq("id", clinicaId)
    .maybeSingle();
  if (clinica?.produto !== "organizapro") {
    return { ok: false, status: 403, error: "Usuário não tem vínculo com esta clínica" };
  }

  return { ok: true, userId: user.id };
}
