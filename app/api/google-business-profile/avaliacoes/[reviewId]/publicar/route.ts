// POST /api/google-business-profile/avaliacoes/[reviewId]/publicar —
// aprova e publica a resposta no Google (Bloco 5). Ação real e
// irreversível do lado do Google — protegida por: reautorização de
// tenant, revalidação do estado real (relido do Google, nunca do
// rascunho local) e idempotência por chave gerada pelo cliente.
//
// Erro do Google NUNCA vira sucesso: se a chamada de publicação falhar,
// a rota responde falha e registra "falhou" em eventos_dominio — nunca
// um "sucesso" otimista.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../../lib/log-estruturado";
import { assertGoogleEnv, chaveIdempotenciaPublicacaoAvaliacao, decifrarRefreshToken, podePublicarResposta } from "../../../../../../lib/google-business-profile";
import { obterAccessTokenValido, buscarAvaliacaoUnica, publicarRespostaGoogle } from "../../../../../../lib/google-business-profile-api";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;

  let body: { clinica_id?: string; texto?: string; idempotency_key?: string; review_name?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, texto, idempotency_key, review_name } = body;
  if (!clinica_id || !texto?.trim() || !idempotency_key || !review_name) {
    return NextResponse.json({ sucesso: false, error: "clinica_id, texto, review_name e idempotency_key são obrigatórios" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "gbp.publicar", clinica_id, entidade_id: reviewId, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const chaveIdempotencia = chaveIdempotenciaPublicacaoAvaliacao(reviewId, idempotency_key);
  const { data: jaPublicado } = await admin
    .from("eventos_dominio")
    .select("id")
    .eq("clinica_id", clinica_id)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();
  if (jaPublicado) {
    return NextResponse.json({ sucesso: false, error: "Esta publicação já foi solicitada — evita duplicidade." }, { status: 409 });
  }

  const { data: conexao } = await admin
    .from("google_business_profile_connections")
    .select("google_location_name, refresh_token_ciphertext")
    .eq("clinica_id", clinica_id)
    .maybeSingle();
  if (!conexao || !conexao.google_location_name) {
    return NextResponse.json({ sucesso: false, error: "Nenhuma conexão Google ativa para esta clínica" }, { status: 409 });
  }

  let config;
  let accessToken: string;
  try {
    config = assertGoogleEnv();
    const refreshToken = decifrarRefreshToken(conexao.refresh_token_ciphertext, config.encryptionSecret);
    accessToken = await obterAccessTokenValido(refreshToken, config);
  } catch (e) {
    return NextResponse.json({ sucesso: false, error: e instanceof Error ? e.message : "Integração Google indisponível" }, { status: 503 });
  }

  // Revalida o estado REAL, relido do Google agora — nunca confia no que
  // a tela mandou nem num rascunho local. Se já tem resposta, nunca
  // sobrescreve (mesmo que por engano/corrida com outra aba).
  let avaliacaoAtual;
  try {
    avaliacaoAtual = await buscarAvaliacaoUnica(accessToken, review_name);
  } catch (e) {
    logOperacao({ operacao: "gbp.publicar", clinica_id, entidade_id: reviewId, resultado: "erro", motivo: e instanceof Error ? e.message : "falha ao revalidar" });
    return NextResponse.json({ sucesso: false, error: "Não foi possível confirmar o estado atual da avaliação no Google" }, { status: 503 });
  }
  if (!avaliacaoAtual) {
    return NextResponse.json({ sucesso: false, error: "Avaliação não encontrada no Google — pode ter sido removida" }, { status: 404 });
  }
  const estadoReal = avaliacaoAtual.temRespostaGoogle ? "respondida" : "sem_resposta";
  if (!podePublicarResposta(estadoReal, texto)) {
    return NextResponse.json({ sucesso: false, error: "Esta avaliação já foi respondida — publicação cancelada para não sobrescrever." }, { status: 409 });
  }

  // Publica de fato. Falha real do Google é registrada como falha —
  // nunca convertida em sucesso.
  try {
    await publicarRespostaGoogle(accessToken, review_name, texto.trim());
  } catch (e) {
    await admin.from("eventos_dominio").insert({
      clinica_id, tipo: "gbp.resposta_publicada", entidade_tipo: "avaliacao_google", entidade_id: reviewId,
      chave_idempotencia: chaveIdempotencia,
      payload: { resultado: "falhou", motivo: e instanceof Error ? e.message : "erro desconhecido" },
      criado_em: new Date().toISOString(),
    });
    logOperacao({ operacao: "gbp.publicar", clinica_id, entidade_id: reviewId, resultado: "erro", motivo: e instanceof Error ? e.message : "falha ao publicar no Google" });
    return NextResponse.json({ sucesso: false, error: e instanceof Error ? e.message : "Falha ao publicar no Google" }, { status: 502 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id, tipo: "gbp.resposta_publicada", entidade_tipo: "avaliacao_google", entidade_id: reviewId,
    chave_idempotencia: chaveIdempotencia,
    payload: { resultado: "sucesso", texto: texto.trim() },
    criado_em: new Date().toISOString(),
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "gbp.publicar", clinica_id, entidade_id: reviewId, resultado: "erro", motivo: `evento nao gravado apos sucesso real: ${erroEvento.message}` });
    // A publicação JÁ aconteceu no Google (sucesso real) — não reverte,
    // só registra que a auditoria local falhou, nunca finge que a
    // publicação em si falhou.
  }

  logOperacao({ operacao: "gbp.publicar", clinica_id, entidade_id: reviewId, resultado: "sucesso", motivo: "resposta publicada no Google" });
  return NextResponse.json({ sucesso: true, estado: "respondida" });
}
