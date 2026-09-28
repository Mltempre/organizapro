import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autorizarUsuarioNaClinica } from '../../../lib/auth-clinica';
import { configuracaoMeta } from '../../../lib/meta-ads';
import { resumoMeta, ErroSchemaMetaAds } from '../../../lib/meta-ads-dados';

// GET /api/meta-ads?clinica_id= — estado honesto da conexão Meta Ads do
// TENANT da sessão + métricas de campanha somente quando conectado.
// Nunca devolve token/cifra; nunca fabrica métricas (falha externa →
// metricas:null + erroMetricas:true; tabela ausente → 503 indisponível,
// mesmo padrão de /api/atribuicao).
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get('clinica_id');
  if (!clinicaId) return NextResponse.json({ error: 'Negócio obrigatório' }, { status: 400 });
  const auth = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const resumo = await resumoMeta(admin, clinicaId, configuracaoMeta());
    return NextResponse.json(resumo, { headers: { 'Cache-Control': 'no-store' } });
  } catch (erro) {
    const schemaPendente = erro instanceof ErroSchemaMetaAds;
    return NextResponse.json({
      indisponivel: true,
      schemaPendente,
      error: schemaPendente
        ? 'A conexão Meta Ads ainda não está ativada para a sua conta. Nenhum dado foi lido.'
        : 'Não foi possível ler os dados da Meta agora. Nenhum total parcial foi apresentado.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}