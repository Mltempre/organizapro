'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import {
  estaParado, diasParado, calcularScoreOportunidade, MOTIVOS_DECISAO,
  type Orcamento, type StatusOrcamento, type MotivoDecisao,
} from '../../lib/motor-orcamentos';

// ── Superfície operacional de Orçamentos ─────────────────────────────────
// Usa só as APIs já construídas e testadas (GET/POST /api/orcamentos,
// POST /api/orcamentos/[id]/transicao) — nenhuma query direta à tabela
// public.orcamentos aqui, porque ela só é acessível via service role
// (RLS habilitada sem nenhuma policy de authenticated/anon, confirmado no
// dump de schema real). O picker de cliente é a única leitura direta via
// Supabase client, igual ao já homologado em app/clientes/page.tsx — não
// existe (nem é inventada aqui) nenhuma FK entre orcamentos e pacientes;
// selecionar um cliente cadastrado só preenche nome/telefone como texto,
// mesmo padrão já usado em agendamentos.paciente_nome/telefone.

type ClientePicker = { id: string; nome: string; telefone: string | null; whatsapp: string | null };

type FormNovo = {
  pacienteId: string;
  paciente_nome: string;
  telefone: string;
  procedimento: string;
  valor: string;
  observacao: string;
};

const formInicial: FormNovo = { pacienteId: '', paciente_nome: '', telefone: '', procedimento: '', valor: '', observacao: '' };

const STATUS_CONFIG: Record<StatusOrcamento, { label: string; color: string; bg: string }> = {
  apresentado: { label: 'Aguardando decisão', color: '#38bdf8', bg: 'rgba(14,165,233,0.14)' },
  aprovado:    { label: 'Aprovado',           color: '#16a34a', bg: '#dcfce7' },
  recusado:    { label: 'Recusado',           color: '#dc2626', bg: '#fee2e2' },
  expirado:    { label: 'Expirado',           color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
};

const MOTIVO_LABELS: Record<MotivoDecisao, string> = {
  preco: 'Preço', vai_pensar: 'Vai pensar', sem_interesse: 'Sem interesse',
  fechou_em_outro_lugar: 'Fechou em outro lugar', outro: 'Outro motivo',
};

type FiltroStatus = 'todos' | StatusOrcamento;

// ── Orçamento que Fecha — score de prioridade (calcularScoreOportunidade,
// lib/motor-orcamentos.ts) conectado aqui: já existia como motor puro,
// nunca era chamado por nenhuma superfície (órfão). Nenhuma regra nova —
// só os 3 fatores reais que o motor já definia (dias parado, valor
// relativo entre os abertos, recorrência do mesmo cliente). Orienta
// ordem (mais prioritário primeiro) e o texto de próxima ação — nunca só
// um número decorativo.
function tierDoScore(score: number): 'alta' | 'media' | 'baixa' {
  if (score >= 67) return 'alta';
  if (score >= 34) return 'media';
  return 'baixa';
}
const TIER_SCORE_CONFIG: Record<'alta' | 'media' | 'baixa', { label: string; color: string }> = {
  alta:  { label: 'Prioridade alta',  color: '#f87171' },
  media: { label: 'Prioridade média', color: '#fbbf24' },
  baixa: { label: 'Prioridade baixa', color: '#64748b' },
};

function normalizar(tel: string) { return tel.replace(/\D/g, ''); }
function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

export default function OrcamentosPage() {
  const router = useRouter();
  const [orcamentos, setOrcamentos]   = useState<Orcamento[]>([]);
  const [pacientes, setPacientes]     = useState<ClientePicker[]>([]);
  const [clinicaId, setClinicaId]     = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [carregando, setCarregando]   = useState(true);
  const [erro, setErro]               = useState('');
  const [sucesso, setSucesso]         = useState('');
  const [filtro, setFiltro]           = useState<FiltroStatus>('todos');

  const [modalNovo, setModalNovo]     = useState(false);
  const [form, setForm]               = useState<FormNovo>(formInicial);
  const [salvando, setSalvando]       = useState(false);
  const salvandoRef = useRef(false);
  const idempotencyKeyRef = useRef<string>('');

  // Set, não string única: clicar em cards DIFERENTES quase ao mesmo tempo
  // não pode reabilitar o botão de um card ainda em voo (o valor único
  // anterior era sobrescrito pelo id mais recente, liberando o card
  // anterior antes da resposta dele chegar).
  const [transicionando, setTransicionando] = useState<Set<string>>(new Set());
  const [modalRecusar, setModalRecusar]     = useState<Orcamento | null>(null);
  const [motivoRecusa, setMotivoRecusa]     = useState<MotivoDecisao | ''>('');

  // ── Carregar ──────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const cuRes = await fetch('/api/minha-clinica', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      setClinicaId(cid || '');
      if (!cid) { setOrcamentos([]); setCarregando(false); return; }

      const [orcRes, pacRes] = await Promise.all([
        fetch(`/api/orcamentos?clinica_id=${cid}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        supabase.from('pacientes').select('id, nome, telefone, whatsapp').eq('clinica_id', cid).order('nome'),
      ]);

      // Falha na consulta nunca fabrica dado — lista fica vazia. Mas falha
      // REAL (qualquer status != 404) precisa ficar visível: "0 orçamentos"
      // por erro de backend não pode parecer igual a uma clínica sem
      // nenhum orçamento registrado.
      if (orcRes.ok) {
        const json = await orcRes.json();
        setOrcamentos(Array.isArray(json.orcamentos) ? json.orcamentos : []);
      } else {
        setOrcamentos([]);
        if (orcRes.status !== 404) { console.error('Erro ao carregar orçamentos:', orcRes.status); setErro(MSG_ERRO_PADRAO); }
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

  // ── Novo orçamento ────────────────────────────────────────────────────

  function abrirNovo() {
    setForm(formInicial);
    idempotencyKeyRef.current = crypto.randomUUID();
    setErro(''); setModalNovo(true);
  }

  function selecionarCliente(id: string) {
    const p = pacientes.find(x => x.id === id);
    setForm(prev => ({
      ...prev, pacienteId: id,
      paciente_nome: p?.nome ?? prev.paciente_nome,
      telefone: normalizar(p?.whatsapp || p?.telefone || ''),
    }));
  }

  async function salvar() {
    if (salvandoRef.current) return;
    salvandoRef.current = true;
    try {
      if (!form.paciente_nome.trim()) { setErro('Cliente é obrigatório.'); return; }
      if (!form.procedimento.trim()) { setErro('Serviço é obrigatório.'); return; }
      const valorNumerico = Number(form.valor.replace(',', '.'));
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) { setErro('Valor deve ser um número maior que zero.'); return; }

      setSalvando(true); setErro('');
      const res = await fetch('/api/orcamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          clinica_id: clinicaId,
          paciente_nome: form.paciente_nome.trim(),
          telefone: form.telefone ? normalizar(form.telefone) : undefined,
          procedimento: form.procedimento.trim(),
          valor: valorNumerico,
          observacao: form.observacao.trim() || undefined,
          idempotency_key: idempotencyKeyRef.current,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.sucesso) {
        setErro(json.error || MSG_ERRO_PADRAO);
        return;
      }
      setModalNovo(false);
      carregar();
      setSucesso('Orçamento registrado.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setSalvando(false);
      salvandoRef.current = false;
    }
  }

  // ── Transições — só os 3 estados finais que o motor real aceita ─────────

  async function transicionar(o: Orcamento, novoStatus: StatusOrcamento, motivo?: MotivoDecisao) {
    setTransicionando(prev => new Set(prev).add(o.id));
    try {
      const res = await fetch(`/api/orcamentos/${o.id}/transicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clinica_id: clinicaId, novo_status: novoStatus, motivo_decisao: motivo }),
      });
      const json = await res.json();
      if (!res.ok || !json.sucesso) {
        setErro(json.error || MSG_ERRO_PADRAO);
        return;
      }
      setModalRecusar(null); setMotivoRecusa('');
      carregar();
      setSucesso('Orçamento atualizado.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setTransicionando(prev => { const next = new Set(prev); next.delete(o.id); return next; });
    }
  }

  // ── Filtro ────────────────────────────────────────────────────────────

  const agora = new Date().toISOString();
  const quantidadeParados = orcamentos.filter(o => o.status === 'apresentado' && estaParado(o.apresentado_em, agora)).length;

  // Score de prioridade — só para 'apresentado' (um orçamento decidido não
  // tem oportunidade a calcular). valorMaximoEntreAbertos e recorrência são
  // sempre recalculados sobre o conjunto REAL de abertos no momento, nunca
  // uma escala fixa.
  const abertos = orcamentos.filter(o => o.status === 'apresentado');
  const valorMaximoEntreAbertos = abertos.reduce((max, o) => Math.max(max, o.valor), 0);
  const contagemPorChave = new Map<string, number>();
  for (const o of abertos) {
    const chave = normalizar(o.telefone || '') || o.paciente_nome.trim().toLowerCase();
    contagemPorChave.set(chave, (contagemPorChave.get(chave) || 0) + 1);
  }
  const scorePorId = new Map<string, number>();
  for (const o of abertos) {
    const chave = normalizar(o.telefone || '') || o.paciente_nome.trim().toLowerCase();
    scorePorId.set(o.id, calcularScoreOportunidade({
      diasParado: diasParado(o.apresentado_em, agora),
      valor: o.valor,
      valorMaximoEntreAbertos,
      quantidadeAbertosDoMesmoPaciente: contagemPorChave.get(chave) || 1,
    }));
  }

  let filtrados = orcamentos.filter(o => filtro === 'todos' || o.status === filtro);
  if (filtro === 'apresentado') {
    filtrados = [...filtrados].sort((a, b) => (scorePorId.get(b.id) ?? 0) - (scorePorId.get(a.id) ?? 0));
  } else if (filtro === 'todos') {
    // Abertos (o que ainda precisa de decisão) sempre primeiro, ordenados
    // por prioridade real; o histórico já decidido continua depois, na
    // ordem original — nunca reordenado sem motivo.
    const abertosOrdenados = [...filtrados].filter(o => o.status === 'apresentado')
      .sort((a, b) => (scorePorId.get(b.id) ?? 0) - (scorePorId.get(a.id) ?? 0));
    const resto = filtrados.filter(o => o.status !== 'apresentado');
    filtrados = [...abertosOrdenados, ...resto];
  }

  return (
    <AdminShell
      title="Orçamentos"
      subtitle={`${filtrados.length} orçamento${filtrados.length !== 1 ? 's' : ''}${quantidadeParados > 0 ? ` · ${quantidadeParados} parado${quantidadeParados !== 1 ? 's' : ''} sem decisão` : ''}`}
      actionLabel="+ Novo orçamento"
      actionOnClick={abrirNovo}
    >
      <style>{`
        .orc-card { transition: background 0.15s, border-color 0.15s; }
        .orc-card:hover { background: #222540 !important; border-color: rgba(31,78,95,0.45) !important; }
        .orc-btn-aprovar:hover:not(:disabled) { filter: brightness(1.15); }
        .orc-btn-recusar:hover:not(:disabled) { background: rgba(248,113,113,0.1) !important; }
        .orc-btn-expirar:hover:not(:disabled) { background: rgba(148,163,184,0.1) !important; }
        .orc-ord-pill:hover { border-color: #3d4360 !important; color: #94a3b8 !important; }
        .orc-btn-cancelar:hover { background: rgba(148,163,184,0.08) !important; border-color: #3d4360 !important; }
        .orc-btn-salvar:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>

      {carregando && <PageLoader title="Carregando orçamentos..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}
      {!carregando && sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />}

      {/* ── FILTRO POR STATUS ────────────────────────────────────────────── */}
      {!carregando && orcamentos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'apresentado', label: 'Aguardando decisão' },
            { key: 'aprovado', label: 'Aprovados' },
            { key: 'recusado', label: 'Recusados' },
            { key: 'expirado', label: 'Expirados' },
          ] as const).map(({ key, label }) => {
            const ativo = filtro === key;
            return (
              <button key={key} className={ativo ? undefined : 'orc-ord-pill'} onClick={() => setFiltro(key)} style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                border: `1px solid ${ativo ? '#1F4E5F' : '#2d3148'}`,
                background: ativo ? 'rgba(31,78,95,0.2)' : 'transparent',
                color: ativo ? '#4a9bb0' : '#64748b',
                fontWeight: ativo ? 600 : 400, whiteSpace: 'nowrap',
                transition: 'border-color 0.15s, color 0.15s',
              }}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── ESTADO VAZIO ─────────────────────────────────────────────────── */}
      {!carregando && orcamentos.length === 0 && (
        <EmptyState
          icon="💰"
          title="Ainda não há orçamentos registrados."
          description="Registre o primeiro orçamento apresentado a um cliente para começar a acompanhar decisões e receita parada."
          actionLabel="➕ Registrar orçamento"
          onAction={abrirNovo}
        />
      )}

      {!carregando && orcamentos.length > 0 && filtrados.length === 0 && (
        <EmptyState compact icon="🔍" title="Nenhum orçamento neste filtro." actionLabel="Ver todos" onAction={() => setFiltro('todos')} />
      )}

      {/* ── LISTA ────────────────────────────────────────────────────────── */}
      {!carregando && filtrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(o => {
            const st = STATUS_CONFIG[o.status];
            const parado = o.status === 'apresentado' && estaParado(o.apresentado_em, agora);
            const dias = diasParado(o.apresentado_em, agora);
            const score = o.status === 'apresentado' ? scorePorId.get(o.id) ?? null : null;
            const tier = score !== null ? tierDoScore(score) : null;
            const proximaAcao = o.status !== 'apresentado'
              ? null
              : !parado ? 'Aguardando decisão do cliente'
              : tier === 'alta' ? 'Priorizar contato hoje — fazer follow-up do orçamento'
              : 'Fazer follow-up do orçamento';
            const chaveCliente = normalizar(o.telefone || '') || o.paciente_nome.trim().toLowerCase();
            const outrosAbertosDoCliente = tier !== null ? (contagemPorChave.get(chaveCliente) || 1) - 1 : 0;
            const motivoScore = tier !== null
              ? `Score ${score}/100 — parado há ${dias} dia${dias === 1 ? '' : 's'}` +
                (valorMaximoEntreAbertos > 0 && o.valor === valorMaximoEntreAbertos ? ', maior valor entre os abertos' : '') +
                (outrosAbertosDoCliente > 0 ? `, +${outrosAbertosDoCliente} outro${outrosAbertosDoCliente === 1 ? '' : 's'} orçamento${outrosAbertosDoCliente === 1 ? '' : 's'} aberto${outrosAbertosDoCliente === 1 ? '' : 's'} deste cliente` : '')
              : null;

            return (
              <div key={o.id} className="orc-card" style={{ background: '#1e2130', border: `1px solid ${parado ? 'rgba(251,191,36,0.35)' : '#2d3148'}`, borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {o.paciente_nome.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15, marginBottom: 4 }}>{o.paciente_nome}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {[o.procedimento, o.telefone].filter(Boolean).join('  ·  ')}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 5, color: '#475569' }}>
                      Apresentado em {formatarData(o.apresentado_em)}
                      {o.status === 'apresentado' && ` · há ${dias} dia${dias === 1 ? '' : 's'}`}
                    </div>
                    {parado && (
                      <div style={{ fontSize: 12, marginTop: 6, color: '#fbbf24', fontWeight: 600 }}>
                        ⏱ Parado sem decisão
                      </div>
                    )}
                    {motivoScore && (
                      <div style={{ fontSize: 11.5, marginTop: 6, color: '#64748b', fontStyle: 'italic' }}>
                        {motivoScore}
                      </div>
                    )}
                    {o.motivo_decisao && (
                      <div style={{ fontSize: 12, marginTop: 6, color: '#94a3b8' }}>
                        Motivo: {MOTIVO_LABELS[o.motivo_decisao as MotivoDecisao]}
                      </div>
                    )}
                    {proximaAcao && (
                      parado ? (
                        // Parado tem ação real a tomar — leva para /follow-up,
                        // a mesma superfície onde orçamento_parado já vira caso
                        // de "Registrar contato"/"Aprovar envio" (lib/follow-up-
                        // comercial.ts). Nenhuma rota nova, nenhuma automação
                        // nova — só liga o texto (antes decorativo) à ação real
                        // que já existe.
                        <button
                          type="button"
                          onClick={() => router.push('/follow-up')}
                          style={{ display: 'block', marginTop: 6, padding: 0, border: 'none', background: 'transparent', color: '#4a9bb0', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}
                        >
                          ➜ {proximaAcao} →
                        </button>
                      ) : (
                        <div style={{ fontSize: 12, marginTop: 6, color: '#4a9bb0' }}>
                          ➜ Próxima ação: {proximaAcao}
                        </div>
                      )
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{formatarValor(o.valor)}</div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                    {tier && (
                      <span title={`Score de prioridade: ${score}/100`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: 'rgba(255,255,255,0.05)', border: `1px solid ${TIER_SCORE_CONFIG[tier].color}55`, color: TIER_SCORE_CONFIG[tier].color }}>
                        {TIER_SCORE_CONFIG[tier].label} · {score}
                      </span>
                    )}
                    {o.status === 'apresentado' && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          className="orc-btn-aprovar"
                          disabled={transicionando.has(o.id)}
                          onClick={() => transicionar(o, 'aprovado')}
                          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          {transicionando.has(o.id) ? '...' : 'Aprovado'}
                        </button>
                        <button
                          className="orc-btn-recusar"
                          disabled={transicionando.has(o.id)}
                          onClick={() => { setModalRecusar(o); setMotivoRecusa(''); }}
                          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #450a0a', background: 'transparent', color: '#f87171', fontSize: 11, cursor: 'pointer' }}
                        >
                          Recusado
                        </button>
                        <button
                          className="orc-btn-expirar"
                          disabled={transicionando.has(o.id)}
                          onClick={() => transicionar(o, 'expirado')}
                          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}
                        >
                          Expirado
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: NOVO ORÇAMENTO ───────────────────────────────────────────── */}
      {modalNovo && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModalNovo(false); }}
        >
          <div style={{ background: '#1e2130', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3148' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 24, marginTop: 0 }}>Novo orçamento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Cliente cadastrado (opcional)
                </label>
                <select
                  value={form.pacienteId}
                  onChange={e => selecionarCliente(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="">— Digitar manualmente —</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</label>
                <input
                  placeholder="Ex: Maria Silva"
                  value={form.paciente_nome}
                  onChange={e => setForm(prev => ({ ...prev, paciente_nome: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telefone</label>
                <input
                  placeholder="Ex: 11999999999"
                  value={form.telefone}
                  onChange={e => setForm(prev => ({ ...prev, telefone: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Serviço</label>
                <input
                  placeholder="Ex: Consultoria mensal"
                  value={form.procedimento}
                  onChange={e => setForm(prev => ({ ...prev, procedimento: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor (R$)</label>
                <input
                  type="number" min="0.01" step="0.01"
                  placeholder="Ex: 1500.00"
                  value={form.valor}
                  onChange={e => setForm(prev => ({ ...prev, valor: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observação (opcional)</label>
                <textarea
                  placeholder="Ex: Cliente pediu para retornar na próxima semana"
                  value={form.observacao}
                  onChange={e => setForm(prev => ({ ...prev, observacao: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            {erro && <div style={{ marginTop: 16 }}><Feedback type="erro" message={erro} onClose={() => setErro('')} /></div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                className="orc-btn-cancelar"
                onClick={() => setModalNovo(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s' }}
              >
                Cancelar
              </button>
              <button
                className="orc-btn-salvar"
                onClick={salvar}
                disabled={salvando}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: salvando ? 0.7 : 1, transition: 'filter 0.15s' }}
              >
                {salvando ? 'Salvando...' : 'Registrar orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: RECUSAR (motivo opcional) ─────────────────────────────────── */}
      {modalRecusar && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1020, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModalRecusar(null); }}
        >
          <div style={{ background: '#1e2130', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, border: '1px solid #2d3148' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 8, marginTop: 0 }}>
              Marcar orçamento de {modalRecusar.paciente_nome} como recusado
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Esta transição é final — não pode ser desfeita.</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo (opcional)</label>
            <select
              value={motivoRecusa}
              onChange={e => setMotivoRecusa(e.target.value as MotivoDecisao | '')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="">— Não informar —</option>
              {MOTIVOS_DECISAO.map(m => <option key={m} value={m}>{MOTIVO_LABELS[m]}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                className="orc-btn-cancelar"
                onClick={() => setModalRecusar(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                disabled={transicionando.has(modalRecusar.id)}
                onClick={() => transicionar(modalRecusar, 'recusado', motivoRecusa || undefined)}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: '1px solid #450a0a', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {transicionando.has(modalRecusar.id) ? 'Confirmando...' : 'Confirmar recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
