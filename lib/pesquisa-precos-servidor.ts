import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { autorizarUsuarioNaClinica } from "./auth-clinica";

export const adminPesquisaPrecos = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anonPesquisaPrecos = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type TenantPesquisaPrecos =
  | { ok: true; clinicaId: string; userId: string }
  | { ok: false; status: 401 | 403 | 500; error: string };

// O tenant sempre nasce da sessão. As rotas de Pesquisa de Preços não
// aceitam clinica_id em query/body e, após resolver o vínculo, ainda
// reutilizam a autorização canônica do produto como segunda verificação.
export async function resolverTenantPesquisaPrecos(req: NextRequest): Promise<TenantPesquisaPrecos> {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) return { ok: false, status: 401, error: "Autenticação obrigatória" };

  const { data: { user }, error: userError } = await anonPesquisaPrecos.auth.getUser(bearer);
  if (userError || !user) return { ok: false, status: 401, error: "Sessão inválida ou expirada" };

  const { data: vinculos, error: vinculoError } = await adminPesquisaPrecos
    .from("clinica_usuarios")
    .select("clinica_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .limit(2);

  if (vinculoError) return { ok: false, status: 500, error: "Não foi possível validar o vínculo" };
  // Mais de um vínculo ativo é ambíguo sem um seletor canônico de tenant.
  // O V1 falha fechado em vez de escolher silenciosamente a primeira linha.
  if (!vinculos || vinculos.length !== 1) {
    return { ok: false, status: 403, error: "Não foi possível determinar um único negócio ativo" };
  }

  const clinicaId = vinculos[0].clinica_id as string;
  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (autorizacao.ok === false) return autorizacao;
  return { ok: true, clinicaId, userId: autorizacao.userId };
}
