'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { OPORTUNIDADE_STATUS, oportunidadeElegivelParaOrcamento, type OportunidadeStatus } from '../../lib/oportunidades-demanda';

// ── Superfície operacional de Oportunidades (última milha: Oportunidade →
// Orçamento) ─────────────────────────────────────────────────────────────
// Usa só as APIs já canônicas (GET/POST /api/oportunidades, POST
// .../[id]/transicao, POST .../[id]/gerar-orcamento) — nenhuma query
// direta a public.oportunidades_demanda aqui. Nenhum indicador fabricado:
// só o que já vem do próprio registro (status, evidência, vínculo real).

type Oportunidade = {
  id: string;
  canal: 'whatsapp' | 'manual' | 'site';
  telefone: string;
  nome_informado: string | null;
  status: OportunidadeStatus;
  confianca_classificacao: 'alta' | 'media' | 'baixa';
  evidencia_bruta: string | null;
  orcamento_vinculado_id: string | null;
  criado_em: string;
  ultima_interacao_em: string;
  expira_em: string;
};

type OrcamentoResumo = { id: string; procedimento: string; valor: number; status: string };

const STATUS_CONFIG: Record<OportunidadeStatus, { label: string; color: string; bg: string }> = {
  sinalizada:  { label: 'Sinalizada',   color: '#38bdf8', bg: 'rgba(14,165,233,0.14)' },
  em_contato:  { label: 'Em contato',   color: '#4a9bb0', bg: 'rgba(31,78,95,0.2)' },
  agendada:    { label: 'Agendada',     color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  atendida:    { label: 'Atendida',     color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  convertida:  { label: 'Convertida',   color: '#16a34a', bg: '#dcfce7' },
  perdida:     { label: 'Perdida',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  expirada:    { label: 'Expirada',     color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
};
const CANAL_LABELS: Record<Oportunidade['canal'], string> = { whatsapp: 'WhatsApp', manual: 'Manual', site: 'Site' };
const PROXIMA_ACAO: Partial<Record<OportunidadeStatus, { label: string; alvo: OportunidadeStatus }>> = {
  sinalizada: { label: 'Registrar contato', alvo: 'em_contato' },
  em_contato: { label: 'Marcar agendada', alvo: 'agendada' },
  agendada:   { label: 'Marcar atendida', alvo: 'atendida' },
  atendida:   { label: 'Marcar convertida', alvo: 'convertida' },
};
const PODE_PERDER: OportunidadeStatus[] = ['sinalizada', 'em_contato', 'agendada', 'atendida'];

function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type FormOrcamento = { paciente_nome: string; procedimento: string; valor: string; observacao: string };
const formInicial: FormOrcamento = { paciente_nome: '', procedimento: '', valor: '', observacao: '' };

export default function OportunidadesPage() {
  const router = useRouter();
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [orcamentosPorId, setOrcamentosPorId] = useState<Record<string, OrcamentoResumo>>({});
  const [accessToken, setAccessToken] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [filtro, setFiltro] = useState<'todas' | OportunidadeStatus>('todas');
  const [transicionando, setTransicionando] = useState<string | null>(null);

  const [modalOrcamento, setModalOrcamento] = useState<Oportunidade | null>(null);
  const [form, setForm] = useState<FormOrcamento>(formInicial);
  const [salvando, setSalvando] = useState(false);
  const idempotencyKeyRef = React.useRef('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const opRes = await fetch('/api/oportunidades', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!opRes.ok) {
        setOportunidades([]);
        if (opRes.status !== 404) console.error('Erro ao carregar oportunidades:', opRes.status);
        setCarregando(false);
        return;
      }
      const json = await opRes.json();
      const lista: Oportunidade[] = Array.isArray(json.data) ? json.data : [];
      setOportunidades(lista);

      // Vínculo real com orçamento já existente — só busca se alguma
      // oportunidade de fato tiver orcamento_vinculado_id, nunca uma
      // segunda consulta desnecessária.
      const vinculados = lista.filter(o => o.orcamento_vinculado_id).map(o => o.orcamento_vinculado_id as string);
      if (vinculados.length > 0) {
        const cuRes = await fetch('/api/minha-clinica', { headers: { Authorization: `Bearer ${session.access_token}` } });
        const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
        if (cid) {
          const orcRes = await fetch(`/api/orcamentos?clinica_id=${cid}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
          if (orcRes.ok) {
            const orcJson = await orcRes.json();
            const mapa: Record<string, OrcamentoResumo> = {};
            for (const o of (orcJson.orcamentos ?? [])) {
              if (vinculados.includes(o.id)) mapa[o.id] = { id: o.id, procedimento: o.procedimento, valor: o.valor, status: o.status };
            }
            setOrcamentosPorId(mapa);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function transicionar(op: Oportunidade, status: OportunidadeStatus) {
    setTransicionando(op.id);
    try {
      const res = await fetch(`/api/oportunidades/${op.id}/transicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status, chave_idempotencia: crypto.randomUUID() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setErro(json.error || MSG_ERRO_PADRAO); return; }
      carregar();
      setSucesso('Oportunidade atualizada.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setTransicionando(null);
    }
  }

  function abrirGerarOrcamento(op: Oportunidade) {
    setForm({ paciente_nome: op.nome_informado || '', procedimento: '', valor: '', observacao: '' });
    idempotencyKeyRef.current = crypto.randomUUID();
    setErro(''); setModalOrcamento(op);
  }

  async function salvarOrcamento() {
    if (!modalOrcamento) return;
    if (!form.paciente_nome.trim()) { setErro('Cliente é obrigatório.'); return; }
    if (!form.procedimento.trim()) { setErro('Procedimento é obrigatório.'); return; }
    const valorNumerico = Number(form.valor.replace(',', '.'));
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) { setErro('Valor deve ser um número maior que zero.'); return; }

    setSalvando(true); setErro('');
    const res = await fetch(`/api/oportunidades/${modalOrcamento.id}/gerar-orcamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        paciente_nome: form.paciente_nome.trim(),
        procedimento: form.procedimento.trim(),
        valor: valorNumerico,
        observacao: form.observacao.trim() || undefined,
        idempotency_key: idempotencyKeyRef.current,
      }),
    });
    const json = await res.json();
    setSalvando(false);
    if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
    setModalOrcamento(null);
    carregar();
    setSucesso('Orçamento gerado e vinculado à oportunidade.');
    setTimeout(() => setSucesso(''), 3500);
  }

  const filtradas = oportunidades.filter(o => filtro === 'todas' || o.status === filtro);

  return (
    <AdminShell
      title="Oportunidades"
      subtitle={`${filtradas.length} oportunidade${filtradas.length !== 1 ? 's' : ''}`}
    >
      <style>{`
        .op-card { transition: background 0.15s, border-color 0.15s; }
        .op-card:hover { background: #222540 !important; border-color: rgba(31,78,95,0.45) !important; }
        .op-btn:hover:not(:disabled) { filter: brightness(1.15); }
        .op-ord-pill:hover { border-color: #3d4360 !important; color: #94a3b8 !important; }
        .op-btn-cancelar:hover { background: rgba(148,163,184,0.08) !important; border-color: #3d4360 !important; }
        .op-btn-salvar:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>

      {carregando && <PageLoader title="Carregando oportunidades..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}
      {!carregando && sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />}

      {!carregando && oportunidades.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          <button className={filtro === 'todas' ? undefined : 'op-ord-pill'} onClick={() => setFiltro('todas')} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
            border: `1px solid ${filtro === 'todas' ? '#1F4E5F' : '#2d3148'}`,
            background: filtro === 'todas' ? 'rgba(31,78,95,0.2)' : 'transparent',
            color: filtro === 'todas' ? '#4a9bb0' : '#64748b', fontWeight: filtro === 'todas' ? 600 : 400,
          }}>Todas</button>
          {OPORTUNIDADE_STATUS.map(key => {
            const ativo = filtro === key;
            return (
              <button key={key} className={ativo ? undefined : 'op-ord-pill'} onClick={() => setFiltro(key)} style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                border: `1px solid ${ativo ? '#1F4E5F' : '#2d3148'}`,
                background: ativo ? 'rgba(31,78,95,0.2)' : 'transparent',
                color: ativo ? '#4a9bb0' : '#64748b', fontWeight: ativo ? 600 : 400, whiteSpace: 'nowrap',
              }}>{STATUS_CONFIG[key].label}</button>
            );
          })}
        </div>
      )}

      {!carregando && oportunidades.length === 0 && (
        <EmptyState icon="📡" title="Ainda não há oportunidades registradas." description="Oportunidades chegam automaticamente pelo WhatsApp, ou podem ser registradas manualmente." />
      )}
      {!carregando && oportunidades.length > 0 && filtradas.length === 0 && (
        <EmptyState compact icon="🔍" title="Nenhuma oportunidade neste filtro." actionLabel="Ver todas" onAction={() => setFiltro('todas')} />
      )}

      {!carregando && filtradas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(op => {
            const st = STATUS_CONFIG[op.status];
            const proxima = PROXIMA_ACAO[op.status];
            const elegivel = oportunidadeElegivelParaOrcamento(op);
            const orcamentoVinculado = op.orcamento_vinculado_id ? orcamentosPorId[op.orcamento_vinculado_id] : null;

            return (
              <div key={op.id} className="op-card" style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(op.nome_informado || op.telefone).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15, marginBottom: 4 }}>{op.nome_informado || 'Nome não informado'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{[CANAL_LABELS[op.canal], op.telefone].filter(Boolean).join('  ·  ')}</div>
                    {op.evidencia_bruta && <div style={{ fontSize: 12, marginTop: 6, color: '#94a3b8', fontStyle: 'italic' }}>&ldquo;{op.evidencia_bruta}&rdquo;</div>}
                    <div style={{ fontSize: 12, marginTop: 5, color: '#475569' }}>
                      Última interação {formatarDataHora(op.ultima_interacao_em)} · confiança {op.confianca_classificacao}
                    </div>
                    {orcamentoVinculado && (
                      <div style={{ fontSize: 12, marginTop: 6, color: '#4ade80' }}>💰 Orçamento vinculado: {orcamentoVinculado.procedimento} ({formatarValor(orcamentoVinculado.valor)})</div>
                    )}
                    {proxima && !orcamentoVinculado && <div style={{ fontSize: 12, marginTop: 6, color: '#4a9bb0' }}>➜ Próxima ação: {proxima.label}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 260 }}>
                      {proxima && (
                        <button className="op-btn" disabled={transicionando === op.id} onClick={() => transicionar(op, proxima.alvo)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{proxima.label}</button>
                      )}
                      {elegivel && (
                        <button className="op-btn" disabled={transicionando === op.id} onClick={() => abrirGerarOrcamento(op)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontSize: 11, cursor: 'pointer' }}>Gerar orçamento</button>
                      )}
                      {PODE_PERDER.includes(op.status) && (
                        <button className="op-btn" disabled={transicionando === op.id} onClick={() => transicionar(op, 'perdida')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #450a0a', background: 'transparent', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>Marcar perdida</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOrcamento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setModalOrcamento(null); }}>
          <div style={{ background: '#1e2130', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3148' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8, marginTop: 0 }}>Gerar orçamento</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>A partir da oportunidade de {modalOrcamento.nome_informado || modalOrcamento.telefone}.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</label>
                <input value={form.paciente_nome} onChange={e => setForm(prev => ({ ...prev, paciente_nome: e.target.value }))} placeholder="Ex: Maria Silva" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procedimento</label>
                <input value={form.procedimento} onChange={e => setForm(prev => ({ ...prev, procedimento: e.target.value }))} placeholder="Ex: Avaliação inicial" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor (R$)</label>
                <input type="number" min="0.01" step="0.01" value={form.valor} onChange={e => setForm(prev => ({ ...prev, valor: e.target.value }))} placeholder="Ex: 300.00" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observação (opcional)</label>
                <input value={form.observacao} onChange={e => setForm(prev => ({ ...prev, observacao: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            {erro && <div style={{ marginTop: 16 }}><Feedback type="erro" message={erro} onClose={() => setErro('')} /></div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="op-btn-cancelar" onClick={() => setModalOrcamento(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button className="op-btn-salvar" onClick={salvarOrcamento} disabled={salvando} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>
                {salvando ? 'Gerando...' : 'Gerar orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
