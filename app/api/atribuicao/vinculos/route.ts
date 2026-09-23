import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autorizarUsuarioNaClinica } from '../../../../lib/auth-clinica';
import { registrarVinculoAtribuicao } from '../../../../lib/atribuicao-vinculos';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export async function POST(req: NextRequest) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!body || typeof body.clinica_id !== 'string') return NextResponse.json({ error: 'Negócio obrigatório' }, { status: 400 });
  const auth = await autorizarUsuarioNaClinica(req, body.clinica_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const resultado = await registrarVinculoAtribuicao(admin, body.clinica_id, {
    origemId: body.origemId, entidadeTipo: body.entidadeTipo, entidadeId: body.entidadeId,
    evidencia: body.evidencia, metodo: 'declaracao_operador',
  }, auth.userId);
  return NextResponse.json(resultado, { status: resultado.status });
}
