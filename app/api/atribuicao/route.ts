import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autorizarUsuarioNaClinica } from '../../../lib/auth-clinica';
import { carregarRelatorioAtribuicao } from '../../../lib/atribuicao-dados';
import { CONEXOES_ADS_V1 } from '../../../lib/ads-contratos';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get('clinica_id');
  if (!clinicaId) return NextResponse.json({ error: 'Negócio obrigatório' }, { status: 400 });
  const auth = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const dados = await carregarRelatorioAtribuicao(admin, clinicaId);
    return NextResponse.json({ ...dados, conexoes: CONEXOES_ADS_V1 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (erro) {
    const schemaPendente = erro instanceof Error && erro.message === 'ATRIBUICAO_SCHEMA_PENDENTE';
    return NextResponse.json({ indisponivel: true, schemaPendente,
      error: schemaPendente ? 'Estrutura de atribuição ainda não disponível. Homologação de banco necessária.' : 'Não foi possível obter todas as fontes. Nenhum total parcial foi apresentado.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
