import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { autorizarUsuarioNaClinica } from "./auth-clinica";
import { adminGoogle, conexaoGoogle, confirmarLocalizacao, falhaGoogle } from "./google-business-profile-context";
import { ErroGoogle } from "./google-business-profile-errors";
import { recursoAvaliacao } from "./google-business-profile-resources";
import { estadoAvaliacaoGoogle, podePublicarResposta } from "./google-business-profile";
import { listarContasGoogle, listarLocalizacoesGoogle, buscarAvaliacoesGoogle, buscarAvaliacaoUnica,
  publicarRespostaGoogle, publicarPostGoogle, buscarMetricasGoogle } from "./google-business-profile-api";
import { executarOperacaoGoogle } from "./google-business-profile-operations";

type Leitura = "status" | "avaliacoes" | "locations" | "metricas" | "desconectar";
export async function lerGoogle(req: NextRequest, tipo: Leitura) {
  try {
    const clinicaId = req.nextUrl.searchParams.get("clinica_id");
    if (!clinicaId) throw new ErroGoogle("ENTRADA");
    const auth = await autorizarUsuarioNaClinica(req, clinicaId);
    if (!auth.ok) return NextResponse.json({ sucesso: false, estado: "erro_recuperavel", error: auth.error }, { status: auth.status });
    if (tipo === "desconectar") {
      const { error } = await adminGoogle.from("google_business_profile_connections").delete().eq("clinica_id", clinicaId);
      if (error) throw new ErroGoogle("PERSISTENCIA");
      return NextResponse.json({ sucesso: true, estado: "desconectado", conectado: false });
    }
    const c = await conexaoGoogle(clinicaId);
    if (tipo === "status") {
      await confirmarLocalizacao(c);
      return NextResponse.json({ sucesso: true, estado: "conectado", conectado: true,
        conexao: { conta: c.account, local: c.local || c.location, conectadoEm: c.conectadoEm } });
    }
    if (tipo === "locations") {
      const contas = await listarContasGoogle(c.accessToken);
      const resultado = [];
      for (const conta of contas) resultado.push({ ...conta, localizacoes: await listarLocalizacoesGoogle(c.accessToken, conta.name) });
      return NextResponse.json({ sucesso: true, estado: "conectado", conectado: true, contas: resultado });
    }
    if (tipo === "metricas") {
      const fim = new Date().toISOString().slice(0, 10);
      const inicio = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const metricas = await buscarMetricasGoogle(c.accessToken, c.location,
        ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "CALL_CLICKS", "WEBSITE_CLICKS"], inicio, fim);
      return NextResponse.json({ sucesso: true, estado: "conectado", conectado: true, metricas });
    }
    const reviews = await buscarAvaliacoesGoogle(c.accessToken, c.parent);
    const { data: eventos, error } = await adminGoogle.from("eventos_dominio").select("entidade_id,payload,criado_em")
      .eq("clinica_id", clinicaId).eq("tipo", "gbp.resposta_rascunho").order("criado_em", { ascending: false });
    if (error) throw new ErroGoogle("PERSISTENCIA");
    const rascunhos = new Map<string, string>();
    for (const evento of eventos ?? []) {
      const p = evento.payload as { reviewName?: string; texto?: string };
      // Legado: somente reviewId; novos eventos usam resource name completo.
      const key = p.reviewName || evento.entidade_id;
      if (typeof p.texto === "string" && !rascunhos.has(key)) rascunhos.set(key, p.texto);
    }
    const avaliacoes = reviews.map((av) => {
      const texto = rascunhos.get(av.name) ?? rascunhos.get(av.reviewId) ?? null;
      return { ...av, estado: estadoAvaliacaoGoogle({ temRespostaGoogle: av.temRespostaGoogle, temRascunhoLocal: !!texto }),
        respostaGoogle: av.respostaGoogleTexto, rascunhoLocal: av.temRespostaGoogle ? null : texto };
    });
    return NextResponse.json({ sucesso: true, estado: "conectado", conectado: true, avaliacoes });
  } catch (error) {
    if (error instanceof ErroGoogle && error.codigo === "DESCONECTADO") {
      return NextResponse.json({ sucesso: true, estado: "desconectado", conectado: false, avaliacoes: [], contas: [], metricas: [] });
    }
    return falhaGoogle(error);
  }
}

export async function escreverGoogle(req: NextRequest, tipo: "rascunho" | "resposta" | "post", reviewId?: string) {
  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { throw new ErroGoogle("ENTRADA"); }
    if (!body || typeof body !== "object") throw new ErroGoogle("ENTRADA");
    const { clinica_id, texto, idempotency_key, review_name } = body;
    if (typeof clinica_id !== "string" || !clinica_id || typeof texto !== "string" || !texto.trim() || texto.length > 4096
      || typeof idempotency_key !== "string" || !idempotency_key || idempotency_key.length > 128) throw new ErroGoogle("ENTRADA");
    const auth = await autorizarUsuarioNaClinica(req, clinica_id);
    if (!auth.ok) return NextResponse.json({ sucesso: false, estado: "erro_recuperavel", error: auth.error }, { status: auth.status });
    const c = await conexaoGoogle(clinica_id);
    let recurso = c.parent;
    if (tipo !== "post") {
      try { recurso = recursoAvaliacao(c.parent, reviewId || ""); } catch { throw new ErroGoogle("RECURSO"); }
      if (tipo === "resposta" && review_name !== recurso) throw new ErroGoogle("RECURSO");
    }
    // Confirma membership Google e tenant antes de qualquer escrita externa.
    await confirmarLocalizacao(c);
    const resultado = await executarOperacaoGoogle(adminGoogle,
      { clinica: clinica_id, tipo, chave: idempotency_key, recurso, conteudo: texto.trim() }, async (iniciarEscrita) => {
        if (tipo === "post") {
          iniciarEscrita();
          const post = await publicarPostGoogle(c.accessToken, c.parent, texto.trim());
          return { sucesso: true, google_post_name: post.name, texto: texto.trim() };
        }
        const av = await buscarAvaliacaoUnica(c.accessToken, recurso);
        if (av.name !== recurso || av.reviewId !== reviewId) throw new ErroGoogle("RECURSO");
        if (!podePublicarResposta(av.temRespostaGoogle ? "respondida" : "sem_resposta", texto)) throw new ErroGoogle("JA_RESPONDIDA");
        if (tipo === "resposta") {
          iniciarEscrita();
          await publicarRespostaGoogle(c.accessToken, recurso, texto.trim());
        }
        return { sucesso: true, estado: tipo === "rascunho" ? "resposta_preparada" : "respondida", texto: texto.trim(), reviewId, reviewName: recurso };
      });
    return NextResponse.json(resultado);
  } catch (error) { return falhaGoogle(error); }
}
