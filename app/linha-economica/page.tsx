'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { gerarLinhaEconomica, type ResumoLinhaEconomica, type CanalOportunidade } from '../../lib/linha-economica';
import type { OportunidadeStatus } from '../../lib/oportunidades-demanda';
import type { StatusOrcamento } from '../../lib/motor-orcamentos';
import type { StatusTratamento } from '../../lib/motor-tratamento';
import type { StatusCobranca } from '../../lib/motor-cobranca';

// ── Linha Econômica / Prova de Resultado V1 · visão executiva ───────────
// Nenhuma consulta nova, nenhum motor novo: busca exatamente os mesmos
// dados já servidos por /api/oportunidades, /api/orcamentos,
// /api/tratamentos, /api/cobrancas e /api/pedidos (mesmo padrão já usado
// em app/receita-perdida/page.tsx e app/previsor-faturamento/page.tsx) e
// delega toda a classificação a lib/linha-economica.ts. Esta tela só
// renderiza — nenhum número é calculado aqui, nenhuma causalidade é
// afirmada além do que a trilha real prova.

type OportunidadeRow = { id: string; canal: CanalOportunidade; status: OportunidadeStatus; orcamento_vinculado_id: string | null };
type OrcamentoRow = { id: string; status: string; valor: number; apresentado_em: string; decidido_em: string | null };
type TratamentoRow = { id: string; orcamento_origem_id: string | null; status: string };
type CobrancaRow = {
  id: string; paciente_nome: string; tratamento_origem_id: string | null; status: string;
  valor: number; valor_pago: number | null; vencimento: string; pago_em: string | null; em_cobranca_em: string | null;
};
type PedidoRow = { id: string; nome_cliente: string; status: string; valor_centavos: number; pagamento_confirmado_em: string | null };

const CANAL_LABELS: Record<CanalOportunidade, { label: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', icon: '💬' },
  manual:   { label: 'Manual',   icon: '✍️' },
  site:     { label: 'Site',     icon: '🌐' },
};

function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function LinhaEconomicaPage() {
  const router = useRouter();
  const [resumo, setResumo] = useState<ResumoLinhaEconomica | null>(null);
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

      // Mesmo padrão de fetch já usado em app/receita-perdida/page.tsx —
      // falha em qualquer domínio nunca fabrica dado, só resulta em lista
      // vazia (nunca derruba o resto da tela).
      const [oportunidadesRes, orcamentosRes, tratamentosRes, cobrancasRes, pedidosRes] = await Promise.all([
        fetch('/api/oportunidades', { headers: auth }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`/api/orcamentos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { orcamentos: [] }).catch(() => ({ orcamentos: [] })),
        fetch(`/api/tratamentos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { tratamentos: [] }).catch(() => ({ tratamentos: [] })),
        fetch(`/api/cobrancas?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { cobrancas: [] }).catch(() => ({ cobrancas: [] })),
        fetch(`/api/pedidos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { pedidos: [] }).catch(() => ({ pedidos: [] })),
      ]);

      const oportunidades: OportunidadeRow[] = oportunidadesRes.data ?? [];
      const orcamentos: OrcamentoRow[] = orcamentosRes.orcamentos ?? [];
      const tratamentos: TratamentoRow[] = tratamentosRes.tratamentos ?? [];
      const cobrancas: CobrancaRow[] = cobrancasRes.cobrancas ?? [];
      const pedidos: PedidoRow[] = pedidosRes.pedidos ?? [];

      const r = gerarLinhaEconomica({
        oportunidades: oportunidades.map(op => ({ id: op.id, canal: op.canal, status: op.status, orcamentoVinculadoId: op.orcamento_vinculado_id })),
        orcamentos: orcamentos.map(o => ({ id: o.id, status: o.status as StatusOrcamento, valor: o.valor, apresentadoEm: o.apresentado_em, decididoEm: o.decidido_em })),
        tratamentos: tratamentos.map(t => ({ id: t.id, orcamentoOrigemId: t.orcamento_origem_id, status: t.status as StatusTratamento })),
        cobrancas: cobrancas.map(c => ({
          id: c.id, pacienteNome: c.paciente_nome, tratamentoOrigemId: c.tratamento_origem_id, status: c.status as StatusCobranca,
          valor: c.valor, valorPago: c.valor_pago, vencimento: c.vencimento, pagoEm: c.pago_em, emCobrancaEm: c.em_cobranca_em,
        })),
        pedidos: pedidos.map(p => ({ id: p.id, pacienteNome: p.nome_cliente, status: p.status as 'criado' | 'confirmado' | 'aguardando_confirmacao_pagamento' | 'pago' | 'cancelado', valor: p.valor_centavos / 100, pagamentoConfirmadoEm: p.pagamento_confirmado_em })),
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

  const itensAtribuiveis = resumo ? resumo.itens.filter(i => i.atribuivel).sort((a, b) => b.valor - a.valor) : [];
  const itensNaoAtribuiveis = resumo ? resumo.itens.filter(i => !i.atribuivel).sort((a, b) => b.valor - a.valor) : [];
  const semDados = resumo && resumo.itens.length === 0;

  return (
    <AdminShell title="Linha Econômica" subtitle="Prova de resultado — comprovado × atribuível, nunca causalidade inventada">
      {carregando && <PageLoader title="Reconstruindo cadeias econômicas..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}

      {!carregando && resumo && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginBottom: 24 }}>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Receita comprovada</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#4ade80' }}>{formatarValor(resumo.totalComprovado)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{resumo.quantidadeComprovada} pagamento{resumo.quantidadeComprovada !== 1 ? 's' : ''} real{resumo.quantidadeComprovada !== 1 ? 'is' : ''}</div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Com origem atribuível</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#4a9bb0' }}>{formatarValor(resumo.totalAtribuivel)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{resumo.quantidadeAtribuivel} com cadeia técnica completa</div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Sem origem atribuível</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#94a3b8' }}>{formatarValor(resumo.totalNaoAtribuivel)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Receita real, sem evidência suficiente de origem</div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Recuperado (era atraso, depois pago)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>{formatarValor(resumo.totalRecuperado)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Fato verificado, nunca causalidade da IA</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 24, fontSize: 12, color: '#94a3b8' }}>
            <span>🔗 {resumo.cadeiasCompletas} cadeia{resumo.cadeiasCompletas !== 1 ? 's' : ''} completa{resumo.cadeiasCompletas !== 1 ? 's' : ''} (oportunidade → orçamento → tratamento → pagamento)</span>
            <span>⏳ {resumo.cadeiasParciais} cadeia{resumo.cadeiasParciais !== 1 ? 's' : ''} parcial{resumo.cadeiasParciais !== 1 ? 'is' : ''} (rastreável, ainda sem pagamento comprovado)</span>
          </div>

          {resumo.porCanal.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 24 }}>
              {resumo.porCanal.map(g => (
                <div key={g.canal} style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{CANAL_LABELS[g.canal].icon} {CANAL_LABELS[g.canal].label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{formatarValor(g.total)}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{g.quantidade} cadeia{g.quantidade !== 1 ? 's' : ''} atribuível{g.quantidade !== 1 ? 'eis' : ''}</div>
                </div>
              ))}
            </div>
          )}

          {semDados && (
            <EmptyState icon="📈" title="Ainda não há pagamento comprovado suficiente." description="Nenhuma cobrança paga ou pedido pago identificado até agora." />
          )}

          {itensAtribuiveis.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4a9bb0', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔗 Com origem atribuível — trilha real</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itensAtribuiveis.map(item => (
                  <div key={`${item.origem}-${item.id}`} style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#f1f5f9' }}>
                        <strong>{item.pacienteNome}</strong>{item.canalOrigem && <> — via {CANAL_LABELS[item.canalOrigem].icon} {CANAL_LABELS[item.canalOrigem].label}</>}
                        {item.recuperada && <span style={{ color: '#fbbf24' }}> · era atraso, foi pago depois</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', minWidth: 100, textAlign: 'right' }}>{formatarValor(item.valor)}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                      trilha: {item.trilha.map(e => e.etapa).join(' → ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {itensNaoAtribuiveis.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sem origem atribuível (receita real, sem cadeia técnica rastreável)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itensNaoAtribuiveis.map(item => (
                  <div key={`${item.origem}-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(148,163,184,0.06)', border: '1px solid #2d3148', borderRadius: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#cbd5e1' }}>
                      <strong>{item.pacienteNome}</strong> — {item.origem === 'pedido' ? 'pedido' : 'cobrança'}
                      {item.recuperada && <span style={{ color: '#fbbf24' }}> · era atraso, foi pago depois</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>{formatarValor(item.valor)}</div>
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
