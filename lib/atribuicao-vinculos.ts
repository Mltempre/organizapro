import type { SupabaseClient } from '@supabase/supabase-js';
import { TIPOS_VINCULO_ATRIBUICAO, type TipoVinculoAtribuicao, type VinculoAtribuicao } from './atribuicao-relatorio';

const TABELAS: Record<TipoVinculoAtribuicao, string> = {
  cliente: 'pacientes', oportunidade: 'oportunidades_demanda', agendamento: 'agendamentos',
  orcamento: 'orcamentos', pedido: 'pedidos', cobranca: 'cobrancas',
};
const uuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export function validarVinculoAtribuicao(v: unknown): v is VinculoAtribuicao {
  if (!v || typeof v !== 'object') return false;
  const p = v as VinculoAtribuicao;
  return uuid(p.origemId) && uuid(p.entidadeId) && TIPOS_VINCULO_ATRIBUICAO.includes(p.entidadeTipo)
    && typeof p.evidencia === 'string' && p.evidencia.trim().length >= 10 && p.evidencia.length <= 500
    && ['codigo_site', 'declaracao_operador'].includes(p.metodo);
}

export async function registrarVinculoAtribuicao(admin: SupabaseClient, clinicaId: string, v: VinculoAtribuicao, userId: string | null) {
  if (!validarVinculoAtribuicao(v)) return { ok: false, status: 400, error: 'Vínculo ou evidência inválidos' };
  const [origem, entidade] = await Promise.all([
    admin.from('origem_captacoes').select('id').eq('clinica_id', clinicaId).eq('id', v.origemId).maybeSingle(),
    admin.from(TABELAS[v.entidadeTipo]).select('id').eq('clinica_id', clinicaId).eq('id', v.entidadeId).maybeSingle(),
  ]);
  if (origem.error || entidade.error) return { ok: false, status: 503, error: 'Não foi possível validar as referências' };
  if (!origem.data || !entidade.data) return { ok: false, status: 404, error: 'Referência não encontrada neste negócio' };
  // Uma origem explícita por entidade. Replay da mesma origem não sobrescreve
  // evidência, autoria ou método; disputa por outra origem retorna conflito.
  const chave = `atribuicao.vinculo:v1:${v.entidadeTipo}:${v.entidadeId}`;
  const { error } = await admin.from('eventos_dominio').insert({
    clinica_id: clinicaId, tipo: 'atribuicao.vinculo', entidade_tipo: v.entidadeTipo, entidade_id: v.entidadeId,
    chave_idempotencia: chave, payload: { ...v, usuarioId: userId, versao: 1 }, criado_em: new Date().toISOString(),
  });
  if (!error) return { ok: true, status: 201 };
  if (error.code !== '23505') return { ok: false, status: 503, error: 'Não foi possível registrar a evidência' };
  const { data, error: erroReplay } = await admin.from('eventos_dominio').select('payload').eq('clinica_id', clinicaId).eq('chave_idempotencia', chave).maybeSingle();
  if (erroReplay) return { ok: false, status: 503, error: 'Não foi possível verificar a evidência existente' };
  return data?.payload?.origemId === v.origemId
    ? { ok: true, status: 200 }
    : { ok: false, status: 409, error: 'A entidade já possui outra origem registrada; não foi sobrescrita' };
}

// Chamado somente após a criação/replay da entidade pela rota pública.
// Ausência/falha de atribuição não desfaz o pedido/interesse comercial.
export async function vincularOrigemPublica(admin: SupabaseClient, clinicaId: string, codigo: unknown, tipo: 'pedido' | 'oportunidade', id: string) {
  if (typeof codigo !== 'string' || !/^[a-z0-9]{6,20}$/i.test(codigo)) return false;
  try {
    const { data, error } = await admin.from('origem_captacoes').select('id').eq('clinica_id', clinicaId).eq('codigo_rastreio', codigo).maybeSingle();
    if (error || !data) return false;
    const resultado = await registrarVinculoAtribuicao(admin, clinicaId, {
      origemId: data.id, entidadeTipo: tipo, entidadeId: id,
      metodo: 'codigo_site', evidencia: 'Código de captura retornado no formulário público da entidade.',
    }, null);
    return resultado.ok;
  } catch { return false; }
}
