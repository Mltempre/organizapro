import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { podeRegistrarClique, validarLinkDestino } from "@/lib/motor-reputacao";

// ── Redirect rastreado de solicitação de avaliação ───────────────────────
// Ver docs/google-presenca-reputacao-ads-v1-arquitetura.md, Fase 3 e
// lib/motor-reputacao.ts. Rota pública por natureza (o clique vem de fora,
// de um link enviado por WhatsApp) — sem Authorization, mesmo padrão de
// app/api/webhook/zapi/route.ts.
//
// AINDA NÃO LIGADA A DADO REAL: depende das colunas `codigo_rastreio` e
// `link_destino` em `avaliacoes`, propostas na migration da seção 11.2 do
// documento de arquitetura e NÃO executadas nesta sessão. Até a migration
// rodar e o cron de avaliações passar a gerar esses códigos, esta rota
// sempre cai no fallback (erro de coluna inexistente → redirect seguro
// para "/"), sem quebrar nada que já funciona hoje.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const destinoSeguro = new URL("/", req.url);

  try {
    const { data: solicitacao, error } = await supabase
      .from("avaliacoes")
      .select("id, link_destino, clicado_em")
      .eq("codigo_rastreio", codigo)
      .maybeSingle();

    if (error || !solicitacao || !validarLinkDestino(solicitacao.link_destino)) {
      return NextResponse.redirect(destinoSeguro);
    }

    // Idempotente: só grava no primeiro clique (proteção dupla — na leitura
    // via podeRegistrarClique, e no próprio UPDATE via .is("clicado_em", null),
    // que também cobre a corrida de dois cliques quase simultâneos).
    if (podeRegistrarClique({ clicadoEm: solicitacao.clicado_em })) {
      await supabase
        .from("avaliacoes")
        .update({ clicado_em: new Date().toISOString() })
        .eq("id", solicitacao.id)
        .is("clicado_em", null);
    }

    return NextResponse.redirect(solicitacao.link_destino);
  } catch {
    return NextResponse.redirect(destinoSeguro);
  }
}
