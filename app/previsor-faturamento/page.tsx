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
import { gerarPrevisorFaturamento, type ResumoPrevisorFaturamento, type OrigemPrevisor } from '../../lib/previsor-faturamento';
import type { OportunidadeStatus } from '../../lib/oportunidades-demanda';

// ── Previsor de Faturamento 30 Dias V1 · visão executiva ────────────────
// Nenhuma consulta nova, nenhum motor novo: busca exatamente os mesmos
// dados já servidos por /api/orcamentos, /api/cobrancas, /api/tratamentos,
// /api/pedidos e /api/oportunidades (mesmo padrão já usado em
// app/receita-perdida/page.tsx) e delega toda a classificação a
// lib/previsor-faturamento.ts. Esta tela só renderiza — nenhum número é
// calculado aqui. "Em risco" reaproveita literalmente lib/receita-perdida.ts
// por dentro do motor; o detalhe item a item de risco já vive em
// /receita-perdida — aqui só o resumo, com link, para nunca duplicar tela.

type PedidoRow = { id: string; nome_cliente: string; telefone: string | null; valor_centavos: number; status: string; criado_em: string };
type OportunidadeRow = { id: string; nome_informado: string | null; telefone: string; status: OportunidadeStatus; orcamento_vinculado_id: string | null };

const ORIGEM_LABELS: Record<OrigemPrevisor, { label: string; icon: string }> = {
  cobranca_a_vencer:     { label: 'Cobrança a vencer',        icon: '🧾' },
  orcamento_apresentado: { label: 'Orçamento em decisão',     icon: '💰' },
  tratamento_agendado:   { label: 'Tratamento com retorno',   icon: '🩺' },
  pedido_em_andamento:   { label: 'Pedido em andamento',      icon: '🛒' },
};

function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(iso: string) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function hojeStr() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }

export default function PrevisorFaturamentoPage() {
  const router = useRouter();
  const [resumo, setResumo] = useState<ResumoPrevisorFaturamento | null>(null);
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
      if (!cid) { setResumo(null); setErro('Negócio não vinculado ao usuário.'); setCarregando(false); return; }

      // Mesmo padrão de fetch/filtro já usado em app/receita-perdida/page.tsx
      // — falha em qualquer domínio nunca fabrica dado, só resulta em lista
      // vazia (nunca derruba o resto da tela).
      const [orcamentosRes, cobrancasRes, tratamentosRes, pedidosRes, oportunidadesRes] = await Promise.all([
        fetch(`/api/orcamentos?clinica_id=${cid}&status=apresentado`, { headers: auth }).then(r => r.ok ? r.json() : { orcamentos: [] }).catch(() => ({ orcamentos: [] })),
        fetch(`/api/cobrancas?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { cobrancas: [] }).catch(() => ({ cobrancas: [] })),
        fetch(`/api/tratamentos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { tratamentos: [] }).catch(() => ({ tratamentos: [] })),
        fetch(`/api/pedidos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { pedidos: [] }).catch(() => ({ pedidos: [] })),
        fetch('/api/oportunidades', { headers: auth }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      ]);

      const orcamentos: Orcamento[] = orcamentosRes.orcamentos ?? [];
      const cobrancas: Cobranca[] = (cobrancasRes.cobrancas ?? []).filter((c: Cobranca) => c.status === 'pendente' || c.status === 'em_cobranca');
      const tratamentos: Tratamento[] = (tratamentosRes.tratamentos ?? []).filter((t: Tratamento) => t.status === 'em_andamento' || t.status === 'retorno_agendado' || t.status === 'interrompido');
      const pedidos: PedidoRow[] = (pedidosRes.pedidos ?? []).filter((p: PedidoRow) => p.status === 'criado' || p.status === 'confirmado' || p.status === 'aguardando_confirmacao_pagamento');
      const oportunidades: OportunidadeRow[] = oportunidadesRes.data ?? [];

      const hoje = hojeStr();
      const agora = new Date().toISOString();

      const r = gerarPrevisorFaturamento({
        hoje,
        agora,
        cobrancasAbertas: cobrancas.map(c => ({
          id: c.id, pacienteNome: c.paciente_nome, telefone: c.paciente_telefone, descricao: c.descricao,
          valor: c.valor, vencimento: c.vencimento, status: c.status as 'pendente' | 'em_cobranca',
          tratamentoOrigemId: c.tratamento_origem_id,
        })),
        orcamentosApresentados: orcamentos.map(o => ({
          id: o.id, pacienteNome: o.paciente_nome, telefone: o.telefone, procedimento: o.procedimento,
          valor: o.valor, apresentadoEm: o.apresentado_em,
        })),
        tratamentos: tratamentos.map(t => ({
          id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento,
          status: t.status, valorEstimado: t.valor_estimado, proximaDataPrevista: t.proxima_data_prevista,
          updatedAt: t.updated_at, interrompidoEm: t.interrompido_em,
        })),
        pedidosAbertos: pedidos.map(p => ({
          id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: 'pedido',
          valor: p.valor_centavos / 100, criadoEm: p.criado_em,
          status: p.status as 'criado' | 'confirmado' | 'aguardando_confirmacao_pagamento',
        })),
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

  const itensPerspectiva = resumo ? [...resumo.emPerspectiva.itensComData, ...resumo.emPerspectiva.itensSemData].sort((a, b) => b.valor - a.valor) : [];
  const itensConfirmados = resumo ? [...resumo.confirmadoProgramado.itens].sort((a, b) => (a.dataPrevista ?? '').localeCompare(b.dataPrevista ?? '')) : [];
  const semDados = resumo && resumo.confirmadoProgramado.itens.length === 0 && itensPerspectiva.length === 0
    && resumo.emRisco.itens.length === 0 && resumo.emRisco.oportunidades.length === 0;

  return (
    <AdminShell title="Previsor de Faturamento" subtitle="Próximos 30 dias — só o que os dados reais sustentam">
      {carregando && <PageLoader title="Calculando previsão..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}

      {!carregando && resumo && (
        <>
          {/* Total esperado — nunca inclui "em risco", que é mostrado separado de propósito */}
          <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Esperado entrar até {formatarData(resumo.horizonteFim)}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#4ade80' }}>{formatarValor(resumo.totalEsperado30Dias)}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
              {formatarValor(resumo.confirmadoProgramado.total)} confirmado/programado · {formatarValor(resumo.emPerspectiva.totalComData + resumo.emPerspectiva.totalSemData)} em perspectiva
              {resumo.emPerspectiva.oportunidadesSemValor > 0 && <> · {resumo.emPerspectiva.oportunidadesSemValor} oportunidade{resumo.emPerspectiva.oportunidadesSemValor !== 1 ? 's' : ''} aberta{resumo.emPerspectiva.oportunidadesSemValor !== 1 ? 's' : ''} sem valor comprovado (não somada{resumo.emPerspectiva.oportunidadesSemValor !== 1 ? 's' : ''})</>}
            </div>
          </div>

          {/* Em risco — resumo compacto, detalhe completo já vive em /receita-perdida */}
          {resumo.emRisco.totalConhecido > 0 && (
            <button onClick={() => router.push('/receita-perdida')} style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, color: 'inherit', font: 'inherit' }}>
              <div style={{ fontSize: 11, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>⚠ Em risco (não incluído no total acima)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{formatarValor(resumo.emRisco.totalConhecido)} <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>— dinheiro parado ou atrasado, ver detalhes em Receita Perdida →</span></div>
            </button>
          )}

          {semDados && (
            <EmptyState icon="📊" title="Ainda não há dados suficientes para uma previsão." description="Nenhuma cobrança a vencer, orçamento em decisão, tratamento com retorno ou pedido em andamento identificado." />
          )}

          {itensConfirmados.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>✅ Confirmado/Programado</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itensConfirmados.map(item => {
                  const info = ORIGEM_LABELS[item.origem];
                  return (
                    <div key={`${item.origem}-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#f1f5f9' }}>
                        <span style={{ marginRight: 6 }}>{info.icon}</span>
                        <strong>{item.pacienteNome}</strong> — {info.label}{item.dataPrevista && <> · vence {formatarData(item.dataPrevista)}</>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', minWidth: 100, textAlign: 'right' }}>{formatarValor(item.valor)}</div>
                      <button onClick={() => router.push(item.destino)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver →</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {itensPerspectiva.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔶 Em perspectiva (depende de conversão/pagamento)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itensPerspectiva.map(item => {
                  const info = ORIGEM_LABELS[item.origem];
                  return (
                    <div key={`${item.origem}-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#f1f5f9' }}>
                        <span style={{ marginRight: 6 }}>{info.icon}</span>
                        <strong>{item.pacienteNome}</strong> — {info.label}{item.dataPrevista ? <> · previsto {formatarData(item.dataPrevista)}</> : <span style={{ color: '#64748b' }}> · sem data prevista</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', minWidth: 100, textAlign: 'right' }}>{formatarValor(item.valor)}</div>
                      <button onClick={() => router.push(item.destino)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver →</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
