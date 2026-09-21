// GET /api/google-business-profile/locations — lista as contas e
// localizações Google realmente acessíveis pelo usuário autorizado
// (Bloco 2). Complementa o OAuth: a conexão em si (oauth/callback)
// continua selecionando automaticamente a primeira conta/localização
// (mesmo comportamento já existente, documentado como simplificação de
// V1 — a maioria dos negócios tem uma única localização); esta rota
// existe para permitir, numa tela futura, mostrar/confirmar o que seria
// vinculado antes ou depois da conexão, sem exigir uma migration nova
// (o schema atual guarda só uma localização por clínica).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { assertGoogleEnv, decifrarRefreshToken } from "../../../../lib/google-business-profile";
import { obterAccessTokenValido, listarContasGoogle, listarLocalizacoesGoogle } from "../../../../lib/google-business-profile-api";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  if (!clinicaId) return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });

  const { data: conexao, error: erroConexao } = await admin
    .from("google_business_profile_connections")
    .select("refresh_token_ciphertext")
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (erroConexao) return NextResponse.json({ sucesso: false, error: "Migration da conexão Google ainda não disponível" }, { status: 503 });
  if (!conexao) return NextResponse.json({ sucesso: true, conectado: false, contas: [] });

  try {
    const config = assertGoogleEnv();
    const refreshToken = decifrarRefreshToken(conexao.refresh_token_ciphertext, config.encryptionSecret);
    const accessToken = await obterAccessTokenValido(refreshToken, config);
    const contas = await listarContasGoogle(accessToken);
    const comLocalizacoes = await Promise.all(
      contas.map(async (conta) => ({ ...conta, localizacoes: await listarLocalizacoesGoogle(accessToken, conta.name) }))
    );
    return NextResponse.json({ sucesso: true, conectado: true, indisponivel: false, contas: comLocalizacoes });
  } catch (e) {
    return NextResponse.json({ sucesso: true, conectado: true, indisponivel: true, motivo: e instanceof Error ? e.message : "Não foi possível listar contas/localizações no Google", contas: [] });
  }
}
