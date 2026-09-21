// POST /api/google-business-profile/posts — publica um post real no
// Google Business Profile (Bloco 6, Google Presença/Posts). O TEXTO já
// foi preparado pelo cliente via /api/ia (mesmo endpoint reutilizado
// para o rascunho de avaliações) e revisado/aprovado por um humano antes
// de chegar aqui — esta rota nunca gera conteúdo, só publica o que foi
// aprovado. Sem agendamento nesta V1 (nenhum suporte existente a
// scheduler foi encontrado no precheck — não construído para não
// aumentar escopo sem necessidade real comprovada).
//
// Idempotência por chave gerada pelo cliente, mesmo padrão do Bloco 5.
// Erro do Google nunca vira sucesso.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { logOperacao } from "../../../../lib/log-estruturado";
import { assertGoogleEnv, decifrarRefreshToken } from "../../../../lib/google-business-profile";
import { obterAccessTokenValido, publicarPostGoogle } from "../../../../lib/google-business-profile-api";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; texto?: string; idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, texto, idempotency_key } = body;
  if (!clinica_id || !texto?.trim() || !idempotency_key) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, texto e idempotency_key são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "gbp.post", clinica_id, entidade_id: idempotency_key, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const chaveIdempotencia = `${clinica_id}:gbp.post_publicado:${idempotency_key}`;
  const { data: jaPublicado } = await admin
    .from("eventos_dominio")
    .select("id")
    .eq("clinica_id", clinica_id)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();
  if (jaPublicado) {
    return NextResponse.json({ sucesso: false, error: "Este post já foi publicado — evita duplicidade." }, { status: 409 });
  }

  const { data: conexao } = await admin
    .from("google_business_profile_connections")
    .select("google_location_name, refresh_token_ciphertext")
    .eq("clinica_id", clinica_id)
    .maybeSingle();
  if (!conexao || !conexao.google_location_name) {
    return NextResponse.json({ sucesso: false, error: "Nenhuma conexão Google ativa para esta clínica" }, { status: 409 });
  }

  let accessToken: string;
  try {
    const config = assertGoogleEnv();
    const refreshToken = decifrarRefreshToken(conexao.refresh_token_ciphertext, config.encryptionSecret);
    accessToken = await obterAccessTokenValido(refreshToken, config);
  } catch (e) {
    return NextResponse.json({ sucesso: false, error: e instanceof Error ? e.message : "Integração Google indisponível" }, { status: 503 });
  }

  let resultado;
  try {
    resultado = await publicarPostGoogle(accessToken, conexao.google_location_name, texto.trim());
  } catch (e) {
    await admin.from("eventos_dominio").insert({
      clinica_id, tipo: "gbp.post_publicado", entidade_tipo: "post_google", entidade_id: idempotency_key,
      chave_idempotencia: chaveIdempotencia,
      payload: { resultado: "falhou", motivo: e instanceof Error ? e.message : "erro desconhecido" },
      criado_em: new Date().toISOString(),
    });
    logOperacao({ operacao: "gbp.post", clinica_id, entidade_id: idempotency_key, resultado: "erro", motivo: e instanceof Error ? e.message : "falha ao publicar post" });
    return NextResponse.json({ sucesso: false, error: e instanceof Error ? e.message : "Falha ao publicar no Google" }, { status: 502 });
  }

  await admin.from("eventos_dominio").insert({
    clinica_id, tipo: "gbp.post_publicado", entidade_tipo: "post_google", entidade_id: idempotency_key,
    chave_idempotencia: chaveIdempotencia,
    payload: { resultado: "sucesso", texto: texto.trim(), google_post_name: resultado.name },
    criado_em: new Date().toISOString(),
  });

  logOperacao({ operacao: "gbp.post", clinica_id, entidade_id: idempotency_key, resultado: "sucesso", motivo: "post publicado no Google" });
  return NextResponse.json({ sucesso: true });
}
