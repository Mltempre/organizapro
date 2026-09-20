'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import type { Orcamento } from '../../lib/motor-orcamentos';
import type { Tratamento } from '../../lib/motor-tratamento';
import type { Cobranca } from '../../lib/motor-cobranca';
import { agregarReceitaPerdida, type ResumoReceitaPerdida, type OrigemReceitaPerdida } from '../../lib/receita-perdida';
import type { OportunidadeStatus } from '../../lib/oportunidades-demanda';

// ── Receita Perdida AI V1 · visão consolidada e explicável ──────────────
// Nenhuma consulta nova, nenhum motor novo: busca exatamente os mesmos
// dados já servidos por /api/orcamentos, /api/cobrancas, /api/tratamentos,
// /api/pedidos e /api/oportunidades (mesmo padrão de fetch/filtro já usado
// em app/dashboard/page.tsx) e delega toda a decisão de "está em risco" e
// "qual o valor real" a lib/receita-perdida.ts. Esta tela só renderiza —
// nenhum número é calculado aqui.

type PedidoRow = { id: string; nome_cliente: string; telefone: string | null; valor_centavos: number; status: string; criado_em: string };
type OportunidadeRow = { id: string; nome_informado: string | null; telefone: string; status: OportunidadeStatus; orcamento_vinculado_id: string | null };

const ORIGEM_LABELS: Record<OrigemReceitaPerdida, { label: string; icon: string }> = {
  orcamento_parado:       { label: 'Orçamento parado',   icon: '💰' },
  cobranca_atrasada:      { label: 'Cobrança atrasada',  icon: '🧾' },
  tratamento_sem_retorno: { label: 'Tratamento sem retorno', icon: '🩺' },
  pedido_nao_concluido:   { label: 'Pedido não concluído', icon: '🛒' },
};

function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function hojeStr() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }

export default function ReceitaPerdidaPage() {
  const router = useRouter();
  const [resumo, setResumo] = useState<ResumoReceitaPerdida | null>(null);
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
      if (!cid) { setResumo(null); setCarregando(false); return; }

      // Mesmo padrão de fetch/filtro já usado em app/dashboard/page.tsx —
      // falha em qualquer domínio nunca fabrica dado, só resulta em lista
      // vazia (nunca some com o resto da tela).
      const [orcamentosRes, cobrancasRes, tratamentosRes, pedidosRes, oportunidadesRes] = await Promise.all([
        fetch(`/api/orcamentos?clinica_id=${cid}&status=apresentado`, { headers: auth }).then(r => r.ok ? r.json() : { orcamentos: [] }).catch(() => ({ orcamentos: [] })),
        fetch(`/api/cobrancas?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { cobrancas: [] }).catch(() => ({ cobrancas: [] })),
        fetch(`/api/tratamentos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { tratamentos: [] }).catch(() => ({ tratamentos: [] })),
        fetch(`/api/pedidos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { pedidos: [] }).catch(() => ({ pedidos: [] })),
        fetch('/api/oportunidades', { headers: auth }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      ]);

      const orcamentos: Orcamento[] = orcamentosRes.orcamentos ?? [];
      const cobrancas: Cobranca[] = (cobrancasRes.cobrancas ?? []).filter((c: Cobranca) => c.status === 'pendente' || c.status === 'em_cobranca');
      const tratamentos: Tratamento[] = (tratamentosRes.tratamentos ?? []).filter((t: Tratamento) => t.status === 'em_andamento' || t.status === 'interrompido');
      const pedidos: PedidoRow[] = (pedidosRes.pedidos ?? []).filter((p: PedidoRow) => p.status === 'criado' || p.status === 'confirmado');
      const oportunidades: OportunidadeRow[] = oportunidadesRes.data ?? [];

      const hoje = hojeStr();
      const agora = new Date().toISOString();

      const r = agregarReceitaPerdida({
        hoje,
        agora,
        orcamentosParados: orcamentos.map(o => ({ id: o.id, pacienteNome: o.paciente_nome, telefone: o.telefone, procedimento: o.procedimento, valor: o.valor, apresentadoEm: o.apresentado_em })),
        cobrancasAtrasadas: cobrancas.map(c => ({ id: c.id, pacienteNome: c.paciente_nome, telefone: c.paciente_telefone, descricao: c.descricao, valor: c.valor, vencimento: c.vencimento, status: c.status as 'pendente' | 'em_cobranca' })),
        tratamentosSemRetorno: tratamentos.map(t => ({ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status, proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em, valorEstimado: t.valor_estimado })),
        pedidosNaoConcluidos: pedidos.map(p => ({ id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: 'pedido', valor: p.valor_centavos / 100, criadoEm: p.criado_em })),
        oportunidadesAbertas: oportunidades.map(op => ({ id: op.id, pacienteNome: op.nome_informado || op.telefone, status: op.status, orcamentoVinculadoId: op.orcamento_vinculado_id })),
      });

      setResumo(r);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  const itensOrdenados = resumo ? [...resumo.itens].sort((a, b) => {
    if (a.valor !== null && b.valor !== null) return b.valor - a.valor;
    if (a.valor !== null) return -1;
    if (b.valor !== null) return 1;
    return b.diasEmRisco - a.diasEmRisco;
  }) : [];

  return (
    <AdminShell title="Receita Perdida AI" subtitle="Dinheiro real em risco, consolidado dos motores já existentes">
      {carregando && <PageLoader title="Consolidando receita em risco..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}

      {!carregando && resumo && (
        <>
          {/* Total — sempre só a soma dos valores reais, nunca uma estimativa */}
          <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Valor conhecido em risco (soma de dados reais)</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#f87171' }}>{formatarValor(resumo.totalConhecido)}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
              {resumo.totalItensComValor} item{resumo.totalItensComValor !== 1 ? 's' : ''} com valor comprovado
              {resumo.totalItensSemValor > 0 && <> · {resumo.totalItensSemValor} item{resumo.totalItensSemValor !== 1 ? 's' : ''} sem valor conhecido (não somado{resumo.totalItensSemValor !== 1 ? 's' : ''})</>}
              {resumo.oportunidadesSemComprovacao > 0 && <> · {resumo.oportunidadesSemComprovacao} oportunidade{resumo.oportunidadesSemComprovacao !== 1 ? 's' : ''} sem valor financeiro comprovado (nunca contada{resumo.oportunidadesSemComprovacao !== 1 ? 's' : ''} em dinheiro)</>}
            </div>
          </div>

          {/* Breakdown por origem — cada card aponta para a superfície real */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 24 }}>
            {resumo.porOrigem.map(g => {
              const info = ORIGEM_LABELS[g.origem];
              return (
                <button key={g.origem} onClick={() => router.push(info ? (g.origem === 'orcamento_parado' ? '/orcamentos' : g.origem === 'cobranca_atrasada' ? '/cobrancas' : g.origem === 'tratamento_sem_retorno' ? '/tratamentos' : '/pedidos') : '#')} style={{ textAlign: 'left', cursor: 'pointer', background: '#1e2130', border: '1px solid #2d3148', borderRadius: 12, padding: '14px 16px', color: 'inherit', font: 'inherit' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{info.icon} {info.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{g.itensComValor > 0 ? formatarValor(g.totalConhecido) : '—'}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {g.itensComValor} com valor{g.itensSemValor > 0 && ` · ${g.itensSemValor} sem valor`}
                  </div>
                </button>
              );
            })}
          </div>

          {itensOrdenados.length === 0 && resumo.oportunidades.length === 0 && (
            <EmptyState icon="✅" title="Nenhuma receita em risco no momento." description="Nenhum orçamento parado, cobrança atrasada, tratamento sem retorno ou pedido não concluído identificado." />
          )}

          {itensOrdenados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: resumo.oportunidades.length > 0 ? 24 : 0 }}>
              {itensOrdenados.map(item => {
                const info = ORIGEM_LABELS[item.origem];
                return (
                  <div key={`${item.origem}-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#f1f5f9' }}>
                      <span style={{ marginRight: 6 }}>{info.icon}</span>
                      <strong>{item.pacienteNome}</strong> — {info.label}, há {item.diasEmRisco} dia{item.diasEmRisco === 1 ? '' : 's'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: item.valor !== null ? '#f87171' : '#64748b', minWidth: 100, textAlign: 'right' }}>
                      {item.valor !== null ? formatarValor(item.valor) : 'valor não informado'}
                    </div>
                    <button onClick={() => router.push(item.destino)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver →</button>
                  </div>
                );
              })}
            </div>
          )}

          {resumo.oportunidades.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📡 Oportunidades abertas sem valor financeiro comprovado (nunca contadas em dinheiro)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resumo.oportunidades.map(op => (
                  <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(148,163,184,0.06)', border: '1px solid #2d3148', borderRadius: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#cbd5e1' }}>{op.pacienteNome} — status: {op.status}</div>
                    <button onClick={() => router.push(op.destino)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver →</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
