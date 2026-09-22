'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import {
  precisaRetorno, diasSemAtividade, diasInterrompido,
  calcularScoreSemRetorno, calcularScoreInterrompido, calcularIndicadoresTratamento,
  MOTIVOS_INTERRUPCAO, type Tratamento, type StatusTratamento, type MotivoInterrupcao,
} from '../../lib/motor-tratamento';

// ── Superfície operacional de Tratamentos (última milha) ─────────────────
// Usa só as APIs já construídas e homologadas (GET/POST /api/tratamentos,
// POST /api/tratamentos/[id]/transicao) — nenhuma query direta a
// public.tratamentos aqui (RLS habilitada sem policy, service role only,
// mesmo padrão de orcamentos/cobrancas/pedidos). Todo indicador desta tela
// é derivado 100% dos tratamentos já buscados (calcularIndicadoresTratamento)
// — nunca uma segunda consulta, nunca um número fabricado. Nenhum motor
// novo: é a mesma máquina de estados e os mesmos scores já usados pelo
// Radar (lib/motor-tratamento.ts).

type OrcamentoPicker = { id: string; paciente_nome: string; procedimento: string; valor: number };
type ClientePicker = { id: string; nome: string; telefone: string | null; whatsapp: string | null };

type FormNovo = {
  pacienteId: string;
  orcamentoId: string;
  paciente_nome: string;
  telefone: string;
  tipo_tratamento: string;
  valor_estimado: string;
  observacao: string;
};
const formInicial: FormNovo = { pacienteId: '', orcamentoId: '', paciente_nome: '', telefone: '', tipo_tratamento: '', valor_estimado: '', observacao: '' };

const STATUS_CONFIG: Record<StatusTratamento, { label: string; color: string; bg: string }> = {
  criado:            { label: 'Criado',           color: '#38bdf8', bg: 'rgba(14,165,233,0.14)' },
  em_andamento:      { label: 'Em andamento',     color: '#4a9bb0', bg: 'rgba(31,78,95,0.2)' },
  retorno_agendado:  { label: 'Retorno agendado', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  concluido:         { label: 'Concluído',        color: '#16a34a', bg: '#dcfce7' },
  interrompido:      { label: 'Interrompido',     color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  abandonado:        { label: 'Abandonado',       color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
};
const MOTIVO_LABELS: Record<MotivoInterrupcao, string> = {
  desistiu: 'Cliente desistiu', aguardando_decisao: 'Aguardando decisão do cliente',
  financeiro: 'Motivo financeiro', saude: 'Motivo de saúde', outro: 'Outro motivo',
};

function normalizar(tel: string) { return tel.replace(/\D/g, ''); }
function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function hojeStr() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }

export default function TratamentosPage() {
  const router = useRouter();
  const [tratamentos, setTratamentos]           = useState<Tratamento[]>([]);
  const [pacientes, setPacientes]               = useState<ClientePicker[]>([]);
  const [orcamentosAprovados, setOrcamentosAprovados] = useState<OrcamentoPicker[]>([]);
  const [clinicaId, setClinicaId]               = useState('');
  const [accessToken, setAccessToken]           = useState('');
  const [carregando, setCarregando]             = useState(true);
  const [erro, setErro]                         = useState('');
  const [sucesso, setSucesso]                   = useState('');
  const [filtro, setFiltro]                     = useState<'todos' | StatusTratamento>('todos');

  const [modalNovo, setModalNovo]     = useState(false);
  const [form, setForm]               = useState<FormNovo>(formInicial);
  const [salvando, setSalvando]       = useState(false);
  const idempotencyKeyRef = React.useRef('');

  const [transicionando, setTransicionando] = useState<string | null>(null);
  const [modalInterromper, setModalInterromper] = useState<Tratamento | null>(null);
  const [motivoInterrupcao, setMotivoInterrupcao] = useState<MotivoInterrupcao | ''>('');
  const [modalRetorno, setModalRetorno] = useState<Tratamento | null>(null);
  const [proximaData, setProximaData] = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const cuRes = await fetch('/api/minha-clinica', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      setClinicaId(cid || '');
      if (!cid) { setTratamentos([]); setCarregando(false); return; }

      const [tratRes, orcRes, pacRes] = await Promise.all([
        fetch(`/api/tratamentos?clinica_id=${cid}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch(`/api/orcamentos?clinica_id=${cid}&status=aprovado`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        supabase.from('pacientes').select('id, nome, telefone, whatsapp').eq('clinica_id', cid).order('nome'),
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
      if (orcRes.ok) {
        const json = await orcRes.json();
        setOrcamentosAprovados(Array.isArray(json.orcamentos) ? json.orcamentos : []);
      }
      setPacientes((pacRes.data || []) as ClientePicker[]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() {
    setForm(formInicial);
    idempotencyKeyRef.current = crypto.randomUUID();
    setErro(''); setModalNovo(true);
  }

  function selecionarCliente(id: string) {
    const p = pacientes.find(x => x.id === id);
    setForm(prev => ({ ...prev, pacienteId: id, paciente_nome: p?.nome ?? prev.paciente_nome, telefone: normalizar(p?.whatsapp || p?.telefone || '') }));
  }

  function selecionarOrcamento(id: string) {
    const o = orcamentosAprovados.find(x => x.id === id);
    setForm(prev => ({
      ...prev, orcamentoId: id,
      paciente_nome: o?.paciente_nome ?? prev.paciente_nome,
      tipo_tratamento: o ? o.procedimento : prev.tipo_tratamento,
      valor_estimado: o ? String(o.valor) : prev.valor_estimado,
    }));
  }

  async function salvar() {
    if (!form.paciente_nome.trim()) { setErro('Cliente é obrigatório.'); return; }
    if (!form.tipo_tratamento.trim()) { setErro('Tipo de tratamento é obrigatório.'); return; }
    if (form.valor_estimado && (!Number.isFinite(Number(form.valor_estimado.replace(',', '.'))) || Number(form.valor_estimado.replace(',', '.')) <= 0)) {
      setErro('Valor estimado deve ser um número maior que zero.'); return;
    }

    setSalvando(true); setErro('');
    const res = await fetch('/api/tratamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        clinica_id: clinicaId,
        paciente_id: form.pacienteId || undefined,
        paciente_nome: form.paciente_nome.trim(),
        paciente_telefone: form.telefone ? normalizar(form.telefone) : undefined,
        orcamento_origem_id: form.orcamentoId || undefined,
        tipo_tratamento: form.tipo_tratamento.trim(),
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado.replace(',', '.')) : undefined,
        observacao: form.observacao.trim() || undefined,
        idempotency_key: idempotencyKeyRef.current,
      }),
    });
    const json = await res.json();
    setSalvando(false);
    if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
    setModalNovo(false);
    carregar();
    setSucesso('Tratamento registrado.');
    setTimeout(() => setSucesso(''), 3500);
  }

  async function transicionar(t: Tratamento, novo_status: StatusTratamento, opts?: { motivo_interrupcao?: MotivoInterrupcao; proxima_data_prevista?: string }) {
    setTransicionando(t.id);
    try {
      const res = await fetch(`/api/tratamentos/${t.id}/transicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clinica_id: clinicaId, novo_status, ...opts }),
      });
      const json = await res.json();
      if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
      setModalInterromper(null); setMotivoInterrupcao('');
      setModalRetorno(null); setProximaData('');
      carregar();
      setSucesso('Tratamento atualizado.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setTransicionando(null);
    }
  }

  const hoje = hojeStr();
  const agora = new Date().toISOString();
  const filtradas = tratamentos.filter(t => filtro === 'todos' || t.status === filtro);

  // Mesma priorização real do Radar (lib/motor-tratamento.ts) — quem
  // precisa de atenção agora: em_andamento sem retorno definido/vencido, e
  // interrompidos há muito tempo sem desfecho. Nunca uma segunda lógica.
  const atencaoUrgente = tratamentos
    .filter(t => (t.status === 'em_andamento' && precisaRetorno(t, hoje)) || t.status === 'interrompido')
    .map(t => ({
      tratamento: t,
      score: t.status === 'em_andamento'
        ? calcularScoreSemRetorno(diasSemAtividade(t.updated_at, agora))
        : calcularScoreInterrompido(t.interrompido_em ? diasInterrompido(t.interrompido_em, agora) : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const indicadores = calcularIndicadoresTratamento(tratamentos, agora);

  function proximaAcao(t: Tratamento): string | null {
    if (t.status === 'criado') return 'Iniciar o tratamento';
    if (t.status === 'em_andamento') return precisaRetorno(t, hoje) ? 'Agendar o próximo retorno' : 'Aguardar retorno agendado';
    if (t.status === 'retorno_agendado') return 'Concluir após o retorno';
    if (t.status === 'interrompido') return 'Retomar contato antes do abandono';
    return null;
  }

  return (
    <AdminShell
      title="Tratamentos"
      subtitle={`${filtradas.length} tratamento${filtradas.length !== 1 ? 's' : ''}${indicadores.semAcompanhamento > 0 ? ` · ${indicadores.semAcompanhamento} sem acompanhamento` : ''}`}
      actionLabel="+ Novo tratamento"
      actionOnClick={abrirNovo}
    >
      <style>{`
        .trat-card { transition: background 0.15s, border-color 0.15s; }
        .trat-card:hover { background: #222540 !important; border-color: rgba(31,78,95,0.45) !important; }
        .trat-btn:hover:not(:disabled) { filter: brightness(1.15); }
        .trat-ord-pill:hover { border-color: #3d4360 !important; color: #94a3b8 !important; }
        .trat-btn-cancelar:hover { background: rgba(148,163,184,0.08) !important; border-color: #3d4360 !important; }
        .trat-btn-salvar:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>

      {carregando && <PageLoader title="Carregando tratamentos..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}
      {!carregando && sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />}

      {/* Indicadores — só números reais derivados dos tratamentos já carregados, nunca fabricados */}
      {!carregando && tratamentos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Ativos', valor: String(indicadores.tratamentosAtivos) },
            { label: 'Retornos pendentes', valor: String(indicadores.retornosPendentes) },
            { label: 'Sem acompanhamento', valor: String(indicadores.semAcompanhamento) },
            { label: 'Receita potencial', valor: indicadores.receitaPotencial !== null ? formatarValor(indicadores.receitaPotencial) : '—' },
            { label: 'Receita convertida', valor: indicadores.receitaConvertida !== null ? formatarValor(indicadores.receitaConvertida) : '—' },
          ].map(card => (
            <div key={card.label} style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{card.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{card.valor}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quem precisa de atenção agora — mesma priorização do Radar */}
      {!carregando && atencaoUrgente.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⏱ Precisa de atenção agora</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {atencaoUrgente.map(({ tratamento: t }) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '10px 14px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#f1f5f9' }}>
                  <strong>{t.paciente_nome}</strong> — {t.tipo_tratamento}: {proximaAcao(t)?.toLowerCase()}.
                </div>
                {t.status === 'em_andamento' && (
                  <button className="trat-btn" disabled={transicionando === t.id} onClick={() => { setModalRetorno(t); setProximaData(''); }} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#fbbf24,#d97706)', color: '#1e2130', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    Agendar retorno
                  </button>
                )}
                {t.status === 'interrompido' && (
                  <button className="trat-btn" disabled={transicionando === t.id} onClick={() => transicionar(t, 'abandonado')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #450a0a', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>
                    Marcar abandonado
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!carregando && tratamentos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'criado', label: 'Criados' },
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
        <EmptyState icon="🩺" title="Ainda não há tratamentos registrados." description="Registre o primeiro tratamento, avulso ou vinculado a um orçamento aprovado." actionLabel="➕ Registrar tratamento" onAction={abrirNovo} />
      )}
      {!carregando && tratamentos.length > 0 && filtradas.length === 0 && (
        <EmptyState compact icon="🔍" title="Nenhum tratamento neste filtro." actionLabel="Ver todos" onAction={() => setFiltro('todos')} />
      )}

      {!carregando && filtradas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(t => {
            const st = STATUS_CONFIG[t.status];
            const acao = proximaAcao(t);
            return (
              <div key={t.id} className="trat-card" style={{ background: '#1e2130', border: `1px solid ${t.status === 'interrompido' ? 'rgba(248,113,113,0.35)' : '#2d3148'}`, borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {t.paciente_nome.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15, marginBottom: 4 }}>{t.paciente_nome}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{[t.tipo_tratamento, t.paciente_telefone].filter(Boolean).join('  ·  ')}</div>
                    <div style={{ fontSize: 12, marginTop: 5, color: '#475569' }}>
                      Iniciado em {formatarData(t.iniciado_em.slice(0, 10))}
                      {t.orcamento_origem_id && ' · vinculado a orçamento aprovado'}
                      {t.status === 'retorno_agendado' && t.proxima_data_prevista && ` · retorno em ${formatarData(t.proxima_data_prevista)}`}
                    </div>
                    {t.motivo_interrupcao && <div style={{ fontSize: 12, marginTop: 6, color: '#94a3b8' }}>Motivo: {MOTIVO_LABELS[t.motivo_interrupcao]}</div>}
                    {t.observacao && <div style={{ fontSize: 12, marginTop: 6, color: '#64748b' }}>{t.observacao}</div>}
                    {acao && <div style={{ fontSize: 12, marginTop: 6, color: '#4a9bb0' }}>➜ Próxima ação: {acao}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    {t.valor_estimado !== null && <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{formatarValor(t.valor_estimado)}</div>}
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 240 }}>
                      {t.status === 'criado' && (
                        <button className="trat-btn" disabled={transicionando === t.id} onClick={() => transicionar(t, 'em_andamento')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Iniciar</button>
                      )}
                      {t.status === 'em_andamento' && (
                        <>
                          <button className="trat-btn" disabled={transicionando === t.id} onClick={() => { setModalRetorno(t); setProximaData(''); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', fontSize: 11, cursor: 'pointer' }}>Agendar retorno</button>
                          <button className="trat-btn" disabled={transicionando === t.id} onClick={() => { setModalInterromper(t); setMotivoInterrupcao(''); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #450a0a', background: 'transparent', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>Interromper</button>
                        </>
                      )}
                      {t.status === 'retorno_agendado' && (
                        <button className="trat-btn" disabled={transicionando === t.id} onClick={() => transicionar(t, 'concluido')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Marcar concluído</button>
                      )}
                      {t.status === 'interrompido' && (
                        <button className="trat-btn" disabled={transicionando === t.id} onClick={() => transicionar(t, 'abandonado')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #450a0a', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>Marcar abandonado</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalNovo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setModalNovo(false); }}>
          <div style={{ background: '#1e2130', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3148' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 24, marginTop: 0 }}>Novo tratamento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Orçamento aprovado de origem (opcional)</label>
                <select value={form.orcamentoId} onChange={e => selecionarOrcamento(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">— Tratamento avulso —</option>
                  {orcamentosAprovados.map(o => <option key={o.id} value={o.id}>{o.paciente_nome} — {o.procedimento} ({formatarValor(o.valor)})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente cadastrado (opcional)</label>
                <select value={form.pacienteId} onChange={e => selecionarCliente(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">— Digitar manualmente —</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</label>
                <input value={form.paciente_nome} onChange={e => setForm(prev => ({ ...prev, paciente_nome: e.target.value }))} placeholder="Ex: Maria Silva" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telefone</label>
                <input value={form.telefone} onChange={e => setForm(prev => ({ ...prev, telefone: e.target.value }))} placeholder="Ex: 11999999999" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de tratamento</label>
                <input value={form.tipo_tratamento} onChange={e => setForm(prev => ({ ...prev, tipo_tratamento: e.target.value }))} placeholder="Ex: Clareamento dental" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor estimado (R$, opcional)</label>
                <input type="number" min="0.01" step="0.01" value={form.valor_estimado} onChange={e => setForm(prev => ({ ...prev, valor_estimado: e.target.value }))} placeholder="Ex: 800.00" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observação (opcional)</label>
                <input value={form.observacao} onChange={e => setForm(prev => ({ ...prev, observacao: e.target.value }))} placeholder="Ex: Iniciar após retorno do exame" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            {erro && <div style={{ marginTop: 16 }}><Feedback type="erro" message={erro} onClose={() => setErro('')} /></div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="trat-btn-cancelar" onClick={() => setModalNovo(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button className="trat-btn-salvar" onClick={salvar} disabled={salvando} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>
                {salvando ? 'Salvando...' : 'Registrar tratamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalRetorno && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1020, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setModalRetorno(null); }}>
          <div style={{ background: '#1e2130', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, border: '1px solid #2d3148' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 16, marginTop: 0 }}>Agendar retorno de {modalRetorno.paciente_nome}</h2>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Próxima data prevista</label>
            <input type="date" value={proximaData} onChange={e => setProximaData(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="trat-btn-cancelar" onClick={() => setModalRetorno(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Voltar</button>
              <button disabled={!proximaData || transicionando === modalRetorno.id} onClick={() => transicionar(modalRetorno, 'retorno_agendado', { proxima_data_prevista: proximaData })} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#fbbf24,#d97706)', color: '#1e2130', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !proximaData ? 0.6 : 1 }}>
                {transicionando === modalRetorno.id ? 'Confirmando...' : 'Confirmar retorno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalInterromper && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1020, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setModalInterromper(null); }}>
          <div style={{ background: '#1e2130', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, border: '1px solid #2d3148' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 8, marginTop: 0 }}>Interromper tratamento de {modalInterromper.paciente_nome}</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Um tratamento interrompido pode ser retomado depois marcando-o como abandonado só se de fato não continuar.</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo (opcional)</label>
            <select value={motivoInterrupcao} onChange={e => setMotivoInterrupcao(e.target.value as MotivoInterrupcao | '')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
              <option value="">— Não informar —</option>
              {MOTIVOS_INTERRUPCAO.map(m => <option key={m} value={m}>{MOTIVO_LABELS[m]}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="trat-btn-cancelar" onClick={() => setModalInterromper(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Voltar</button>
              <button disabled={transicionando === modalInterromper.id} onClick={() => transicionar(modalInterromper, 'interrompido', motivoInterrupcao ? { motivo_interrupcao: motivoInterrupcao } : undefined)} style={{ flex: 2, padding: '10px', borderRadius: 8, border: '1px solid #450a0a', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {transicionando === modalInterromper.id ? 'Confirmando...' : 'Confirmar interrupção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
