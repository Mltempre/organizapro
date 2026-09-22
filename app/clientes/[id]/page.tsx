'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import AdminShell from '../../components/AdminShell';
import PageLoader from '../../components/PageLoader';
import EmptyState from '../../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../../components/Feedback';
import { gerarCliente360, type ResumoCliente360, type TipoEventoTimeline } from '../../../lib/cliente-360';
import type { OportunidadeStatus } from '../../../lib/oportunidades-demanda';
import type { StatusOrcamento } from '../../../lib/motor-orcamentos';
import type { StatusTratamento } from '../../../lib/motor-tratamento';
import type { StatusCobranca } from '../../../lib/motor-cobranca';

// ── Cliente 360 V1 ────────────────────────────────────────────────────
// public.pacientes continua sendo a ÚNICA fonte da identidade do
// cliente — esta tela só CONSOLIDA dados já reais de outros domínios,
// nunca cria um registro novo de cliente. Mesmo padrão de fetch já
// usado em app/receita-perdida/page.tsx, app/previsor-faturamento/
// page.tsx e app/linha-economica/page.tsx: só as APIs/consultas já
// canônicas, escopadas por clinica_id, e toda a decisão delegada a
// lib/cliente-360.ts. Agendamentos/avaliações são lidos direto da
// tabela (mesmo padrão já usado por app/clientes/page.tsx
// carregarHistorico — RLS já libera authenticated para pacientes/
// agendamentos, diferente de orcamentos/cobrancas/tratamentos/pedidos,
// que são service-role-only e por isso passam pelas APIs).

type PacienteRow = { id: string; nome: string; telefone: string | null; whatsapp: string | null; email: string | null; status: string; proxima_consulta: string | null; created_at: string };
type AgendamentoRow = { id: string; telefone: string | null; data: string; hora: string; tipo_consulta: string; status: string };
type AvaliacaoRow = { id: string; telefone: string | null; enviado_em: string | null; respondeu: boolean; clicado_em: string | null };
type OportunidadeRow = { id: string; telefone: string; canal: 'whatsapp' | 'manual' | 'site'; status: OportunidadeStatus; criado_em: string; ultima_interacao_em: string };
type OrcamentoRow = { id: string; telefone: string | null; procedimento: string; valor: number; status: string; apresentado_em: string; decidido_em: string | null };
type TratamentoRow = { id: string; paciente_id: string | null; paciente_telefone: string | null; tipo_tratamento: string; status: string; valor_estimado: number | null; proxima_data_prevista: string | null; iniciado_em: string; concluido_em: string | null };
type CobrancaRow = { id: string; paciente_id: string | null; paciente_telefone: string | null; descricao: string; valor: number; valor_pago: number | null; vencimento: string; status: string; pago_em: string | null; em_cobranca_em: string | null };
type PedidoRow = { id: string; paciente_id: string | null; telefone: string | null; valor_centavos: number; status: string; criado_em: string; pagamento_confirmado_em: string | null; pedido_itens?: { descricao: string }[] };

// Memória com Proveniência + Auditoria das Decisões (P1: Reintegração da
// Inteligência) — vem de GET /api/memoria, que já lê eventos_dominio
// (memoria.fato/auditoria.decisao/auditoria.resultado_posterior)
// escopado por clinica_id + paciente_id. Payload exatamente como
// lib/memoria-proveniencia.ts e lib/auditoria-decisoes.ts já definem.
type FatoRow = { id: string; criado_em: string; payload: { tipo_fato: string; conteudo: string; observado_em: string; origem: { tipo: 'humano'; autorNome: string } | { tipo: 'entidade_canonica' } } };
type DecisaoRow = { id: string; tipo: 'auditoria.decisao' | 'auditoria.resultado_posterior'; criado_em: string; payload: { decisao?: string; motor?: string; fato_observado?: string } };

const TIPO_LABELS: Record<TipoEventoTimeline, string> = {
  agendamento: '📅', oportunidade: '📡', orcamento: '💰', tratamento: '🩺',
  cobranca: '🧾', pagamento_cobranca: '✅', pedido: '🛒', pagamento_pedido: '✅', avaliacao: '⭐',
};

function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarDataHora(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR') + (iso.includes('T') && !iso.endsWith('T') ? ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
}

export default function Cliente360Page() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [resumo, setResumo] = useState<ResumoCliente360 | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [clinicaId, setClinicaId] = useState('');
  const [fatos, setFatos] = useState<FatoRow[]>([]);
  const [decisoes, setDecisoes] = useState<DecisaoRow[]>([]);
  const [novoFato, setNovoFato] = useState('');
  const [salvandoFato, setSalvandoFato] = useState(false);
  const [erroFato, setErroFato] = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro(''); setNaoEncontrado(false);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      const auth = { Authorization: `Bearer ${session.access_token}` };

      const cuRes = await fetch('/api/minha-clinica', { headers: auth });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      if (!cid) { setCarregando(false); return; }
      setClinicaId(cid);

      // Cliente sempre escopado por id E clinica_id — nunca um paciente
      // de outro tenant é retornado (fail-closed: RLS + filtro explícito).
      const { data: pacienteData } = await supabase
        .from('pacientes').select('*').eq('id', params.id).eq('clinica_id', cid).maybeSingle();
      if (!pacienteData) { setNaoEncontrado(true); setCarregando(false); return; }
      const paciente = pacienteData as PacienteRow;

      const [agendamentosRes, avaliacoesRes, oportunidadesRes, orcamentosRes, tratamentosRes, cobrancasRes, pedidosRes, memoriaRes] = await Promise.all([
        supabase.from('agendamentos').select('id, telefone, data, hora, tipo_consulta, status').eq('clinica_id', cid),
        supabase.from('avaliacoes').select('id, telefone, enviado_em, respondeu, clicado_em').eq('clinica_id', cid),
        fetch('/api/oportunidades', { headers: auth }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`/api/orcamentos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { orcamentos: [] }).catch(() => ({ orcamentos: [] })),
        fetch(`/api/tratamentos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { tratamentos: [] }).catch(() => ({ tratamentos: [] })),
        fetch(`/api/cobrancas?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { cobrancas: [] }).catch(() => ({ cobrancas: [] })),
        fetch(`/api/pedidos?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { pedidos: [] }).catch(() => ({ pedidos: [] })),
        fetch(`/api/memoria?clinica_id=${cid}&paciente_id=${params.id}`, { headers: auth }).then(r => r.ok ? r.json() : { fatos: [], decisoes: [] }).catch(() => ({ fatos: [], decisoes: [] })),
      ]);

      const agendamentos: AgendamentoRow[] = (agendamentosRes.data ?? []) as AgendamentoRow[];
      const avaliacoes: AvaliacaoRow[] = (avaliacoesRes.data ?? []) as AvaliacaoRow[];
      const oportunidades: OportunidadeRow[] = oportunidadesRes.data ?? [];
      const orcamentos: OrcamentoRow[] = orcamentosRes.orcamentos ?? [];
      const tratamentos: TratamentoRow[] = tratamentosRes.tratamentos ?? [];
      const cobrancas: CobrancaRow[] = cobrancasRes.cobrancas ?? [];
      const pedidos: PedidoRow[] = pedidosRes.pedidos ?? [];
      setFatos((memoriaRes.fatos ?? []) as FatoRow[]);
      setDecisoes((memoriaRes.decisoes ?? []) as DecisaoRow[]);

      const r = gerarCliente360({
        cliente: {
          id: paciente.id, nome: paciente.nome, telefone: paciente.telefone, whatsapp: paciente.whatsapp,
          email: paciente.email, status: paciente.status, proximaConsulta: paciente.proxima_consulta, criadoEm: paciente.created_at,
        },
        agora: new Date().toISOString(),
        agendamentos: agendamentos.map(a => ({ id: a.id, telefone: a.telefone, data: a.data, hora: a.hora, tipoConsulta: a.tipo_consulta, status: a.status })),
        oportunidades: oportunidades.map(o => ({ id: o.id, telefone: o.telefone, canal: o.canal, status: o.status, criadoEm: o.criado_em, ultimaInteracaoEm: o.ultima_interacao_em })),
        orcamentos: orcamentos.map(o => ({ id: o.id, telefone: o.telefone, procedimento: o.procedimento, valor: o.valor, status: o.status as StatusOrcamento, apresentadoEm: o.apresentado_em, decididoEm: o.decidido_em })),
        tratamentos: tratamentos.map(t => ({ id: t.id, pacienteId: t.paciente_id, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status as StatusTratamento, valorEstimado: t.valor_estimado, proximaDataPrevista: t.proxima_data_prevista, iniciadoEm: t.iniciado_em, concluidoEm: t.concluido_em })),
        cobrancas: cobrancas.map(c => ({ id: c.id, pacienteId: c.paciente_id, telefone: c.paciente_telefone, descricao: c.descricao, valor: c.valor, valorPago: c.valor_pago, vencimento: c.vencimento, status: c.status as StatusCobranca, pagoEm: c.pago_em, emCobrancaEm: c.em_cobranca_em })),
        pedidos: pedidos.map(p => ({ id: p.id, pacienteId: p.paciente_id, telefone: p.telefone, descricao: p.pedido_itens?.length ? `${p.pedido_itens.length} ${p.pedido_itens.length === 1 ? 'item' : 'itens'}` : 'pedido', valor: p.valor_centavos / 100, status: p.status as 'criado' | 'confirmado' | 'aguardando_confirmacao_pagamento' | 'pago' | 'cancelado', criadoEm: p.criado_em, pagamentoConfirmadoEm: p.pagamento_confirmado_em })),
        avaliacoes: avaliacoes.map(av => ({ id: av.id, telefone: av.telefone, enviadoEm: av.enviado_em, respondeu: av.respondeu, clicadoEm: av.clicado_em })),
      });

      setResumo(r);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router, params.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const adicionarFato = useCallback(async () => {
    if (!novoFato.trim() || !clinicaId || !resumo) return;
    setSalvandoFato(true); setErroFato('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || !user) { router.push('/login'); return; }
      const autorNome = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Equipe';
      const res = await fetch('/api/memoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          clinica_id: clinicaId, paciente_id: params.id, telefone: resumo.cliente.telefone,
          tipo_fato: 'observacao_manual', conteudo: novoFato.trim(),
          observado_em: new Date().toISOString(), autor_nome: autorNome,
        }),
      });
      if (!res.ok) { setErroFato((await res.json()).error || MSG_ERRO_PADRAO); return; }
      setNovoFato('');
      await carregar();
    } catch {
      setErroFato(MSG_ERRO_PADRAO);
    } finally {
      setSalvandoFato(false);
    }
  }, [novoFato, clinicaId, resumo, params.id, router, carregar]);

  return (
    <AdminShell title={resumo ? resumo.cliente.nome : 'Cliente 360'} subtitle="Visão consolidada — só dados reais, nenhum resumo fabricado">
      {carregando && <PageLoader title="Reconstruindo a história do cliente..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}
      {!carregando && naoEncontrado && (
        <EmptyState icon="🔍" title="Cliente não encontrado." description="Ele pode ter sido removido, ou não pertence a este negócio." actionLabel="Voltar para Clientes" onAction={() => router.push('/clientes')} />
      )}

      {!carregando && resumo && (
        <>
          {/* IDENTIFICAÇÃO */}
          <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Identificação</div>
            <div style={{ fontSize: 13, color: '#f1f5f9' }}>
              {[resumo.cliente.telefone, resumo.cliente.email].filter(Boolean).join('  ·  ') || 'Sem contato cadastrado'}
            </div>
          </div>

          {/* INDICADORES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 24 }}>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Total pago</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>{formatarValor(resumo.indicadores.totalPago)}</div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Em aberto</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: resumo.indicadores.totalEmAberto > 0 ? '#fbbf24' : '#f1f5f9' }}>{formatarValor(resumo.indicadores.totalEmAberto)}</div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Compras (pedidos pagos)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{resumo.indicadores.quantidadeCompras}</div>
            </div>
            <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Próximo compromisso</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: resumo.indicadores.proximoCompromisso ? '#4a9bb0' : '#64748b' }}>
                {resumo.indicadores.proximoCompromisso ? formatarDataHora(resumo.indicadores.proximoCompromisso) : '—'}
              </div>
            </div>
            {resumo.indicadores.temOportunidadeAtiva && (
              <div style={{ background: 'rgba(74,155,176,0.1)', border: '1px solid rgba(74,155,176,0.3)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#4a9bb0', marginBottom: 4 }}>📡 Oportunidade ativa</div>
                <button onClick={() => router.push('/oportunidades')} style={{ background: 'transparent', border: 'none', color: '#4a9bb0', fontSize: 12, cursor: 'pointer', padding: 0 }}>Ver →</button>
              </div>
            )}
          </div>

          {/* TIMELINE */}
          {resumo.timeline.length === 0 && (
            <EmptyState icon="📋" title="Nenhum histórico real encontrado para este cliente." description="Nenhum agendamento, oportunidade, orçamento, tratamento, cobrança, pedido ou avaliação vinculado até agora." />
          )}
          {resumo.timeline.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Linha do tempo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resumo.timeline.map((evento, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16 }}>{TIPO_LABELS[evento.tipo]}</span>
                    <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#f1f5f9' }}>{evento.descricao}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{formatarDataHora(evento.data)}</div>
                    {evento.valor !== null && <div style={{ fontSize: 13, fontWeight: 700, color: '#4a9bb0' }}>{formatarValor(evento.valor)}</div>}
                    <button onClick={() => router.push(evento.destino)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver →</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MEMÓRIA & DECISÕES DA IA (P1: Reintegração da Inteligência) —
              lib/memoria-proveniencia.ts (fatos humanos, com proveniência
              obrigatória) e lib/auditoria-decisoes.ts (evidência real de
              por que uma recomendação apareceu) num único painel, nunca
              duas telas separadas para "o que o OrganizaPro sabe/decidiu
              sobre este cliente". */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🧠 Memória &amp; decisões da IA
            </div>

            {fatos.length === 0 && decisoes.length === 0 && (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                Nenhum fato registrado nem decisão auditada para este cliente ainda.
              </div>
            )}

            {fatos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {fatos.map(f => (
                  <div key={f.id} style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '10px 16px' }}>
                    <div style={{ fontSize: 13, color: '#f1f5f9', marginBottom: 4 }}>{f.payload.conteudo}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {f.payload.origem.tipo === 'humano' ? f.payload.origem.autorNome : 'Sistema'} · {formatarDataHora(f.payload.observado_em)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {decisoes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {decisoes.map(d => (
                  <div key={d.id} style={{ background: 'rgba(74,155,176,0.06)', border: '1px solid rgba(74,155,176,0.2)', borderRadius: 10, padding: '10px 16px' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {d.tipo === 'auditoria.decisao'
                        ? `Decisão: ${d.payload.decisao} (${d.payload.motor})`
                        : `Resultado observado: ${d.payload.fato_observado}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{formatarDataHora(d.criado_em)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text" value={novoFato} onChange={e => setNovoFato(e.target.value)}
                placeholder="Registrar um fato real (ex.: combinado retorno sexta-feira)"
                style={{ flex: 1, minWidth: 220, background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 12.5 }}
              />
              <button
                onClick={adicionarFato} disabled={salvandoFato || !novoFato.trim()}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4a9bb0', color: '#0a0d14', fontSize: 12.5, fontWeight: 700, cursor: salvandoFato ? 'default' : 'pointer', opacity: salvandoFato || !novoFato.trim() ? 0.6 : 1 }}
              >
                {salvandoFato ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
            {erroFato && <div style={{ fontSize: 11.5, color: '#f87171', marginTop: 6 }}>{erroFato}</div>}
          </div>
        </>
      )}
    </AdminShell>
  );
}
