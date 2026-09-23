import type { SupabaseClient } from '@supabase/supabase-js';
import { gerarRelatorioCampanhas, type CaptacaoAtribuicao, type EntidadeAtribuicao, type VinculoAtribuicao } from './atribuicao-relatorio';
import { validarVinculoAtribuicao } from './atribuicao-vinculos';
import type { EntradaLinhaEconomica } from './linha-economica';

// Paginação explícita. Falha de qualquer domínio impede totais parciais.
export async function lerFonteAtribuicao<T>(admin: SupabaseClient, clinicaId: string, tabela: string, colunas: string, tipoEvento?: string): Promise<T[]> {
  const rows: T[] = [];
  for (let inicio = 0; inicio < 10000; inicio += 500) {
    let query = admin.from(tabela).select(colunas).eq('clinica_id', clinicaId).order('id').range(inicio, inicio + 499);
    if (tipoEvento) query = query.eq('tipo', tipoEvento);
    const { data, error } = await query;
    if (error) throw new Error(['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code) ? 'ATRIBUICAO_SCHEMA_PENDENTE' : 'ATRIBUICAO_FONTE_INDISPONIVEL');
    rows.push(...(data as unknown as T[] || []));
    if (!data || data.length < 500) return rows;
  }
  throw new Error('ATRIBUICAO_LIMITE_EXCEDIDO');
}
type Op = { id: string; canal: EntradaLinhaEconomica['oportunidades'][number]['canal']; status: EntradaLinhaEconomica['oportunidades'][number]['status']; orcamento_vinculado_id: string | null; paciente_vinculado_id: string | null; agendamento_vinculado_id: string | null; nome_informado: string | null };
type Orc = { id: string; status: EntradaLinhaEconomica['orcamentos'][number]['status']; valor: number; apresentado_em: string; decidido_em: string | null; paciente_nome: string };
type Trat = { id: string; status: EntradaLinhaEconomica['tratamentos'][number]['status']; orcamento_origem_id: string | null };
type Cob = { id: string; status: EntradaLinhaEconomica['cobrancas'][number]['status']; paciente_nome: string; tratamento_origem_id: string | null; valor: number; valor_pago: number | null; vencimento: string; pago_em: string | null; em_cobranca_em: string | null };
type Ped = { id: string; status: EntradaLinhaEconomica['pedidos'][number]['status']; nome_cliente: string; valor_centavos: number; pagamento_confirmado_em: string | null };
type Origem = { id: string; paciente_id: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; gclid: string | null; fbclid: string | null; referrer_host: string | null; capturado_em: string; identificadores_ads: CaptacaoAtribuicao['identificadores'] };

export async function carregarRelatorioAtribuicao(admin: SupabaseClient, clinicaId: string) {
  const [origensDB, eventos, ops, orcs, trats, cobs, peds, clientes, agenda] = await Promise.all([
    lerFonteAtribuicao<Origem>(admin, clinicaId, 'origem_captacoes', 'id,paciente_id,utm_source,utm_medium,utm_campaign,utm_content,gclid,fbclid,referrer_host,capturado_em,identificadores_ads'),
    lerFonteAtribuicao<{ payload: VinculoAtribuicao }>(admin, clinicaId, 'eventos_dominio', 'id,payload', 'atribuicao.vinculo'),
    lerFonteAtribuicao<Op>(admin, clinicaId, 'oportunidades_demanda', 'id,canal,status,orcamento_vinculado_id,paciente_vinculado_id,agendamento_vinculado_id,nome_informado'),
    lerFonteAtribuicao<Orc>(admin, clinicaId, 'orcamentos', 'id,status,valor,apresentado_em,decidido_em,paciente_nome'),
    lerFonteAtribuicao<Trat>(admin, clinicaId, 'tratamentos', 'id,status,orcamento_origem_id'),
    lerFonteAtribuicao<Cob>(admin, clinicaId, 'cobrancas', 'id,status,paciente_nome,tratamento_origem_id,valor,valor_pago,vencimento,pago_em,em_cobranca_em'),
    lerFonteAtribuicao<Ped>(admin, clinicaId, 'pedidos', 'id,status,nome_cliente,valor_centavos,pagamento_confirmado_em'),
    lerFonteAtribuicao<{ id: string; nome: string }>(admin, clinicaId, 'pacientes', 'id,nome'),
    lerFonteAtribuicao<{ id: string; paciente_nome: string }>(admin, clinicaId, 'agendamentos', 'id,paciente_nome'),
  ]);
  const origens: CaptacaoAtribuicao[] = origensDB.map(o => ({ id: o.id, pacienteId: o.paciente_id, utmSource: o.utm_source, utmMedium: o.utm_medium, utmCampaign: o.utm_campaign, utmContent: o.utm_content, gclid: o.gclid, fbclid: o.fbclid, referrerHost: o.referrer_host, capturadoEm: o.capturado_em, identificadores: o.identificadores_ads }));
  const economica: EntradaLinhaEconomica = {
    oportunidades: ops.map(o => ({ id: o.id, canal: o.canal, status: o.status, orcamentoVinculadoId: o.orcamento_vinculado_id })),
    orcamentos: orcs.map(o => ({ id: o.id, status: o.status, valor: o.valor, apresentadoEm: o.apresentado_em, decididoEm: o.decidido_em })),
    tratamentos: trats.map(t => ({ id: t.id, status: t.status, orcamentoOrigemId: t.orcamento_origem_id })),
    cobrancas: cobs.map(c => ({ id: c.id, status: c.status, pacienteNome: c.paciente_nome, tratamentoOrigemId: c.tratamento_origem_id, valor: c.valor, valorPago: c.valor_pago, vencimento: c.vencimento, pagoEm: c.pago_em, emCobrancaEm: c.em_cobranca_em })),
    pedidos: peds.map(p => ({ id: p.id, status: p.status, pacienteNome: p.nome_cliente, valor: p.valor_centavos / 100, pagamentoConfirmadoEm: p.pagamento_confirmado_em })),
  };
  const entidades: EntidadeAtribuicao[] = [
    ...clientes.map(c => ({ tipo: 'cliente' as const, id: c.id, nome: c.nome })),
    ...ops.map(o => ({ tipo: 'oportunidade' as const, id: o.id, nome: o.nome_informado || 'Contato sem nome' })),
    ...agenda.map(a => ({ tipo: 'agendamento' as const, id: a.id, nome: a.paciente_nome })),
    ...orcs.map(o => ({ tipo: 'orcamento' as const, id: o.id, nome: o.paciente_nome })),
    ...peds.map(p => ({ tipo: 'pedido' as const, id: p.id, nome: p.nome_cliente })),
    ...cobs.map(c => ({ tipo: 'cobranca' as const, id: c.id, nome: c.paciente_nome })),
  ];
  const vinculos = eventos.map(e => e.payload).filter(validarVinculoAtribuicao);
  const relatorio = gerarRelatorioCampanhas({ origens, vinculos, economica, entidades,
    oportunidades: ops.map(o => ({ id: o.id, pacienteId: o.paciente_vinculado_id, agendamentoId: o.agendamento_vinculado_id })),
  });
  // Não retorna click IDs, códigos públicos de rastreio ou credenciais.
  return { relatorio, origens: origens.map(o => ({ id: o.id, campanha: o.identificadores?.campaign_id || o.utmCampaign, source: o.utmSource, capturadoEm: o.capturadoEm })), vinculos };
}
