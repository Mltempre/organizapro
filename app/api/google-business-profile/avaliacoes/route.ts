// GET /api/google-business-profile/avaliacoes — lista as avaliações reais
// da localização Google vinculada a esta clínica, já com o estado real
// (sem_resposta / resposta_preparada / respondida) calculado pela função
// pura estadoAvaliacaoGoogle. Nunca duplica avaliação entre sincronizações
// — usa reviewId (identificador estável do Google) como chave.
//
// Fail-closed: sem conexão Google, sem credenciais de ambiente, ou falha
// ao renovar o token, devolve um estado controlado (nunca quebra a rota,
// nunca finge dados).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../lib/auth-clinica";
import { assertGoogleEnv, decifrarRefreshToken, estadoAvaliacaoGoogle } from "../../../../lib/google-business-profile";
import { obterAccessTokenValido, buscarAvaliacoesGoogle } from "../../../../lib/google-business-profile-api";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id");
  if (!clinicaId) return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  const autorizacao = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!autorizacao.ok) return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });

  const { data: conexao, error: erroConexao } = await admin
    .from("google_business_profile_connections")
    .select("google_location_name, refresh_token_ciphertext")
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (erroConexao) return NextResponse.json({ sucesso: false, error: "Migration da conexão Google ainda não disponível" }, { status: 503 });
  if (!conexao || !conexao.google_location_name) return NextResponse.json({ sucesso: true, conectado: false, avaliacoes: [] });

  let config;
  try {
    config = assertGoogleEnv();
  } catch (e) {
    return NextResponse.json({ sucesso: true, conectado: true, indisponivel: true, motivo: e instanceof Error ? e.message : "Integração Google não configurada", avaliacoes: [] });
  }

  let accessToken: string;
  try {
    const refreshToken = decifrarRefreshToken(conexao.refresh_token_ciphertext, config.encryptionSecret);
    accessToken = await obterAccessTokenValido(refreshToken, config);
  } catch (e) {
    return NextResponse.json({ sucesso: true, conectado: true, indisponivel: true, motivo: e instanceof Error ? e.message : "Não foi possível renovar o acesso ao Google", avaliacoes: [] });
  }

  let avaliacoesGoogle;
  try {
    avaliacoesGoogle = await buscarAvaliacoesGoogle(accessToken, conexao.google_location_name);
  } catch (e) {
    return NextResponse.json({ sucesso: true, conectado: true, indisponivel: true, motivo: e instanceof Error ? e.message : "Não foi possível buscar avaliações no Google", avaliacoes: [] });
  }

  // Rascunhos locais — eventos_dominio já filtrado por clinica_id (tenant
  // isolation) e por tipo; o rascunho VIGENTE de cada avaliação é o mais
  // recente por criado_em (nunca acumula, mesmo princípio de
  // lib/memoria-proveniencia.ts fatoVigente).
  const { data: eventos } = await admin
    .from("eventos_dominio")
    .select("entidade_id, tipo, payload, criado_em")
    .eq("clinica_id", clinicaId)
    .in("tipo", ["gbp.resposta_rascunho"])
    .order("criado_em", { ascending: false });

  const rascunhoPorReview = new Map<string, string>();
  for (const evento of eventos ?? []) {
    if (!rascunhoPorReview.has(evento.entidade_id)) {
      const payload = evento.payload as { texto?: string };
      if (payload?.texto) rascunhoPorReview.set(evento.entidade_id, payload.texto);
    }
  }

  const avaliacoes = avaliacoesGoogle.map((av) => {
    const rascunho = rascunhoPorReview.get(av.reviewId) ?? null;
    const estado = estadoAvaliacaoGoogle({ temRespostaGoogle: av.temRespostaGoogle, temRascunhoLocal: !!rascunho });
    return {
      reviewId: av.reviewId,
      name: av.name, // caminho completo da API — necessário para publicar a resposta depois
      nota: av.nota,
      comentario: av.comentario,
      autor: av.autor,
      criadoEm: av.criadoEm,
      estado,
      respostaGoogle: av.respostaGoogleTexto,
      rascunhoLocal: estado === "resposta_preparada" ? rascunho : null,
    };
  });

  return NextResponse.json({ sucesso: true, conectado: true, indisponivel: false, avaliacoes });
}
