'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { lerRespostaFinanceira } from '../../lib/resposta-financeira';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import type { Orcamento, StatusOrcamento } from '../../lib/motor-orcamentos';
import type { Tratamento, StatusTratamento } from '../../lib/motor-tratamento';
import type { Cobranca, StatusCobranca } from '../../lib/motor-cobranca';
import { calcularIndicadoresCobranca, type IndicadoresCobranca } from '../../lib/motor-cobranca';
import { gerarPrevisorFaturamento, type ResumoPrevisorFaturamento } from '../../lib/previsor-faturamento';
import { gerarLinhaEconomica, type ResumoLinhaEconomica, type CanalOportunidade } from '../../lib/linha-economica';
import { agregarReceitaPerdida, type ResumoReceitaPerdida, type OrigemReceitaPerdida } from '../../lib/receita-perdida';
import type { OportunidadeStatus } from '../../lib/oportunidades-demanda';

// ── Hub Dinheiro / Financeiro Inteligente ────────────────────────────────
// Composição pura: nenhum motor novo, nenhuma query nova. Busca exatamente
// os mesmos dados já servidos por /api/orcamentos, /api/cobrancas,
// /api/tratamentos, /api/pedidos e /api/oportunidades (mesmo padrão de
// app/cobrancas, app/previsor-faturamento, app/linha-economica e
// app/receita-perdida) e delega toda a decisão aos 4 motores reais já
// homologados: calcularIndicadoresCobranca (a receber/atrasado/recebido),
// gerarPrevisorFaturamento (previsto 30 dias), gerarLinhaEconomica
// (recebido comprovado), agregarReceitaPerdida (em risco + próxima ação).
// Esta tela só renderiza — nenhum número financeiro é calculado aqui.
//
// "Próxima ação financeira" reaproveita literalmente a mesma ordenação já
// usada em app/receita-perdida/page.tsx (valor desc, depois dias em risco
// desc) — nenhuma prioridade nova é inventada só para preencher UI.
//
// Fora de escopo, de propósito: extrato de conta, obrigações a pagar,
// custos operacionais, margem/resultado líquido, meio de pagamento
// externo, confirmação além do que os motores já provam, ou causalidade
// além do que gerarLinhaEconomica já comprova via trilha.

type PedidoRow = {
  id: string; nome_cliente: string; telefone: string | null; valor_centavos: number;
  status: 'criado' | 'confirmado' | 'aguardando_confirmacao_pagamento' | 'pago' | 'cancelado';
  criado_em: string; pagamento_confirmado_em: string | null;
};
type OportunidadeRow = {
  id: string; nome_informado: string | null; telefone: string; status: OportunidadeStatus;
  orcamento_vinculado_id: string | null; canal: CanalOportunidade;
};

const ORIGEM_LABELS: Record<OrigemReceitaPerdida, { label: string; icon: string }> = {
  orcamento_parado:       { label: 'Orçamento parado',       icon: '💰' },
  cobranca_atrasada:      { label: 'Cobrança atrasada',      icon: '🧾' },
  tratamento_sem_retorno: { label: 'Tratamento sem retorno', icon: '🩺' },
  pedido_nao_concluido:   { label: 'Pedido não concluído',   icon: '🛒' },
};

const ACESSOS_RAPIDOS = [
  { label: 'Cobranças',            href: '/cobrancas',            icon: '🧾' },
  { label: 'Orçamentos',           href: '/orcamentos',           icon: '💰' },
  { label: 'Pedidos',              href: '/pedidos',              icon: '🛒' },
  { label: 'Previsor de Faturamento', href: '/previsor-faturamento', icon: '🔮' },
  { label: 'Linha Econômica',      href: '/linha-economica',      icon: '📐' },
  { label: 'Receita Perdida',      href: '/receita-perdida',      icon: '📉' },
];

function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarPercentual(v: number) { return `${Math.round(v * 100)}%`; }
function formatarData(iso: string) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function hojeStr() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }

type ResumoFinanceiro = {
  indicadores: IndicadoresCobranca | null;
  previsor: ResumoPrevisorFaturamento;
  linhaEconomica: ResumoLinhaEconomica;
  receitaPerdida: ResumoReceitaPerdida;
  semDadosNenhuma: boolean; // clínica sem nenhum registro em nenhuma das 5 fontes — nunca finge ter medido algo
};

export default function FinanceiroPage() {
  const router = useRouter();
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro(''); setResumo(null);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      const auth = { Authorization: `Bearer ${session.access_token}` };

      const cuRes = await fetch('/api/minha-clinica', { headers: auth });
      if (!cuRes.ok) throw new Error('Não foi possível identificar o negócio.');
      const cid: string | undefined = (await cuRes.json()).clinica_id;
      if (!cid) { setResumo(null); setErro('Negócio não vinculado ao usuário.'); setCarregando(false); return; }

      // Mesmo padrão de fetch já usado em app/receita-perdida/page.tsx,
      // app/previsor-faturamento/page.tsx e app/linha-economica/page.tsx —
      // busca tudo sem filtro de status na URL (cada motor filtra o que
      // precisa) para nunca duplicar a mesma chamada 3x nesta tela.
      const [orcamentosRes, cobrancasRes, tratamentosRes, pedidosRes, oportunidadesRes] = await Promise.all([
        fetch(`/api/orcamentos?clinica_id=${cid}`, { headers: auth }).then(r => lerRespostaFinanceira(r, 'orcamentos')),
        fetch(`/api/cobrancas?clinica_id=${cid}`, { headers: auth }).then(r => lerRespostaFinanceira(r, 'cobrancas')),
        fetch(`/api/tratamentos?clinica_id=${cid}`, { headers: auth }).then(r => lerRespostaFinanceira(r, 'tratamentos')),
        fetch(`/api/pedidos?clinica_id=${cid}`, { headers: auth }).then(r => lerRespostaFinanceira(r, 'pedidos')),
        fetch('/api/oportunidades', { headers: auth }).then(r => lerRespostaFinanceira(r, 'data')),
      ]);

      const orcamentosTodos: Orcamento[] = orcamentosRes.orcamentos ?? [];
      const cobrancasTodas: Cobranca[] = cobrancasRes.cobrancas ?? [];
      const tratamentosTodos: Tratamento[] = tratamentosRes.tratamentos ?? [];
      const pedidosTodos: PedidoRow[] = pedidosRes.pedidos ?? [];
      const oportunidades: OportunidadeRow[] = oportunidadesRes.data ?? [];

      const hoje = hojeStr();
      const agora = new Date().toISOString();

      // ── calcularIndicadoresCobranca — mesmo motor real de app/cobrancas
      const indicadores = cobrancasTodas.length > 0 ? calcularIndicadoresCobranca(cobrancasTodas, agora) : null;

      // ── Subconjuntos exatamente iguais aos já usados nas telas fonte —
      // nenhum filtro novo, nenhuma regra de negócio inventada aqui.
      const orcamentosApresentados = orcamentosTodos.filter((o) => o.status === 'apresentado');
      const cobrancasAbertas = cobrancasTodas.filter((c) => c.status === 'pendente' || c.status === 'em_cobranca');
      const tratamentosPrevisor = tratamentosTodos.filter((t) => t.status === 'em_andamento' || t.status === 'retorno_agendado' || t.status === 'interrompido');
      const tratamentosRisco = tratamentosTodos.filter((t) => t.status === 'em_andamento' || t.status === 'interrompido');
      const pedidosPrevisor = pedidosTodos.filter((p) => p.status === 'criado' || p.status === 'confirmado' || p.status === 'aguardando_confirmacao_pagamento');
      const pedidosRisco = pedidosTodos.filter((p) => p.status === 'criado' || p.status === 'confirmado');

      const oportunidadesParaRisco = oportunidades.map((op) => ({ id: op.id, pacienteNome: op.nome_informado || op.telefone, status: op.status, orcamentoVinculadoId: op.orcamento_vinculado_id }));

      // ── gerarPrevisorFaturamento — mesmo motor real de app/previsor-faturamento
      const previsor = gerarPrevisorFaturamento({
        hoje, agora,
        cobrancasAbertas: cobrancasAbertas.map((c) => ({
          id: c.id, pacienteNome: c.paciente_nome, telefone: c.paciente_telefone, descricao: c.descricao,
          valor: c.valor, vencimento: c.vencimento, status: c.status as 'pendente' | 'em_cobranca',
          tratamentoOrigemId: c.tratamento_origem_id,
        })),
        orcamentosApresentados: orcamentosApresentados.map((o) => ({
          id: o.id, pacienteNome: o.paciente_nome, telefone: o.telefone, procedimento: o.procedimento,
          valor: o.valor, apresentadoEm: o.apresentado_em,
        })),
        tratamentos: tratamentosPrevisor.map((t) => ({
          id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento,
          status: t.status, valorEstimado: t.valor_estimado, proximaDataPrevista: t.proxima_data_prevista,
          updatedAt: t.updated_at, interrompidoEm: t.interrompido_em,
        })),
        pedidosAbertos: pedidosPrevisor.map((p) => ({
          id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: 'pedido',
          valor: p.valor_centavos / 100, criadoEm: p.criado_em,
          status: p.status as 'criado' | 'confirmado' | 'aguardando_confirmacao_pagamento',
        })),
        oportunidadesAbertas: oportunidadesParaRisco,
      });

      // ── agregarReceitaPerdida — mesmo motor real de app/receita-perdida
      const receitaPerdida = agregarReceitaPerdida({
        hoje, agora,
        orcamentosParados: orcamentosApresentados.map((o) => ({ id: o.id, pacienteNome: o.paciente_nome, telefone: o.telefone, procedimento: o.procedimento, valor: o.valor, apresentadoEm: o.apresentado_em })),
        cobrancasAtrasadas: cobrancasAbertas.map((c) => ({ id: c.id, pacienteNome: c.paciente_nome, telefone: c.paciente_telefone, descricao: c.descricao, valor: c.valor, vencimento: c.vencimento, status: c.status as 'pendente' | 'em_cobranca' })),
        tratamentosSemRetorno: tratamentosRisco.map((t) => ({ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status, proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em, valorEstimado: t.valor_estimado })),
        pedidosNaoConcluidos: pedidosRisco.map((p) => ({ id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: 'pedido', valor: p.valor_centavos / 100, criadoEm: p.criado_em })),
        oportunidadesAbertas: oportunidadesParaRisco,
      });

      // ── gerarLinhaEconomica — mesmo motor real de app/linha-economica
      const linhaEconomica = gerarLinhaEconomica({
        oportunidades: oportunidades.map((op) => ({ id: op.id, canal: op.canal, status: op.status, orcamentoVinculadoId: op.orcamento_vinculado_id })),
        orcamentos: orcamentosTodos.map((o) => ({ id: o.id, status: o.status as StatusOrcamento, valor: o.valor, apresentadoEm: o.apresentado_em, decididoEm: o.decidido_em })),
        tratamentos: tratamentosTodos.map((t) => ({ id: t.id, orcamentoOrigemId: t.orcamento_origem_id, status: t.status as StatusTratamento })),
        cobrancas: cobrancasTodas.map((c) => ({
          id: c.id, pacienteNome: c.paciente_nome, tratamentoOrigemId: c.tratamento_origem_id, status: c.status as StatusCobranca,
          valor: c.valor, valorPago: c.valor_pago, vencimento: c.vencimento, pagoEm: c.pago_em, emCobrancaEm: c.em_cobranca_em,
        })),
        pedidos: pedidosTodos.map((p) => ({ id: p.id, pacienteNome: p.nome_cliente, status: p.status, valor: p.valor_centavos / 100, pagamentoConfirmadoEm: p.pagamento_confirmado_em })),
      });

      const semDadosNenhuma = orcamentosTodos.length === 0 && cobrancasTodas.length === 0
        && tratamentosTodos.length === 0 && pedidosTodos.length === 0 && oportunidades.length === 0;

      setResumo({ indicadores, previsor, linhaEconomica, receitaPerdida, semDadosNenhuma });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  // Próxima ação financeira — mesma ordenação real já usada em
  // app/receita-perdida/page.tsx (valor desc, nulos por último, depois dias
  // em risco desc), nenhuma prioridade nova inventada. Top 5 só para não
  // sobrecarregar a tela — o detalhe completo continua em /receita-perdida.
  const proximasAcoes = resumo
    ? [...resumo.receitaPerdida.itens]
        .sort((a, b) => {
          if (a.valor !== null && b.valor !== null) return b.valor - a.valor;
          if (a.valor !== null) return -1;
          if (b.valor !== null) return 1;
          return b.diasEmRisco - a.diasEmRisco;
        })
        .slice(0, 5)
    : [];

  return (
    <AdminShell title="Dinheiro" subtitle="A receber, atrasado, recebido, previsto e em risco — tudo num só lugar">
      {carregando && <PageLoader title="Consolidando sua situação financeira..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}

      {!carregando && resumo && resumo.semDadosNenhuma && (
        <EmptyState
          icon="💵"
          title="Ainda não há dados financeiros para consolidar."
          description="Registre uma cobrança, orçamento ou pedido para começar a ver sua situação financeira aqui."
          actionLabel="Registrar cobrança"
          onAction={() => router.push('/cobrancas')}
        />
      )}

      {!carregando && resumo && !resumo.semDadosNenhuma && (
        <>
          {/* 5 perguntas do empresário — cada card vem de um único motor real, nunca um número fabricado */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 24 }}>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>A receber</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>{resumo.indicadores?.valorEmAberto !== null && resumo.indicadores?.valorEmAberto !== undefined ? formatarValor(resumo.indicadores.valorEmAberto) : '—'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{resumo.indicadores ? `${resumo.indicadores.quantidadeEmCobranca} em cobrança ativa` : 'nenhuma cobrança registrada'}</div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Atrasado</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f87171' }}>{resumo.indicadores?.valorEmAtraso !== null && resumo.indicadores?.valorEmAtraso !== undefined ? formatarValor(resumo.indicadores.valorEmAtraso) : '—'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {resumo.indicadores?.proporcaoValorAtrasado !== null && resumo.indicadores?.proporcaoValorAtrasado !== undefined
                  ? `${formatarPercentual(resumo.indicadores.proporcaoValorAtrasado)} do que está em aberto`
                  : 'sem cobrança em aberto'}
              </div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Recebido comprovado</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#4ade80' }}>{formatarValor(resumo.linhaEconomica.totalComprovado)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{resumo.linhaEconomica.quantidadeComprovada} pagamento{resumo.linhaEconomica.quantidadeComprovada !== 1 ? 's' : ''} real{resumo.linhaEconomica.quantidadeComprovada !== 1 ? 'is' : ''}</div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Previsto até {formatarData(resumo.previsor.horizonteFim)}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#4a9bb0' }}>{formatarValor(resumo.previsor.totalEsperado30Dias)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{formatarValor(resumo.previsor.confirmadoProgramado.total)} confirmado</div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Em risco</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>{formatarValor(resumo.receitaPerdida.totalConhecido)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{resumo.receitaPerdida.totalItensComValor} item{resumo.receitaPerdida.totalItensComValor !== 1 ? 's' : ''} com valor comprovado</div>
            </div>
          </div>

          {/* Acesso rápido — cobranças/orçamentos/pedidos e as 3 visões existentes continuam acessíveis, nenhuma foi removida */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginBottom: 28 }}>
            {ACESSOS_RAPIDOS.map((a) => (
              <button key={a.href} onClick={() => router.push(a.href)} style={{ textAlign: 'left', cursor: 'pointer', background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '10px 14px', color: '#cbd5e1', font: 'inherit', fontSize: 12 }}>
                <span style={{ marginRight: 6 }}>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>

          {/* Próxima ação financeira — toda ação exibida tem motivo, evidência, valor (quando comprovável) e CTA real */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎯 Próxima ação financeira</div>
          {proximasAcoes.length === 0 && (
            <EmptyState compact icon="✅" title="Nenhuma ação financeira prioritária agora." description="Nenhum orçamento parado, cobrança atrasada, tratamento sem retorno ou pedido não concluído identificado." />
          )}
          {proximasAcoes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proximasAcoes.map((item) => {
                const info = ORIGEM_LABELS[item.origem];
                return (
                  <div key={`${item.origem}-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: '#f1f5f9' }}>
                      <span style={{ marginRight: 6 }}>{info.icon}</span>
                      <strong>{item.pacienteNome}</strong> — {info.label}, há {item.diasEmRisco} dia{item.diasEmRisco === 1 ? '' : 's'} em risco
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: item.valor !== null ? '#fbbf24' : '#64748b', minWidth: 100, textAlign: 'right' }}>
                      {item.valor !== null ? formatarValor(item.valor) : 'valor não informado'}
                    </div>
                    <button onClick={() => router.push(item.destino)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver e agir →</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
