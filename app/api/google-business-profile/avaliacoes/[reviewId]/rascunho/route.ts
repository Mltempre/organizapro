// POST /api/google-business-profile/avaliacoes/[reviewId]/rascunho —
// salva um rascunho de resposta para uma avaliação real do Google. O
// TEXTO já foi gerado pelo cliente chamando /api/ia diretamente (mesmo
// endpoint já usado por app/conteudo/page.tsx) ou digitado manualmente
// pela equipe — esta rota nunca chama IA, só persiste o texto real via
// eventos_dominio (mesmo padrão já usado 5 vezes nesta sessão).
//
// Fail-closed: nunca salva rascunho vazio, nunca salva para uma
// avaliação já respondida no Google (relido antes de aceitar).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../../lib/log-estruturado";
import { assertGoogleEnv, chaveIdempotenciaRascunhoAvaliacao, decifrarRefreshToken } from "../../../../../../lib/google-business-profile";
import { obterAccessTokenValido, buscarAvaliacoesGoogle } from "../../../../../../lib/google-business-profile-api";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;

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
    logOperacao({ operacao: "gbp.rascunho", clinica_id, entidade_id: reviewId, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: conexao } = await admin
    .from("google_business_profile_connections")
    .select("google_location_name, refresh_token_ciphertext")
    .eq("clinica_id", clinica_id)
    .maybeSingle();
  if (!conexao || !conexao.google_location_name) {
    return NextResponse.json({ sucesso: false, error: "Nenhuma conexão Google ativa para esta clínica" }, { status: 409 });
  }

  // Fail-closed: relê a avaliação real antes de aceitar o rascunho — se
  // já foi respondida no Google (por qualquer caminho), nunca aceita um
  // rascunho novo para ela.
  try {
    const config = assertGoogleEnv();
    const refreshToken = decifrarRefreshToken(conexao.refresh_token_ciphertext, config.encryptionSecret);
    const accessToken = await obterAccessTokenValido(refreshToken, config);
    const avaliacoes = await buscarAvaliacoesGoogle(accessToken, conexao.google_location_name);
    const avaliacao = avaliacoes.find((a) => a.reviewId === reviewId);
    if (!avaliacao) {
      return NextResponse.json({ sucesso: false, error: "Avaliação não encontrada — pode ter sido removida" }, { status: 404 });
    }
    if (avaliacao.temRespostaGoogle) {
      return NextResponse.json({ sucesso: false, error: "Esta avaliação já foi respondida no Google" }, { status: 409 });
    }
  } catch (e) {
    logOperacao({ operacao: "gbp.rascunho", clinica_id, entidade_id: reviewId, resultado: "erro", motivo: e instanceof Error ? e.message : "falha ao revalidar avaliação" });
    return NextResponse.json({ sucesso: false, error: "Não foi possível confirmar o estado real da avaliação no Google" }, { status: 503 });
  }

  const chaveIdempotencia = chaveIdempotenciaRascunhoAvaliacao(reviewId, idempotency_key);
  const agora = new Date().toISOString();
  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: "gbp.resposta_rascunho",
    entidade_tipo: "avaliacao_google",
    entidade_id: reviewId,
    chave_idempotencia: chaveIdempotencia,
    payload: { texto: texto.trim() },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "gbp.rascunho", clinica_id, entidade_id: reviewId, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
    return NextResponse.json({ sucesso: false, error: "Não foi possível salvar o rascunho" }, { status: 500 });
  }

  logOperacao({ operacao: "gbp.rascunho", clinica_id, entidade_id: reviewId, resultado: "sucesso", motivo: "rascunho salvo" });
  return NextResponse.json({ sucesso: true, estado: "resposta_preparada" });
}
