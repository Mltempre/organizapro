'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { fetchJsonSeguro } from '../../lib/fetch-seguro';
import { gerarFollowUpsComerciais, type CasoFollowUp, type TipoFollowUpProprio } from '../../lib/follow-up-comercial';
import { agregarClientesElegiveisRecompra } from '../../lib/motor-pedidos';
import type { OportunidadeStatus } from '../../lib/oportunidades-demanda';

// ── Follow-up Comercial Inteligente V1 · visão executiva ────────────────
// Nenhuma consulta nova, nenhum motor novo: reaproveita as mesmas APIs
// já usadas por app/receita-perdida/page.tsx e app/previsor-
// faturamento/page.tsx (/api/orcamentos, /api/tratamentos, /api/pedidos)
// e delega toda a classificação a lib/follow-up-comercial.ts. Cobrança
// atrasada e os sinais de Agenda Autônoma aparecem aqui só como
// referência (donoDoFluxo) — a ação real continua em /cobrancas e
// /agenda-autonoma, nunca duplicada aqui.

type OportunidadeRow = { id: string; telefone: string; nome_informado: string | null; status: string; orcamento_vinculado_id: string | null; ultima_interacao_em: string };
type OrcamentoRow = { id: string; paciente_nome: string; telefone: string | null; procedimento: string; valor: number; status: string; apresentado_em: string };
type TratamentoRow = { id: string; paciente_nome: string; paciente_telefone: string | null; tipo_tratamento: string; status: string; proxima_data_prevista: string | null; updated_at: string; interrompido_em: string | null };
type PedidoRow = { id: string; nome_cliente: string; telefone: string | null; valor_centavos: number; status: string; criado_em: string; paciente_id: string | null; pedido_itens?: { descricao: string }[] };
type CobrancaRow = { id: string; paciente_nome: string; paciente_telefone: string | null; descricao: string; valor: number; vencimento: string; status: string };

const TIPO_LABELS: Record<string, { label: string; icon: string }> = {
  oportunidade_parada: { label: 'Oportunidade parada', icon: '📡' },
  orcamento_parado: { label: 'Orçamento parado', icon: '💰' },
  tratamento_sem_retorno: { label: 'Tratamento sem retorno', icon: '🩺' },
  pedido_nao_concluido: { label: 'Pedido não concluído', icon: '🛒' },
  recompra_possivel: { label: 'Recompra possível', icon: '🔁' },
  cobranca_atrasada: { label: 'Cobrança atrasada', icon: '🧾' },
  cancelamento_sem_reagendamento: { label: 'Cancelamento sem reagendar', icon: '📅' },
  confirmacao_pendente: { label: 'Confirmação pendente', icon: '⏳' },
  sem_proximo_compromisso: { label: 'Sem próximo compromisso', icon: '📆' },
};

const DONO_LABELS = { 'follow-up': null, 'cobrador-digital': 'Gerenciado pelo Cobrador Digital', 'agenda-autonoma': 'Gerenciado pela Agenda Autônoma' } as const;

function hojeStr() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }

export default function FollowUpPage() {
  const router = useRouter();
  const [casos, setCasos] = useState<CasoFollowUp[]>([]);
  const [clinicaId, setClinicaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [falhaParcial, setFalhaParcial] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [registradosAgora, setRegistradosAgora] = useState<Set<string>>(new Set());
  const [mensagemPreparada, setMensagemPreparada] = useState<{ entidadeId: string; texto: string } | null>(null);

  // WhatsApp Governado V1 — bloco APROVAR: só depois de "Registrar
  // contato" (que prepara via POST /api/follow-up/tentativa) o botão
  // abaixo chama POST /api/follow-up/aprovar-envio, que relê e revalida
  // o caso de novo e só então chama o adaptador real (Z-API).
  const [enviando, setEnviando] = useState<string | null>(null);
  const [enviadosAgora, setEnviadosAgora] = useState<Set<string>>(new Set());
  const idempotencyEnvioRef = useRef<Record<string, string>>({});

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro(''); setFalhaParcial(false);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      setAccessToken(session.access_token);
      const auth = { Authorization: `Bearer ${session.access_token}` };

      const cuRes = await fetch('/api/minha-clinica', { headers: auth });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      setClinicaId(cid || '');
      if (!cid) { setCasos([]); setCarregando(false); return; }

      const [oportunidadesR, orcamentosR, tratamentosR, pedidosR, cobrancasR] = await Promise.all([
        fetchJsonSeguro<{ data: OportunidadeRow[] }>('/api/oportunidades', { headers: auth }, { data: [] }),
        fetchJsonSeguro<{ orcamentos: OrcamentoRow[] }>(`/api/orcamentos?clinica_id=${cid}&status=apresentado`, { headers: auth }, { orcamentos: [] }),
        fetchJsonSeguro<{ tratamentos: TratamentoRow[] }>(`/api/tratamentos?clinica_id=${cid}`, { headers: auth }, { tratamentos: [] }),
        fetchJsonSeguro<{ pedidos: PedidoRow[] }>(`/api/pedidos?clinica_id=${cid}`, { headers: auth }, { pedidos: [] }),
        fetchJsonSeguro<{ cobrancas: CobrancaRow[] }>(`/api/cobrancas?clinica_id=${cid}`, { headers: auth }, { cobrancas: [] }),
      ]);
      const oportunidadesRes = oportunidadesR.dado, orcamentosRes = orcamentosR.dado, tratamentosRes = tratamentosR.dado, pedidosRes = pedidosR.dado, cobrancasRes = cobrancasR.dado;
      setFalhaParcial([oportunidadesR, orcamentosR, tratamentosR, pedidosR, cobrancasR].some(r => r.falhou));

      const oportunidades: OportunidadeRow[] = oportunidadesRes.data ?? [];
      const orcamentos: OrcamentoRow[] = orcamentosRes.orcamentos ?? [];
      const tratamentos: TratamentoRow[] = (tratamentosRes.tratamentos ?? []).filter((t: TratamentoRow) => t.status === 'em_andamento' || t.status === 'interrompido');
      const todosPedidos: PedidoRow[] = pedidosRes.pedidos ?? [];
      const pedidosNaoConcluidos = todosPedidos.filter(p => p.status === 'criado' || p.status === 'confirmado');
      const cobrancas: CobrancaRow[] = (cobrancasRes.cobrancas ?? []).filter((c: CobrancaRow) => c.status === 'pendente' || c.status === 'em_cobranca');

      // Recompra possível — mesma agregação real já usada em app/dashboard/page.tsx
      // (agregarClientesElegiveisRecompra), reaproveitada aqui sem nova consulta.
      const recomprasPossiveis = agregarClientesElegiveisRecompra(
        todosPedidos.map(p => ({ pacienteId: p.paciente_id, telefone: p.telefone, nomeCliente: p.nome_cliente, status: p.status as 'criado' | 'confirmado' | 'aguardando_confirmacao_pagamento' | 'pago' | 'cancelado', criadoEm: p.criado_em, pagamentoConfirmadoEm: null }))
      );

      const hoje = hojeStr();
      const agora = new Date().toISOString();

      const lista = gerarFollowUpsComerciais({
        hoje, agora,
        entidadesComTentativaHoje: new Set(), // idempotência real é garantida no servidor; UI otimista local cobre o resto
        oportunidadesParadas: oportunidades.map(op => ({ id: op.id, telefone: op.telefone, pacienteNome: op.nome_informado || op.telefone, status: op.status as OportunidadeStatus, orcamentoVinculadoId: op.orcamento_vinculado_id, ultimaInteracaoEm: op.ultima_interacao_em })),
        orcamentosParados: orcamentos.map(o => ({ id: o.id, pacienteNome: o.paciente_nome, telefone: o.telefone, procedimento: o.procedimento, valor: o.valor, apresentadoEm: o.apresentado_em })),
        tratamentosSemRetorno: tratamentos.map(t => ({ id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone, tipoTratamento: t.tipo_tratamento, status: t.status as 'em_andamento' | 'interrompido', proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em })),
        pedidosNaoConcluidos: pedidosNaoConcluidos.map(p => ({ id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone, descricao: p.pedido_itens?.length ? `${p.pedido_itens.length} ${p.pedido_itens.length === 1 ? 'item' : 'itens'}` : 'pedido', valor: p.valor_centavos / 100, criadoEm: p.criado_em })),
        recomprasPossiveis,
        cobrancasAtrasadas: cobrancas.map(c => ({ id: c.id, pacienteNome: c.paciente_nome, telefone: c.paciente_telefone, descricao: c.descricao, valor: c.valor, vencimento: c.vencimento, status: c.status as 'pendente' | 'em_cobranca' })),
        casosAgendaAutonoma: [], // Agenda Autônoma tem query própria (agendamentos+pacientes); não duplicada aqui — ver /agenda-autonoma
      });

      setCasos(lista);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function registrarContato(caso: CasoFollowUp) {
    if (caso.donoDoFluxo !== 'follow-up') return;
    setRegistrando(caso.entidadeId);
    setMensagemPreparada(null);
    try {
      const res = await fetch('/api/follow-up/tentativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clinica_id: clinicaId, tipo: caso.tipo as TipoFollowUpProprio, entidade_id: caso.entidadeId }),
      });
      const json = await res.json();
      if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
      setRegistradosAgora(prev => new Set(prev).add(caso.entidadeId));
      setMensagemPreparada({ entidadeId: caso.entidadeId, texto: json.mensagem });
      setSucesso('Follow-up registrado.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setRegistrando(null);
    }
  }

  // A key fica estável só ENQUANTO a tentativa atual está em voo (protege
  // contra duplo-clique disparando duas requisições para o mesmo envio,
  // antes do botão desabilitar). Assim que a resposta chega — sucesso OU
  // falha — a key é descartada: a próxima aprovação explícita do usuário
  // (novo clique) gera uma key NOVA, exatamente como o backend já espera
  // (ver comentário de app/api/follow-up/aprovar-envio/route.ts:6-8: "uma
  // falha permite nova tentativa no mesmo dia com uma nova idempotency_
  // key"). Antes desta correção a key nunca era descartada — um envio
  // falho travava qualquer retry com 409 "já foi solicitado", mesmo sem
  // nada ter sido de fato entregue.
  function idempotencyKeyEnvioPara(entidadeId: string): string {
    if (!idempotencyEnvioRef.current[entidadeId]) idempotencyEnvioRef.current[entidadeId] = crypto.randomUUID();
    return idempotencyEnvioRef.current[entidadeId];
  }

  async function aprovarEnvio(caso: CasoFollowUp) {
    setEnviando(caso.entidadeId);
    try {
      const res = await fetch('/api/follow-up/aprovar-envio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clinica_id: clinicaId, tipo: caso.tipo as TipoFollowUpProprio, entidade_id: caso.entidadeId, idempotency_key: idempotencyKeyEnvioPara(caso.entidadeId) }),
      });
      const json = await res.json();
      delete idempotencyEnvioRef.current[caso.entidadeId];
      if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
      setEnviadosAgora(prev => new Set(prev).add(caso.entidadeId));
      setMensagemPreparada(null);
      setSucesso('Mensagem enviada pelo WhatsApp.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      delete idempotencyEnvioRef.current[caso.entidadeId];
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setEnviando(null);
    }
  }

  const casosProprios = casos.filter(c => c.donoDoFluxo === 'follow-up');
  const casosDelegados = casos.filter(c => c.donoDoFluxo !== 'follow-up');

  return (
    <AdminShell title="Follow-up Comercial" subtitle={`${casosProprios.length} caso${casosProprios.length !== 1 ? 's' : ''} precisando de acompanhamento`}>
      {carregando && <PageLoader title="Reconstruindo os casos de follow-up..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}
      {!carregando && falhaParcial && (
        <Feedback type="aviso" message="Alguns dados podem estar incompletos — houve falha ao carregar uma ou mais fontes. Os casos abaixo são reais, mas pode haver mais." />
      )}
      {!carregando && sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />}

      {!carregando && casos.length === 0 && (
        <EmptyState icon="✅" title="Nenhum follow-up pendente agora." description="Nenhum orçamento parado, tratamento sem retorno, pedido não concluído ou cliente para recompra identificado." />
      )}

      {!carregando && casosProprios.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: casosDelegados.length > 0 ? 24 : 0 }}>
          {casosProprios.map(caso => {
            const info = TIPO_LABELS[caso.tipo];
            const jaRegistrado = caso.status === 'aguardando_retorno' || registradosAgora.has(caso.entidadeId);
            return (
              <div key={`${caso.tipo}-${caso.entidadeId}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16 }}>{info.icon}</span>
                  <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: '#f1f5f9' }}>
                    <strong>{caso.pacienteNome}</strong> — {caso.motivo}
                    <div style={{ fontSize: 12, marginTop: 4, color: '#4a9bb0' }}>➜ {caso.proximaAcao}</div>
                  </div>
                  <button onClick={() => router.push(caso.destino)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver →</button>
                  <button
                    disabled={jaRegistrado || registrando === caso.entidadeId || !caso.telefone}
                    onClick={() => registrarContato(caso)}
                    title={!caso.telefone ? 'Cliente sem telefone cadastrado' : undefined}
                    style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: jaRegistrado ? 'rgba(148,163,184,0.2)' : 'linear-gradient(135deg,#16a34a,#15803d)', color: jaRegistrado ? '#94a3b8' : '#fff', fontSize: 11, fontWeight: 600, cursor: jaRegistrado || !caso.telefone ? 'not-allowed' : 'pointer' }}
                  >
                    {registrando === caso.entidadeId ? 'Registrando...' : jaRegistrado ? 'Aguardando retorno' : 'Registrar contato'}
                  </button>
                </div>
                {mensagemPreparada?.entidadeId === caso.entidadeId && (
                  <div style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#cbd5e1' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a9bb0', marginBottom: 4 }}>Mensagem preparada — copie e envie manualmente, ou aprove o envio automático pelo WhatsApp:</div>
                    {mensagemPreparada.texto}
                    <div style={{ marginTop: 8 }}>
                      <button disabled={enviando === caso.entidadeId} onClick={() => aprovarEnvio(caso)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {enviando === caso.entidadeId ? 'Enviando...' : 'Aprovar e enviar pelo WhatsApp'}
                      </button>
                    </div>
                  </div>
                )}
                {enviadosAgora.has(caso.entidadeId) && mensagemPreparada?.entidadeId !== caso.entidadeId && (
                  <div style={{ fontSize: 11, color: '#16a34a' }}>✓ Mensagem enviada pelo WhatsApp hoje.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!carregando && casosDelegados.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Já gerenciados por outro fluxo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {casosDelegados.map(caso => {
              const info = TIPO_LABELS[caso.tipo] || { label: caso.tipo, icon: '•' };
              return (
                <div key={`${caso.tipo}-${caso.entidadeId}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(148,163,184,0.06)', border: '1px solid #2d3148', borderRadius: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14 }}>{info.icon}</span>
                  <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#cbd5e1' }}>
                    <strong>{caso.pacienteNome}</strong> — {caso.motivo}
                    <div style={{ fontSize: 11, marginTop: 2, color: '#64748b' }}>{DONO_LABELS[caso.donoDoFluxo]}</div>
                  </div>
                  <button onClick={() => router.push(caso.destino)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver →</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
