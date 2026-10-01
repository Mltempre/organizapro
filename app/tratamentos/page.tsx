'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { calcularIndicadoresTratamento, type Tratamento, type StatusTratamento } from '../../lib/motor-tratamento';

// ── Serviços contratados — HISTÓRICO (somente leitura) ───────────────────
// Convergência Comercial Definitiva: no OrganizaPro, Pedidos é a estrutura
// única de Venda/Execução (lib/venda-execucao.ts). Novas vendas, execução,
// retorno e cobrança acontecem em /pedidos — esta tela não cadastra nem
// transiciona mais nada. Ela só mostra o histórico de public.tratamentos
// (tabela compartilhada com o ClínicaFlow, nunca apagada) e aponta para a
// venda correspondente quando o serviço já foi migrado
// (pedidos.tratamento_legado_id). A rota fica fora do menu operacional.
// O link antigo /tratamentos?orcamento=<id> segue para /pedidos?orcamento=<id>.

const STATUS_CONFIG: Record<StatusTratamento, { label: string; color: string; bg: string }> = {
  criado:            { label: 'Criado',           color: '#38bdf8', bg: 'rgba(14,165,233,0.14)' },
  em_andamento:      { label: 'Em andamento',     color: '#4a9bb0', bg: 'rgba(31,78,95,0.2)' },
  retorno_agendado:  { label: 'Retorno agendado', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  concluido:         { label: 'Concluído',        color: '#16a34a', bg: '#dcfce7' },
  interrompido:      { label: 'Interrompido',     color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  abandonado:        { label: 'Abandonado',       color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
};

function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function TratamentosPage() {
  const router = useRouter();
  const [tratamentos, setTratamentos] = useState<Tratamento[]>([]);
  // Serviço já migrado → id da venda correspondente em /pedidos.
  const [vendaDoServico, setVendaDoServico] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<'todos' | StatusTratamento>('todos');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      // Link antigo "Registrar serviço contratado" de um orçamento aprovado:
      // a venda agora é registrada em Pedidos.
      const orcamentoDaUrl = new URLSearchParams(window.location.search).get('orcamento');
      if (orcamentoDaUrl) { router.replace(`/pedidos?orcamento=${encodeURIComponent(orcamentoDaUrl)}`); return; }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }

      const cuRes = await fetch('/api/minha-clinica', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      if (!cid) { setTratamentos([]); setCarregando(false); return; }

      const [tratRes, pedRes] = await Promise.all([
        fetch(`/api/tratamentos?clinica_id=${cid}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch(`/api/pedidos?clinica_id=${cid}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null),
      ]);

      if (tratRes.ok) {
        const json = await tratRes.json();
        setTratamentos(Array.isArray(json.tratamentos) ? json.tratamentos : []);
      } else {
        setTratamentos([]);
        // status != 404 é falha real — precisa ficar visível, nunca virar
        // silenciosamente "nenhum tratamento".
        if (tratRes.status !== 404) { console.error('Erro ao carregar tratamentos:', tratRes.status); setErro(MSG_ERRO_PADRAO); }
      }
      const pedJson = pedRes && pedRes.ok ? await pedRes.json().catch(() => null) : null;
      const mapa: Record<string, string> = {};
      for (const p of (Array.isArray(pedJson?.pedidos) ? pedJson.pedidos : []) as { id: string; tratamento_legado_id?: string | null }[]) {
        if (p.tratamento_legado_id) mapa[p.tratamento_legado_id] = p.id;
      }
      setVendaDoServico(mapa);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = tratamentos.filter(t => filtro === 'todos' || t.status === filtro);
  const indicadores = calcularIndicadoresTratamento(tratamentos, new Date().toISOString());

  return (
    <AdminShell
      title="Serviços contratados"
      // "sem acompanhamento" é indicador SEMPRE global — só aparece junto da
      // contagem filtrada quando o filtro ativo é 'todos'.
      subtitle={`Histórico · ${filtradas.length} serviço${filtradas.length !== 1 ? 's' : ''}${filtro === 'todos' && indicadores.semAcompanhamento > 0 ? ` · ${indicadores.semAcompanhamento} sem acompanhamento no total` : ''}`}
    >
      <style>{`
        .trat-card { transition: background 0.15s, border-color 0.15s; }
        .trat-ord-pill:hover { border-color: #3d4360 !important; color: #94a3b8 !important; }
      `}</style>

      <div data-testid="servicos-legado-aviso" style={{ background: 'rgba(31,78,95,0.14)', border: '1px solid #1F4E5F', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: '#cbd5e1', lineHeight: 1.55 }}>
        As vendas e a execução dos serviços (em andamento, retorno, conclusão) agora ficam em <strong>Catálogo e Pedidos</strong>, junto com a cobrança.
        Esta página mostra só o histórico dos serviços contratados registrados antes — nada novo é cadastrado aqui.{' '}
        <button type="button" onClick={() => router.push('/pedidos')} style={{ border: 'none', background: 'transparent', color: '#4a9bb0', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline', font: 'inherit' }}>
          Ir para Catálogo e Pedidos →
        </button>
      </div>

      {carregando && <PageLoader title="Carregando histórico de serviços..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}

      {!carregando && tratamentos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'em_andamento', label: 'Em andamento' },
            { key: 'retorno_agendado', label: 'Retorno agendado' },
            { key: 'concluido', label: 'Concluídos' },
            { key: 'interrompido', label: 'Interrompidos' },
            { key: 'abandonado', label: 'Abandonados' },
          ] as const).map(({ key, label }) => {
            const ativo = filtro === key;
            return (
              <button key={key} className={ativo ? undefined : 'trat-ord-pill'} onClick={() => setFiltro(key)} style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                border: `1px solid ${ativo ? '#1F4E5F' : '#2d3148'}`,
                background: ativo ? 'rgba(31,78,95,0.2)' : 'transparent',
                color: ativo ? '#4a9bb0' : '#64748b', fontWeight: ativo ? 600 : 400, whiteSpace: 'nowrap',
              }}>{label}</button>
            );
          })}
        </div>
      )}

      {!carregando && tratamentos.length === 0 && (
        <EmptyState icon="🧰" title="Nenhum serviço contratado no histórico." description="Registre vendas e acompanhe a execução dos serviços em Catálogo e Pedidos." actionLabel="Ir para Catálogo e Pedidos" onAction={() => router.push('/pedidos')} />
      )}
      {!carregando && tratamentos.length > 0 && filtradas.length === 0 && (
        <EmptyState compact icon="🔍" title="Nenhum serviço neste filtro." actionLabel="Ver todos" onAction={() => setFiltro('todos')} />
      )}

      {!carregando && filtradas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(t => {
            const st = STATUS_CONFIG[t.status];
            const venda = vendaDoServico[t.id];
            return (
              <div key={t.id} className="trat-card" style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15, marginBottom: 4 }}>{t.paciente_nome}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{[t.tipo_tratamento, t.paciente_telefone].filter(Boolean).join('  ·  ')}</div>
                    <div style={{ fontSize: 12, marginTop: 5, color: '#475569' }}>
                      Iniciado em {formatarData(t.iniciado_em.slice(0, 10))}
                      {t.orcamento_origem_id && ' · vinculado a orçamento aprovado'}
                      {t.status === 'retorno_agendado' && t.proxima_data_prevista && ` · retorno em ${formatarData(t.proxima_data_prevista)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    {t.valor_estimado !== null && <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{formatarValor(t.valor_estimado)}</div>}
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                    {venda && (
                      <button type="button" data-testid="servico-migrado" onClick={() => router.push('/pedidos')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>
                        Acompanhar na venda →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
