import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { podeRegistrarClique, validarLinkDestino } from "../../../lib/motor-reputacao";

// ── Redirect rastreado de solicitação de avaliação ───────────────────────
// Ver lib/motor-reputacao.ts. Rota pública por natureza (o clique vem de
// fora, de um link enviado por WhatsApp) — sem Authorization, mesmo padrão
// de app/api/webhook/zapi/route.ts.
//
// CORRIGIDO contra o schema REAL (achado da auditoria desta convergência):
// a versão original desta rota (branch audit/smart-commerce-precheck)
// consultava colunas `codigo_rastreio`/`link_destino`, que NUNCA existiram
// em Production — o schema real usa `avaliacoes.codigo` (com
// avaliacoes_codigo_unico UNIQUE) e `avaliacoes.clicado_em`; não existe
// nenhuma coluna `link_destino`. O destino real do redirect é
// `clinica_config.link_google`, resolvido pelo `clinica_id` da própria
// solicitação — nunca um valor gravado na linha de avaliacoes.
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
      .select("id, clinica_id, clicado_em")
      .eq("codigo", codigo)
      .maybeSingle();

    if (error || !solicitacao) {
      return NextResponse.redirect(destinoSeguro);
    }

    const { data: config } = await supabase
      .from("clinica_config")
      .select("link_google")
      .eq("clinica_id", solicitacao.clinica_id)
      .maybeSingle();

    if (!validarLinkDestino(config?.link_google)) {
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

    return NextResponse.redirect(config!.link_google as string);
  } catch {
    return NextResponse.redirect(destinoSeguro);
  }
}
