'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { stTom, stTierOportunidade } from '../components/estilos-prioridade';
import { gerarOportunidadesClientes, type OportunidadeCliente } from '../../lib/oportunidades-clientes';
import { agregarClientesElegiveisRecompra } from '../../lib/motor-pedidos';
import { gerarFollowUpsComerciais, type CasoFollowUp } from '../../lib/follow-up-comercial';
import { agregarReceitaPerdida, type ResumoReceitaPerdida } from '../../lib/receita-perdida';
import { adaptarOportunidadesClientes, adaptarOportunidadesDemanda, organizarSinaisCanonicos, type SinalCanonico } from '../../lib/nucleo-inteligente';
import type { OportunidadeStatus } from '../../lib/oportunidades-demanda';

// ── Copiloto Administrativo AI V1 (P1.2) ─────────────────────────────────
// "O que precisa da minha atenção agora?" — nenhum motor novo, nenhuma
// regra de negócio nova: reaproveita literalmente os mesmos motores e as
// mesmas APIs já usados por app/dashboard, app/follow-up e
// app/receita-perdida (gerarOportunidadesClientes, organizarSinaisCanonicos,
// gerarFollowUpsComerciais, agregarReceitaPerdida). Este arquivo só busca
// os dados (mesmo padrão de fetch/filtro já estabelecido) e apresenta —
// nenhum número, prioridade ou recomendação é inventado aqui. Estado
// vazio honesto quando uma seção não tem dado real (nunca "0" fabricado
// para preencher espaço).
type ClienteSemProximoRow = { id: string; nome: string; telefone: string | null; whatsapp: string | null; proxima_consulta: string | null };
type CancelamentoSemReagendamentoRow = { id: string; nome: string; telefone: string | null; data: string };
type CanceladoRow = { id: string; paciente_nome: string; telefone: string | null; data: string };
type AgItem = { id: string; hora: string; paciente_nome: string; telefone?: string; status: string; data: string };
type OportunidadeRow = { id: string; telefone: string; nome_informado: string | null; status: OportunidadeStatus; orcamento_vinculado_id: string | null; ultima_interacao_em: string };
type OrcamentoRow = { id: string; paciente_nome: string; telefone: string | null; procedimento: string; valor: number; status: string; apresentado_em: string };
type TratamentoRow = { id: string; paciente_nome: string; paciente_telefone: string | null; tipo_tratamento: string; status: string; proxima_data_prevista: string | null; updated_at: string; interrompido_em: string | null; valor_estimado: number | null };
type PedidoRow = { id: string; nome_cliente: string; telefone: string | null; valor_centavos: number; status: string; criado_em: string; paciente_id: string | null; pagamento_confirmado_em: string | null; pedido_itens?: { descricao: string }[] };
type CobrancaRow = { id: string; paciente_nome: string; paciente_telefone: string | null; descricao: string; valor: number; vencimento: string; status: string };

const TIPO_FOLLOWUP_LABELS: Record<string, string> = {
  oportunidade_parada: 'Oportunidade parada', orcamento_parado: 'Orçamento parado',
  tratamento_sem_retorno: 'Tratamento sem retorno', pedido_nao_concluido: 'Pedido não concluído',
  recompra_possivel: 'Recompra possível',
};

function hojeStr() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }
function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

type Estado = {
  sinais: SinalCanonico[];
  followUpsPendentes: CasoFollowUp[];
  atrasados: AgItem[];
  pendentesConfirmacao: AgItem[];
  receitaPerdida: ResumoReceitaPerdida | null;
};

export default function CopilotoPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      const auth = { Authorization: `Bearer ${session.access_token}` };

      const cuRes = await fetch('/api/minha-clinica', { headers: auth });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      if (!cid) { setEstado(null); setErro('Negócio não vinculado ao usuário.'); setCarregando(false); return; }

      const hoje = hojeStr();
      const agora = new Date().toISOString();
      const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

      // Mesmas 5 APIs já usadas por app/follow-up e app/receita-perdida —
      // nenhuma consulta nova além das duas queries diretas ao Supabase
      // abaixo (clientes sem próximo compromisso / cancelamento sem
      // reagendar / agenda de hoje), mesmo padrão já usado em
      // app/dashboard/page.tsx.
      const [oportunidadesRes, orcamentosRes, tratamentosRes, pedidosRes, cobrancasRes, agHojeRes, semProximoRes, canceladosRes] = await Promise.all([
        fetch('/api/oportunidades', { headers: auth }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`/api/orcamentos?clinica_id=${cid}&status=apresentado`, { headers: auth }).then(r => r.ok ? r.json() : { orcamentos: [] }).catch(() => ({ orcamentos: [] })),
        fetch(`/api/tratamentos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { tratamentos: [] }).catch(() => ({ tratamentos: [] })),
        fetch(`/api/pedidos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { pedidos: [] }).catch(() => ({ pedidos: [] })),
        fetch(`/api/cobrancas?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { cobrancas: [] }).catch(() => ({ cobrancas: [] })),
        supabase.from('agendamentos').select('id, hora, paciente_nome, telefone, status, data').eq('clinica_id', cid).eq('data', hoje).order('hora'),
        supabase.from('pacientes').select('id, nome, telefone, whatsapp, proxima_consulta').eq('clinica_id', cid).eq('status', 'ativo').or(`proxima_consulta.is.null,proxima_consulta.lt.${hoje}`).order('nome').limit(20),
        supabase.from('agendamentos').select('id, paciente_nome, telefone, data').eq('clinica_id', cid).eq('status', 'cancelado').gte('data', trintaDiasAtras).order('data', { ascending: false }).limit(50),
      ]);

      const oportunidades: OportunidadeRow[] = oportunidadesRes.data ?? [];
      const orcamentos: OrcamentoRow[] = orcamentosRes.orcamentos ?? [];
      const tratamentos: TratamentoRow[] = (tratamentosRes.tratamentos ?? []).filter((t: TratamentoRow) => t.status === 'em_andamento' || t.status === 'interrompido');
      const todosPedidos: PedidoRow[] = pedidosRes.pedidos ?? [];
      const pedidosNaoConcluidos = todosPedidos.filter(p => p.status === 'criado' || p.status === 'confirmado');
      const cobrancas: CobrancaRow[] = (cobrancasRes.cobrancas ?? []).filter((c: CobrancaRow) => c.status === 'pendente' || c.status === 'em_cobranca');
      const agendaHoje: AgItem[] = (agHojeRes.data ?? []) as AgItem[];
      const semProximoData: ClienteSemProximoRow[] = (semProximoRes.data ?? []) as ClienteSemProximoRow[];

      // Cancelamento só é sinal quando o MESMO telefone não tem nenhum
      // compromisso futuro já remarcado — mesma regra real já usada em
      // app/dashboard/page.tsx, nunca reimplementada diferente aqui.
      const canceladosComTelefone = ((canceladosRes.data ?? []) as CanceladoRow[]).filter((a) => a.telefone);
      const telefonesCancelados = Array.from(new Set(canceladosComTelefone.map(a => a.telefone)));
      let telefonesComReagendamento = new Set<string>();
      if (telefonesCancelados.length > 0) {
        const { data: futuros } = await supabase.from('agendamentos').select('telefone').eq('clinica_id', cid).in('telefone', telefonesCancelados).gte('data', hoje).not('status', 'in', '("cancelado","faltou")');
        telefonesComReagendamento = new Set((futuros || []).map(f => f.telefone));
      }
      const cancelamentosSemReagendamentoRows: CancelamentoSemReagendamentoRow[] = [];
      const telefonesJaIncluidos = new Set<string>();
      for (const a of canceladosComTelefone) {
        if (telefonesComReagendamento.has(a.telefone!) || telefonesJaIncluidos.has(a.telefone!)) continue;
        telefonesJaIncluidos.add(a.telefone!);
        cancelamentosSemReagendamentoRows.push({ id: a.id, nome: a.paciente_nome, telefone: a.telefone, data: a.data });
      }

      const recomprasPossiveis = agregarClientesElegiveisRecompra(
        todosPedidos.map(p => ({ pacienteId: p.paciente_id, telefone: p.telefone, nomeCliente: p.nome_cliente, status: p.status as 'criado' | 'confirmado' | 'aguardando_confirmacao_pagamento' | 'pago' | 'cancelado', criadoEm: p.criado_em, pagamentoConfirmadoEm: p.pagamento_confirmado_em }))
      );

      // ── Radar (Smart Commerce: orçamento/tratamento/pedido/recompra/
      // cobrança + agenda) → Sinal Canônico, uncapped (nunca limitado a
      // 3 como no Dashboard — o Copiloto é o inbox completo). ──────────
      const oportunidadesClientes: OportunidadeCliente[] = gerarOportunidadesClientes({
        hoje, agora,
        clientesSemProximoCompromisso: semProximoData.map(c => ({ id: c.id, nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, proximaConsulta: c.proxima_consulta })),
        cancelamentosSemReagendamento: cancelamentosSemReagendamentoRows.map(a => ({ id: a.id, nome: a.nome, telefone: a.telefone, data: a.data })),
        confirmacoesPendentes: agendaHoje.filter(a => a.status === 'agendado').map(a => ({ id: a.id, nome: a.paciente_nome, telefone: a.telefone || null, data: a.data })),
        orcamentosParados: orcamentos.map(o => ({ id: o.id, pacienteNome: o.paciente_nome, telefone: o.telefone, procedimento: o.procedimento, valor: o.valor, apresentadoEm: o.apresentado_em })),
        tratamentosSemRetorno: tratamentos.map(t => ({ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status as 'em_andamento' | 'interrompido', proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em })),
        cobrancasAtrasadas: cobrancas.map(c => ({ id: c.id, pacienteNome: c.paciente_nome, telefone: c.paciente_telefone, descricao: c.descricao, valor: c.valor, vencimento: c.vencimento, status: c.status as 'pendente' | 'em_cobranca' })),
        pedidosNaoConcluidos: pedidosNaoConcluidos.map(p => ({ id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: p.pedido_itens?.length ? `${p.pedido_itens.length} ${p.pedido_itens.length === 1 ? 'item' : 'itens'}` : 'pedido', valor: p.valor_centavos / 100, criadoEm: p.criado_em })),
        recomprasPossiveis,
      });

      const sinais = organizarSinaisCanonicos([
        ...adaptarOportunidadesClientes(oportunidadesClientes),
        ...adaptarOportunidadesDemanda(oportunidades.map(op => ({ id: op.id, canal: 'whatsapp' as const, telefone: op.telefone, nome_informado: op.nome_informado, status: op.status, confianca_classificacao: 'media' as const, orcamento_vinculado_id: op.orcamento_vinculado_id }))),
      ]);

      // ── Follow-ups pendentes (mesmo motor real de app/follow-up) ─────
      const followUps = gerarFollowUpsComerciais({
        hoje, agora, entidadesComTentativaHoje: new Set(),
        oportunidadesParadas: oportunidades.map(op => ({ id: op.id, telefone: op.telefone, pacienteNome: op.nome_informado || op.telefone, status: op.status, orcamentoVinculadoId: op.orcamento_vinculado_id, ultimaInteracaoEm: op.ultima_interacao_em })),
        orcamentosParados: orcamentos.map(o => ({ id: o.id, pacienteNome: o.paciente_nome, telefone: o.telefone, procedimento: o.procedimento, valor: o.valor, apresentadoEm: o.apresentado_em })),
        tratamentosSemRetorno: tratamentos.map(t => ({ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status as 'em_andamento' | 'interrompido', proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em })),
        pedidosNaoConcluidos: pedidosNaoConcluidos.map(p => ({ id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: p.pedido_itens?.length ? `${p.pedido_itens.length} ${p.pedido_itens.length === 1 ? 'item' : 'itens'}` : 'pedido', valor: p.valor_centavos / 100, criadoEm: p.criado_em })),
        recomprasPossiveis,
        cobrancasAtrasadas: cobrancas.map(c => ({ id: c.id, pacienteNome: c.paciente_nome, telefone: c.paciente_telefone, descricao: c.descricao, valor: c.valor, vencimento: c.vencimento, status: c.status as 'pendente' | 'em_cobranca' })),
        casosAgendaAutonoma: [],
      });
      const followUpsPendentes = followUps.filter(f => f.donoDoFluxo === 'follow-up');

      // ── Receita Perdida (mesmo motor real de app/receita-perdida) ────
      const receitaPerdida = agregarReceitaPerdida({
        hoje, agora,
        orcamentosParados: orcamentos.map(o => ({ id: o.id, pacienteNome: o.paciente_nome, telefone: o.telefone, procedimento: o.procedimento, valor: o.valor, apresentadoEm: o.apresentado_em })),
        cobrancasAtrasadas: cobrancas.map(c => ({ id: c.id, pacienteNome: c.paciente_nome, telefone: c.paciente_telefone, descricao: c.descricao, valor: c.valor, vencimento: c.vencimento, status: c.status as 'pendente' | 'em_cobranca' })),
        tratamentosSemRetorno: tratamentos.map(t => ({ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status as 'em_andamento' | 'interrompido', proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em, valorEstimado: t.valor_estimado })),
        pedidosNaoConcluidos: pedidosNaoConcluidos.map(p => ({ id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: 'pedido', valor: p.valor_centavos / 100, criadoEm: p.criado_em })),
        oportunidadesAbertas: oportunidades.map(op => ({ id: op.id, pacienteNome: op.nome_informado || op.telefone, status: op.status, orcamentoVinculadoId: op.orcamento_vinculado_id })),
      });

      setEstado({
        sinais,
        followUpsPendentes,
        atrasados: agendaHoje.filter(a => a.data < hoje && a.status === 'agendado'),
        pendentesConfirmacao: agendaHoje.filter(a => a.status === 'agendado' && a.data === hoje),
        receitaPerdida,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  const totalItens = estado
    ? estado.sinais.length + estado.followUpsPendentes.length + estado.atrasados.length + estado.pendentesConfirmacao.length + (estado.receitaPerdida && estado.receitaPerdida.totalConhecido > 0 ? 1 : 0)
    : 0;

  return (
    <AdminShell title="Copiloto Administrativo" subtitle="O que precisa da sua atenção agora — só dados reais, nada fabricado">
      {carregando && <PageLoader title="Consolidando o que precisa da sua atenção..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}

      {!carregando && estado && totalItens === 0 && (
        <EmptyState icon="✅" title="Nada pedindo atenção agora." description="Nenhum atraso de agenda, oportunidade parada, orçamento parado, cobrança atrasada, pedido pendente ou follow-up em aberto identificado." />
      )}

      {!carregando && estado && totalItens > 0 && (
        <>
          {/* ── AGENDA HOJE ── */}
          {(estado.atrasados.length > 0 || estado.pendentesConfirmacao.length > 0) && (
            <section style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📅 Agenda</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {estado.atrasados.map(a => (
                  <div key={`atraso-${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#f1f5f9' }}>{a.paciente_nome} — compromisso em atraso ({a.data})</div>
                    <button onClick={() => router.push('/agendamentos')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver agenda →</button>
                  </div>
                ))}
                {estado.pendentesConfirmacao.map(a => (
                  <div key={`pend-${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid #2d3148', borderRadius: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#f1f5f9' }}>{a.paciente_nome} — hoje às {a.hora}, aguardando confirmação</div>
                    <button onClick={() => router.push('/agendamentos')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver agenda →</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── PRIORIDADES COMERCIAIS (Radar + Smart Commerce, uncapped) ── */}
          {estado.sinais.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎯 Prioridades comerciais ({estado.sinais.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {estado.sinais.map(sinal => {
                  const cor = stTom[stTierOportunidade[sinal.prioridade].tom];
                  return (
                    <div key={sinal.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', border: `1px solid ${cor.border}`, borderRadius: 10, padding: '10px 16px' }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 3 }}>{sinal.titulo}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 2 }}>{sinal.motivo}</div>
                        <div style={{ fontSize: 10.5, color: '#64748b', fontStyle: 'italic' }}>Evidência: {sinal.evidencia}</div>
                      </div>
                      {sinal.destino && (
                        <button onClick={() => router.push(sinal.destino!)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(74,155,176,0.35)', background: 'rgba(74,155,176,0.1)', color: '#4a9bb0', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {sinal.destinoLabel || 'Ver'} →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── FOLLOW-UPS PENDENTES ── */}
          {estado.followUpsPendentes.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔁 Follow-ups pendentes ({estado.followUpsPendentes.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {estado.followUpsPendentes.map(caso => (
                  <div key={`${caso.entidadeTipo}-${caso.entidadeId}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid #2d3148', borderRadius: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: '#f1f5f9' }}>
                      <strong>{caso.pacienteNome}</strong> — {TIPO_FOLLOWUP_LABELS[caso.tipo] || caso.tipo}
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{caso.motivo}</div>
                    </div>
                    <button onClick={() => router.push('/follow-up')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(74,155,176,0.35)', background: 'rgba(74,155,176,0.1)', color: '#4a9bb0', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {caso.proximaAcao} →
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── RECEITA PERDIDA (resumo) ── */}
          {estado.receitaPerdida && estado.receitaPerdida.totalConhecido > 0 && (
            <section>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📉 Receita Perdida</div>
              <button onClick={() => router.push('/receita-perdida')} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: '16px 18px', color: 'inherit', font: 'inherit' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f87171' }}>{formatarValor(estado.receitaPerdida.totalConhecido)}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{estado.receitaPerdida.totalItensComValor} item{estado.receitaPerdida.totalItensComValor !== 1 ? 's' : ''} com valor comprovado em risco — ver detalhamento →</div>
              </button>
            </section>
          )}
        </>
      )}
    </AdminShell>
  );
}
