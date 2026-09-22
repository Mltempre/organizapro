'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import {
  estaAtrasada, diasAtraso, calcularScoreCobranca, calcularIndicadoresCobranca,
  MOTIVOS_CANCELAMENTO, type Cobranca, type StatusCobranca, type MotivoCancelamento,
} from '../../lib/motor-cobranca';

// ── Superfície operacional de Cobranças (Financeiro/Cobrador AI V1) ──────
// Usa só as APIs já construídas e testadas (GET/POST /api/cobrancas,
// POST /api/cobrancas/[id]/transicao) — nenhuma query direta a
// public.cobrancas aqui (RLS habilitada sem policy, service role only,
// mesmo padrão de orcamentos/tratamentos/pedidos). "Cobrador AI" aqui não
// é um agente novo: é a mesma priorização/score já usado no Radar
// (lib/motor-cobranca.ts, calcularScoreCobranca), aplicado nesta tela.
// Indicadores financeiros são derivados 100% dos dados já buscados aqui
// (calcularIndicadoresCobranca) — nunca uma segunda consulta, nunca um
// número fabricado.

type TratamentoPicker = { id: string; paciente_nome: string; tipo_tratamento: string; valor_estimado: number | null };
type ClientePicker = { id: string; nome: string; telefone: string | null; whatsapp: string | null };

type FormNovo = {
  pacienteId: string;
  tratamentoId: string;
  paciente_nome: string;
  telefone: string;
  descricao: string;
  valor: string;
  vencimento: string;
  observacao: string;
};
const formInicial: FormNovo = { pacienteId: '', tratamentoId: '', paciente_nome: '', telefone: '', descricao: '', valor: '', vencimento: '', observacao: '' };

const STATUS_CONFIG: Record<StatusCobranca, { label: string; color: string; bg: string }> = {
  pendente:     { label: 'Pendente',    color: '#38bdf8', bg: 'rgba(14,165,233,0.14)' },
  em_cobranca:  { label: 'Em cobrança', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  pago:         { label: 'Pago',        color: '#16a34a', bg: '#dcfce7' },
  cancelada:    { label: 'Cancelada',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
};
const MOTIVO_LABELS: Record<MotivoCancelamento, string> = {
  negociado: 'Negociado', erro_lancamento: 'Erro de lançamento',
  paciente_nao_localizado: 'Cliente não localizado', inadimplencia_assumida: 'Inadimplência assumida', outro: 'Outro motivo',
};

function normalizar(tel: string) { return tel.replace(/\D/g, ''); }
function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function hojeStr() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }

export default function CobrancasPage() {
  const router = useRouter();
  const [cobrancas, setCobrancas]     = useState<Cobranca[]>([]);
  const [pacientes, setPacientes]     = useState<ClientePicker[]>([]);
  const [tratamentos, setTratamentos] = useState<TratamentoPicker[]>([]);
  const [clinicaId, setClinicaId]     = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [carregando, setCarregando]   = useState(true);
  const [erro, setErro]               = useState('');
  const [sucesso, setSucesso]         = useState('');
  const [filtro, setFiltro]           = useState<'todos' | StatusCobranca>('todos');

  const [modalNovo, setModalNovo]     = useState(false);
  const [form, setForm]               = useState<FormNovo>(formInicial);
  const [salvando, setSalvando]       = useState(false);
  const idempotencyKeyRef = React.useRef('');

  const [transicionando, setTransicionando] = useState<string | null>(null);
  const [modalCancelar, setModalCancelar]   = useState<Cobranca | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState<MotivoCancelamento | ''>('');

  // Cobrador Digital V1 — modo estritamente preparatório: só prepara e
  // registra a tentativa (POST /api/cobrancas/[id]/tentativa), nunca
  // envia WhatsApp. mensagemPreparada guarda o texto pronto pra copiar.
  const [preparando, setPreparando]           = useState<string | null>(null);
  const [mensagemPreparada, setMensagemPreparada] = useState<{ cobrancaId: string; texto: string } | null>(null);

  // WhatsApp Governado V1 — bloco APROVAR: só depois de "Preparar
  // cobrança" o botão abaixo chama POST /api/cobrancas/[id]/aprovar-envio,
  // que revalida tudo de novo e só então chama o adaptador real (Z-API).
  const [enviando, setEnviando]           = useState<string | null>(null);
  const [enviadosAgora, setEnviadosAgora] = useState<Set<string>>(new Set());
  const idempotencyEnvioRef = React.useRef<Record<string, string>>({});

  // A key fica estável só ENQUANTO a tentativa atual está em voo (protege
  // contra duplo-clique disparando duas requisições para o mesmo envio,
  // antes do botão desabilitar). Assim que a resposta chega — sucesso OU
  // falha — a key é descartada: a próxima aprovação explícita do usuário
  // (novo clique) gera uma key NOVA, exatamente como o backend já espera
  // (ver comentário de app/api/cobrancas/[id]/aprovar-envio/route.ts:15-16:
  // "uma falha permite nova tentativa no mesmo dia com uma nova
  // idempotency_key"). Mesma correção já aplicada em app/follow-up/
  // page.tsx — antes desta correção a key nunca era descartada aqui, um
  // envio falho travava qualquer retry com 409 "já foi solicitado", mesmo
  // sem nada ter sido de fato entregue.
  function idempotencyKeyEnvioPara(cobrancaId: string): string {
    if (!idempotencyEnvioRef.current[cobrancaId]) idempotencyEnvioRef.current[cobrancaId] = crypto.randomUUID();
    return idempotencyEnvioRef.current[cobrancaId];
  }

  async function aprovarEnvio(c: Cobranca) {
    setEnviando(c.id);
    try {
      const res = await fetch(`/api/cobrancas/${c.id}/aprovar-envio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clinica_id: clinicaId, idempotency_key: idempotencyKeyEnvioPara(c.id) }),
      });
      const json = await res.json();
      delete idempotencyEnvioRef.current[c.id];
      if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
      setEnviadosAgora(prev => new Set(prev).add(c.id));
      setMensagemPreparada(null);
      setSucesso('Mensagem enviada pelo WhatsApp.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      delete idempotencyEnvioRef.current[c.id];
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setEnviando(null);
    }
  }

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
      if (!cid) { setCobrancas([]); setCarregando(false); return; }

      const [cobRes, tratRes, pacRes] = await Promise.all([
        fetch(`/api/cobrancas?clinica_id=${cid}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch(`/api/tratamentos?clinica_id=${cid}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        supabase.from('pacientes').select('id, nome, telefone, whatsapp').eq('clinica_id', cid).order('nome'),
      ]);

      if (cobRes.ok) {
        const json = await cobRes.json();
        setCobrancas(Array.isArray(json.cobrancas) ? json.cobrancas : []);
      } else {
        setCobrancas([]);
        // status != 404 é falha real — precisa ficar visível, nunca virar
        // silenciosamente "nenhuma cobrança".
        if (cobRes.status !== 404) { console.error('Erro ao carregar cobranças:', cobRes.status); setErro(MSG_ERRO_PADRAO); }
      }
      if (tratRes.ok) {
        const json = await tratRes.json();
        setTratamentos(Array.isArray(json.tratamentos) ? json.tratamentos : []);
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

  function selecionarTratamento(id: string) {
    const t = tratamentos.find(x => x.id === id);
    setForm(prev => ({
      ...prev, tratamentoId: id,
      paciente_nome: t?.paciente_nome ?? prev.paciente_nome,
      descricao: t ? t.tipo_tratamento : prev.descricao,
      valor: t?.valor_estimado ? String(t.valor_estimado) : prev.valor,
    }));
  }

  async function salvar() {
    if (!form.paciente_nome.trim()) { setErro('Cliente é obrigatório.'); return; }
    if (!form.descricao.trim()) { setErro('Descrição é obrigatória.'); return; }
    if (!form.vencimento) { setErro('Vencimento é obrigatório.'); return; }
    const valorNumerico = Number(form.valor.replace(',', '.'));
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) { setErro('Valor deve ser um número maior que zero.'); return; }

    setSalvando(true); setErro('');
    const res = await fetch('/api/cobrancas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        clinica_id: clinicaId,
        paciente_nome: form.paciente_nome.trim(),
        telefone: form.telefone ? normalizar(form.telefone) : undefined,
        tratamento_origem_id: form.tratamentoId || undefined,
        descricao: form.descricao.trim(),
        valor: valorNumerico,
        vencimento: form.vencimento,
        observacao: form.observacao.trim() || undefined,
        idempotency_key: idempotencyKeyRef.current,
      }),
    });
    const json = await res.json();
    setSalvando(false);
    if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
    setModalNovo(false);
    carregar();
    setSucesso('Cobrança registrada.');
    setTimeout(() => setSucesso(''), 3500);
  }

  async function transicionar(c: Cobranca, novo_status: StatusCobranca, opts?: { valor_pago?: number; motivo_cancelamento?: MotivoCancelamento }) {
    setTransicionando(c.id);
    try {
      const res = await fetch(`/api/cobrancas/${c.id}/transicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clinica_id: clinicaId, novo_status, ...opts }),
      });
      const json = await res.json();
      if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
      setModalCancelar(null); setMotivoCancelamento('');
      carregar();
      setSucesso('Cobrança atualizada.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setTransicionando(null);
    }
  }

  async function prepararTentativa(c: Cobranca) {
    setPreparando(c.id);
    setMensagemPreparada(null);
    try {
      const res = await fetch(`/api/cobrancas/${c.id}/tentativa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clinica_id: clinicaId }),
      });
      const json = await res.json();
      if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
      setMensagemPreparada({ cobrancaId: c.id, texto: json.mensagem });
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setPreparando(null);
    }
  }

  const hoje = hojeStr();
  const agora = new Date().toISOString();
  const filtradas = cobrancas.filter(c => filtro === 'todos' || c.status === filtro);

  // Cobrador AI — mesma priorização real do Radar (lib/motor-cobranca.ts),
  // nunca uma segunda lógica: cobranças abertas e atrasadas, ordenadas por
  // score (dias de atraso + valor relativo + recorrência do cliente).
  const abertas = cobrancas.filter(c => c.status === 'pendente' || c.status === 'em_cobranca');
  const atrasadas = abertas.filter(c => estaAtrasada(c.vencimento, hoje));
  const valorMaximoEntreAbertas = abertas.length ? Math.max(...abertas.map(c => c.valor)) : 0;
  const contagemPorTelefone = new Map<string, number>();
  for (const c of abertas) if (c.paciente_telefone) contagemPorTelefone.set(c.paciente_telefone, (contagemPorTelefone.get(c.paciente_telefone) ?? 0) + 1);
  const atencaoUrgente = atrasadas
    .map(c => ({
      cobranca: c,
      dias: diasAtraso(c.vencimento, hoje),
      score: calcularScoreCobranca({
        diasAtraso: diasAtraso(c.vencimento, hoje), valor: c.valor, valorMaximoEntreAbertas,
        quantidadeAbertasDoMesmoPaciente: c.paciente_telefone ? (contagemPorTelefone.get(c.paciente_telefone) ?? 1) : 1,
      }),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const indicadores = calcularIndicadoresCobranca(cobrancas, agora);

  return (
    <AdminShell
      title="Cobranças"
      // "atrasada(s)" é indicador SEMPRE global (atrasadas vem de
      // `abertas`/`cobrancas`, nunca de `filtradas`) — só aparece junto da
      // contagem filtrada quando o filtro ativo é 'todos', mesma correção
      // de app/tratamentos/page.tsx.
      subtitle={`${filtradas.length} cobrança${filtradas.length !== 1 ? 's' : ''}${filtro === 'todos' && atrasadas.length > 0 ? ` · ${atrasadas.length} atrasada${atrasadas.length !== 1 ? 's' : ''} no total` : ''}`}
      actionLabel="+ Nova cobrança"
      actionOnClick={abrirNovo}
    >
      <style>{`
        .cob-card { transition: background 0.15s, border-color 0.15s; }
        .cob-card:hover { background: #222540 !important; border-color: rgba(31,78,95,0.45) !important; }
        .cob-btn:hover:not(:disabled) { filter: brightness(1.15); }
        .cob-ord-pill:hover { border-color: #3d4360 !important; color: #94a3b8 !important; }
        .cob-btn-cancelar:hover { background: rgba(148,163,184,0.08) !important; border-color: #3d4360 !important; }
        .cob-btn-salvar:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>

      {carregando && <PageLoader title="Carregando cobranças..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}
      {!carregando && sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />}

      {/* Resumo financeiro — só números reais derivados das cobranças já carregadas, nunca fabricados */}
      {!carregando && cobrancas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Em aberto', valor: indicadores.valorEmAberto },
            { label: 'Em atraso', valor: indicadores.valorEmAtraso },
            { label: 'Recebido no mês', valor: indicadores.valorRecebidoMes },
            { label: 'Recuperado no mês', valor: indicadores.valorRecuperadoMes },
          ].map(card => (
            <div key={card.label} style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{card.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{card.valor !== null ? formatarValor(card.valor) : '—'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cobrador AI — quem precisa de atenção agora, mesma priorização do Radar */}
      {!carregando && atencaoUrgente.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⏱ Precisa de atenção agora</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {atencaoUrgente.map(({ cobranca: c, dias }) => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#f1f5f9' }}>
                    <strong>{c.paciente_nome}</strong> tem {formatarValor(c.valor)} ({c.descricao}) atrasado há {dias} dia{dias === 1 ? '' : 's'}.
                  </div>
                  <button className="cob-btn" disabled={transicionando === c.id} onClick={() => transicionar(c, 'em_cobranca')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#fbbf24,#d97706)', color: '#1e2130', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {c.status === 'em_cobranca' ? 'Já em cobrança' : 'Cobrar agora'}
                  </button>
                  {/* Cobrador Digital V1 — só prepara e registra a tentativa (idempotente por
                      dia); nunca envia WhatsApp real nesta versão (sem gate de autonomia). */}
                  <button className="cob-btn" disabled={!c.paciente_telefone || preparando === c.id} onClick={() => prepararTentativa(c)} title={!c.paciente_telefone ? 'Cliente sem telefone cadastrado' : undefined} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, fontWeight: 700, cursor: c.paciente_telefone ? 'pointer' : 'not-allowed', opacity: c.paciente_telefone ? 1 : 0.5 }}>
                    {preparando === c.id ? 'Preparando...' : 'Preparar cobrança'}
                  </button>
                </div>
                {mensagemPreparada?.cobrancaId === c.id && (
                  <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a9bb0', marginBottom: 4 }}>Mensagem preparada — copie e envie manualmente, ou aprove o envio automático pelo WhatsApp:</div>
                    {mensagemPreparada.texto}
                    <div style={{ marginTop: 8 }}>
                      <button className="cob-btn" disabled={enviando === c.id} onClick={() => aprovarEnvio(c)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {enviando === c.id ? 'Enviando...' : 'Aprovar e enviar pelo WhatsApp'}
                      </button>
                    </div>
                  </div>
                )}
                {enviadosAgora.has(c.id) && mensagemPreparada?.cobrancaId !== c.id && (
                  <div style={{ fontSize: 11, color: '#16a34a' }}>✓ Mensagem enviada pelo WhatsApp hoje.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!carregando && cobrancas.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'pendente', label: 'Pendentes' },
            { key: 'em_cobranca', label: 'Em cobrança' },
            { key: 'pago', label: 'Pagas' },
            { key: 'cancelada', label: 'Canceladas' },
          ] as const).map(({ key, label }) => {
            const ativo = filtro === key;
            return (
              <button key={key} className={ativo ? undefined : 'cob-ord-pill'} onClick={() => setFiltro(key)} style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                border: `1px solid ${ativo ? '#1F4E5F' : '#2d3148'}`,
                background: ativo ? 'rgba(31,78,95,0.2)' : 'transparent',
                color: ativo ? '#4a9bb0' : '#64748b', fontWeight: ativo ? 600 : 400, whiteSpace: 'nowrap',
              }}>{label}</button>
            );
          })}
        </div>
      )}

      {!carregando && cobrancas.length === 0 && (
        <EmptyState icon="🧾" title="Ainda não há cobranças registradas." description="Registre a primeira cobrança, avulsa ou vinculada a um tratamento." actionLabel="➕ Registrar cobrança" onAction={abrirNovo} />
      )}
      {!carregando && cobrancas.length > 0 && filtradas.length === 0 && (
        <EmptyState compact icon="🔍" title="Nenhuma cobrança neste filtro." actionLabel="Ver todas" onAction={() => setFiltro('todos')} />
      )}

      {!carregando && filtradas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(c => {
            const st = STATUS_CONFIG[c.status];
            const atrasada = (c.status === 'pendente' || c.status === 'em_cobranca') && estaAtrasada(c.vencimento, hoje);
            const dias = atrasada ? diasAtraso(c.vencimento, hoje) : 0;
            const proximaAcao = c.status === 'pendente' || c.status === 'em_cobranca'
              ? (atrasada ? 'Cobrar o pagamento pendente' : 'Aguardar vencimento')
              : null;

            return (
              <div key={c.id} className="cob-card" style={{ background: '#1e2130', border: `1px solid ${atrasada ? 'rgba(251,191,36,0.35)' : '#2d3148'}`, borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {c.paciente_nome.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15, marginBottom: 4 }}>{c.paciente_nome}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{[c.descricao, c.paciente_telefone].filter(Boolean).join('  ·  ')}</div>
                    <div style={{ fontSize: 12, marginTop: 5, color: '#475569' }}>
                      Vencimento {formatarData(c.vencimento)}
                      {atrasada && ` · atrasada há ${dias} dia${dias === 1 ? '' : 's'}`}
                    </div>
                    {c.motivo_cancelamento && <div style={{ fontSize: 12, marginTop: 6, color: '#94a3b8' }}>Motivo: {MOTIVO_LABELS[c.motivo_cancelamento as MotivoCancelamento]}</div>}
                    {c.status === 'pago' && c.valor_pago !== null && <div style={{ fontSize: 12, marginTop: 6, color: '#4ade80' }}>Pago: {formatarValor(c.valor_pago)}</div>}
                    {proximaAcao && <div style={{ fontSize: 12, marginTop: 6, color: '#4a9bb0' }}>➜ Próxima ação: {proximaAcao}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{formatarValor(c.valor)}</div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                    {(c.status === 'pendente' || c.status === 'em_cobranca') && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
                        {c.status === 'pendente' && (
                          <button className="cob-btn" disabled={transicionando === c.id} onClick={() => transicionar(c, 'em_cobranca')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', fontSize: 11, cursor: 'pointer' }}>Marcar em cobrança</button>
                        )}
                        <button className="cob-btn" disabled={transicionando === c.id} onClick={() => transicionar(c, 'pago', { valor_pago: c.valor })} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Marcar pago</button>
                        <button className="cob-btn" disabled={transicionando === c.id} onClick={() => { setModalCancelar(c); setMotivoCancelamento(''); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #450a0a', background: 'transparent', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>Cancelar</button>
                      </div>
                    )}
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
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 24, marginTop: 0 }}>Nova cobrança</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tratamento de origem (opcional)</label>
                <select value={form.tratamentoId} onChange={e => selecionarTratamento(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">— Cobrança avulsa —</option>
                  {tratamentos.map(t => <option key={t.id} value={t.id}>{t.paciente_nome} — {t.tipo_tratamento}{t.valor_estimado ? ` (${formatarValor(t.valor_estimado)})` : ''}</option>)}
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição</label>
                <input value={form.descricao} onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))} placeholder="Ex: Mensalidade de setembro" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor (R$)</label>
                <input type="number" min="0.01" step="0.01" value={form.valor} onChange={e => setForm(prev => ({ ...prev, valor: e.target.value }))} placeholder="Ex: 300.00" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vencimento</label>
                <input type="date" value={form.vencimento} onChange={e => setForm(prev => ({ ...prev, vencimento: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            {erro && <div style={{ marginTop: 16 }}><Feedback type="erro" message={erro} onClose={() => setErro('')} /></div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="cob-btn-cancelar" onClick={() => setModalNovo(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button className="cob-btn-salvar" onClick={salvar} disabled={salvando} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>
                {salvando ? 'Salvando...' : 'Registrar cobrança'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCancelar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1020, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setModalCancelar(null); }}>
          <div style={{ background: '#1e2130', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, border: '1px solid #2d3148' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 8, marginTop: 0 }}>Cancelar cobrança de {modalCancelar.paciente_nome}</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Esta transição é final — não pode ser desfeita.</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo (opcional)</label>
            <select value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value as MotivoCancelamento | '')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
              <option value="">— Não informar —</option>
              {MOTIVOS_CANCELAMENTO.map(m => <option key={m} value={m}>{MOTIVO_LABELS[m]}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="cob-btn-cancelar" onClick={() => setModalCancelar(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Voltar</button>
              <button disabled={transicionando === modalCancelar.id} onClick={() => transicionar(modalCancelar, 'cancelada', motivoCancelamento ? { motivo_cancelamento: motivoCancelamento } : undefined)} style={{ flex: 2, padding: '10px', borderRadius: 8, border: '1px solid #450a0a', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {transicionando === modalCancelar.id ? 'Confirmando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
