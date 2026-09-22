'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { ehEstadoTerminal, type PedidoStatus } from '../../lib/motor-pedidos';

// ── Superfície operacional de Pedidos — E-commerce IA V1 ─────────────────
// Mesma identidade visual e mesmo padrão de segurança de /orcamentos: usa
// só as APIs já construídas (GET/POST /api/pedidos, POST /api/pedidos/[id]/
// transicao) — nenhuma query direta a public.pedidos/pedido_itens aqui,
// porque essas tabelas só são acessíveis via service role (RLS habilitada
// sem policy). O picker de cliente e o picker de item de catálogo são as
// únicas leituras diretas via Supabase client (pacientes/clinica_servicos
// já têm RLS real para authenticated/leitura pública, mesmo padrão já
// homologado em /clientes e /site/servicos).

type ClientePicker = { id: string; nome: string; telefone: string | null; whatsapp: string | null };
type CatalogoPicker = { id: string; nome: string; preco_centavos: number | null; disponivel: boolean };

type PedidoItem = { id: string; servico_id: string | null; descricao: string; quantidade: number; valor_unitario_centavos: number; valor_total_centavos: number };
type Pedido = {
  id: string; nome_cliente: string; telefone: string | null; valor_centavos: number;
  status: PedidoStatus; origem: string; observacao: string | null;
  pagamento_informado_em: string | null; pagamento_confirmado_em: string | null;
  criado_em: string; pedido_itens: PedidoItem[];
};

type LinhaForm = { servicoId: string; descricaoManual: string; valorManualReais: string; quantidade: string };
const linhaVazia: LinhaForm = { servicoId: '', descricaoManual: '', valorManualReais: '', quantidade: '1' };

const STATUS_CONFIG: Record<PedidoStatus, { label: string; color: string; bg: string }> = {
  criado:                           { label: 'Aguardando confirmação', color: '#38bdf8', bg: 'rgba(14,165,233,0.14)' },
  confirmado:                       { label: 'Confirmado',             color: '#0ea5e9', bg: 'rgba(14,165,233,0.18)' },
  aguardando_confirmacao_pagamento: { label: 'Aguardando confirmação de pagamento', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  pago:                             { label: 'Pago',                   color: '#16a34a', bg: '#dcfce7' },
  cancelado:                        { label: 'Cancelado',              color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
};

function normalizar(tel: string) { return tel.replace(/\D/g, ''); }
function formatarValor(centavos: number) { return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}
function parseReaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return Math.round(valor * 100);
}

export default function PedidosPage() {
  const router = useRouter();
  const [pedidos, setPedidos]         = useState<Pedido[]>([]);
  const [pacientes, setPacientes]     = useState<ClientePicker[]>([]);
  const [catalogo, setCatalogo]       = useState<CatalogoPicker[]>([]);
  const [clinicaId, setClinicaId]     = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [carregando, setCarregando]   = useState(true);
  const [erro, setErro]               = useState('');
  const [sucesso, setSucesso]         = useState('');
  const [filtro, setFiltro]           = useState<'todos' | PedidoStatus>('todos');

  const [modalNovo, setModalNovo]     = useState(false);
  const [pacienteId, setPacienteId]   = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone]       = useState('');
  const [linhas, setLinhas]           = useState<LinhaForm[]>([{ ...linhaVazia }]);
  const [salvando, setSalvando]       = useState(false);
  const idempotencyKeyRef = React.useRef('');

  const [transicionando, setTransicionando] = useState<string | null>(null);

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
      if (!cid) { setPedidos([]); setCarregando(false); return; }

      const [pedRes, pacRes, catRes] = await Promise.all([
        fetch(`/api/pedidos?clinica_id=${cid}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        supabase.from('pacientes').select('id, nome, telefone, whatsapp').eq('clinica_id', cid).order('nome'),
        supabase.from('clinica_servicos').select('id, nome, preco_centavos, disponivel').eq('clinica_id', cid).order('nome'),
      ]);

      if (pedRes.ok) {
        const json = await pedRes.json();
        setPedidos(Array.isArray(json.pedidos) ? json.pedidos : []);
      } else {
        setPedidos([]);
        // status != 404 é falha real (inclui a tabela ainda não existir em
        // produção) — precisa ficar visível, nunca virar silenciosamente
        // "nenhum pedido".
        if (pedRes.status !== 404) { console.error('Erro ao carregar pedidos:', pedRes.status); setErro(MSG_ERRO_PADRAO); }
      }
      setPacientes((pacRes.data || []) as ClientePicker[]);
      // preco_centavos/disponivel ainda não existem antes da migration rodar
      // — undefined vira "sem preço"/"disponível", nunca quebra o picker.
      setCatalogo(((catRes.data || []) as CatalogoPicker[]));
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
    setPacienteId(''); setNomeCliente(''); setTelefone(''); setLinhas([{ ...linhaVazia }]);
    idempotencyKeyRef.current = crypto.randomUUID();
    setErro(''); setModalNovo(true);
  }

  function selecionarCliente(id: string) {
    const p = pacientes.find(x => x.id === id);
    setPacienteId(id);
    if (p) { setNomeCliente(p.nome); setTelefone(normalizar(p.whatsapp || p.telefone || '')); }
  }

  function atualizarLinha(idx: number, patch: Partial<LinhaForm>) {
    setLinhas(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  const totalEstimado = linhas.reduce((soma, l) => {
    const qtd = Number(l.quantidade) || 0;
    if (l.servicoId) {
      const item = catalogo.find(c => c.id === l.servicoId);
      return soma + (item?.preco_centavos ? item.preco_centavos * qtd : 0);
    }
    const valorManual = parseReaisParaCentavos(l.valorManualReais) ?? 0;
    return soma + valorManual * qtd;
  }, 0);

  async function salvar() {
    if (!nomeCliente.trim()) { setErro('Cliente é obrigatório.'); return; }
    const itensValidos = linhas.filter(l => l.servicoId || (l.descricaoManual.trim() && l.valorManualReais.trim()));
    if (itensValidos.length === 0) { setErro('Adicione ao menos 1 item válido.'); return; }
    for (const l of itensValidos) {
      if (!Number.isInteger(Number(l.quantidade)) || Number(l.quantidade) <= 0) { setErro('Quantidade deve ser um número inteiro maior que zero.'); return; }
    }

    setSalvando(true); setErro('');
    const itens = itensValidos.map(l => l.servicoId
      ? { servico_id: l.servicoId, quantidade: Number(l.quantidade) }
      : { descricao: l.descricaoManual.trim(), valor_unitario_centavos: parseReaisParaCentavos(l.valorManualReais), quantidade: Number(l.quantidade) }
    );

    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        clinica_id: clinicaId, paciente_id: pacienteId || undefined,
        nome_cliente: nomeCliente.trim(), telefone: telefone ? normalizar(telefone) : undefined,
        itens, idempotency_key: idempotencyKeyRef.current,
      }),
    });
    const json = await res.json();
    setSalvando(false);
    if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
    setModalNovo(false);
    carregar();
    setSucesso('Pedido registrado.');
    setTimeout(() => setSucesso(''), 3500);
  }

  async function transicionar(pedido: Pedido, evento: string) {
    setTransicionando(pedido.id);
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/transicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clinica_id: clinicaId, evento }),
      });
      const json = await res.json();
      if (!res.ok || !json.sucesso) { setErro(json.error || MSG_ERRO_PADRAO); return; }
      carregar();
      setSucesso('Pedido atualizado.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setTransicionando(null);
    }
  }

  const filtrados = pedidos.filter(p => filtro === 'todos' || p.status === filtro);

  return (
    <AdminShell
      title="Pedidos"
      subtitle={`${filtrados.length} pedido${filtrados.length !== 1 ? 's' : ''}`}
      actionLabel="+ Novo pedido"
      actionOnClick={abrirNovo}
    >
      <style>{`
        .ped-card { transition: background 0.15s, border-color 0.15s; }
        .ped-card:hover { background: #222540 !important; border-color: rgba(31,78,95,0.45) !important; }
        .ped-btn:hover:not(:disabled) { filter: brightness(1.15); }
        .ped-ord-pill:hover { border-color: #3d4360 !important; color: #94a3b8 !important; }
        .ped-btn-cancelar:hover { background: rgba(148,163,184,0.08) !important; border-color: #3d4360 !important; }
        .ped-btn-salvar:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>

      {carregando && <PageLoader title="Carregando pedidos..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}
      {!carregando && sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />}

      {!carregando && pedidos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'criado', label: 'Aguardando confirmação' },
            { key: 'confirmado', label: 'Confirmados' },
            { key: 'aguardando_confirmacao_pagamento', label: 'Aguardando pagamento' },
            { key: 'pago', label: 'Pagos' },
            { key: 'cancelado', label: 'Cancelados' },
          ] as const).map(({ key, label }) => {
            const ativo = filtro === key;
            return (
              <button key={key} className={ativo ? undefined : 'ped-ord-pill'} onClick={() => setFiltro(key)} style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                border: `1px solid ${ativo ? '#1F4E5F' : '#2d3148'}`,
                background: ativo ? 'rgba(31,78,95,0.2)' : 'transparent',
                color: ativo ? '#4a9bb0' : '#64748b', fontWeight: ativo ? 600 : 400, whiteSpace: 'nowrap',
              }}>{label}</button>
            );
          })}
        </div>
      )}

      {!carregando && pedidos.length === 0 && (
        <EmptyState icon="🛒" title="Ainda não há pedidos registrados." description="Registre o primeiro pedido a partir do seu catálogo de serviços." actionLabel="➕ Registrar pedido" onAction={abrirNovo} />
      )}
      {!carregando && pedidos.length > 0 && filtrados.length === 0 && (
        <EmptyState compact icon="🔍" title="Nenhum pedido neste filtro." actionLabel="Ver todos" onAction={() => setFiltro('todos')} />
      )}

      {!carregando && filtrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(p => {
            const st = STATUS_CONFIG[p.status];
            const terminal = ehEstadoTerminal(p.status);
            return (
              <div key={p.id} className="ped-card" style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {p.nome_cliente.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15, marginBottom: 4 }}>{p.nome_cliente}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{p.telefone}</div>
                    <div style={{ fontSize: 12, marginTop: 6, color: '#94a3b8' }}>
                      {p.pedido_itens.map(it => `${it.quantidade}× ${it.descricao} (${formatarValor(it.valor_unitario_centavos)})`).join(' · ')}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 5, color: '#475569' }}>Criado em {formatarData(p.criado_em)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{formatarValor(p.valor_centavos)}</div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                    {!terminal && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
                        {p.status === 'criado' && (
                          <button className="ped-btn" disabled={transicionando === p.id} onClick={() => transicionar(p, 'confirmar_pedido')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#0ea5e9,#0369a1)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Confirmar</button>
                        )}
                        {p.status === 'confirmado' && (
                          <>
                            <button className="ped-btn" disabled={transicionando === p.id} onClick={() => transicionar(p, 'cliente_informou_pagamento')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', fontSize: 11, cursor: 'pointer' }}>Cliente informou pagamento</button>
                            <button className="ped-btn" disabled={transicionando === p.id} onClick={() => transicionar(p, 'pagamento_confirmado')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Marcar pago</button>
                          </>
                        )}
                        {p.status === 'aguardando_confirmacao_pagamento' && (
                          <>
                            <button className="ped-btn" disabled={transicionando === p.id} onClick={() => transicionar(p, 'pagamento_confirmado')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Confirmar pagamento</button>
                            <button className="ped-btn" disabled={transicionando === p.id} onClick={() => transicionar(p, 'confirmacao_rejeitada')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>Não confirmado</button>
                          </>
                        )}
                        <button className="ped-btn" disabled={transicionando === p.id} onClick={() => transicionar(p, 'cancelar_pedido')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #450a0a', background: 'transparent', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>Cancelar</button>
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
          <div style={{ background: '#1e2130', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3148' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 24, marginTop: 0 }}>Novo pedido</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente cadastrado (opcional)</label>
                <select value={pacienteId} onChange={e => selecionarCliente(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">— Digitar manualmente —</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</label>
                <input value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} placeholder="Ex: Maria Silva" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telefone</label>
                <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Ex: 11999999999" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Itens</label>
            {linhas.map((l, idx) => {
              const itemCatalogo = catalogo.find(c => c.id === l.servicoId);
              return (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={l.servicoId} onChange={e => atualizarLinha(idx, { servicoId: e.target.value })} style={{ flex: 2, minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 12 }}>
                    <option value="">— Item avulso —</option>
                    {catalogo.filter(c => c.disponivel !== false).map(c => (
                      <option key={c.id} value={c.id} disabled={!c.preco_centavos}>{c.nome}{c.preco_centavos ? ` (${formatarValor(c.preco_centavos)})` : ' (sem preço)'}</option>
                    ))}
                  </select>
                  {!l.servicoId && (
                    <>
                      <input placeholder="Descrição" value={l.descricaoManual} onChange={e => atualizarLinha(idx, { descricaoManual: e.target.value })} style={{ flex: 2, minWidth: 100, padding: '8px 10px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 12 }} />
                      <input placeholder="R$" value={l.valorManualReais} onChange={e => atualizarLinha(idx, { valorManualReais: e.target.value })} style={{ width: 70, padding: '8px 10px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 12 }} />
                    </>
                  )}
                  <input type="number" min="1" placeholder="Qtd" value={l.quantidade} onChange={e => atualizarLinha(idx, { quantidade: e.target.value })} style={{ width: 60, padding: '8px 10px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 12 }} />
                  {itemCatalogo?.preco_centavos && <span style={{ fontSize: 11, color: '#64748b', minWidth: 60 }}>{formatarValor(itemCatalogo.preco_centavos * (Number(l.quantidade) || 0))}</span>}
                  <button onClick={() => setLinhas(prev => prev.filter((_, i) => i !== idx))} disabled={linhas.length === 1} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #450a0a', background: 'transparent', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>✕</button>
                </div>
              );
            })}
            <button onClick={() => setLinhas(prev => [...prev, { ...linhaVazia }])} style={{ marginTop: 4, marginBottom: 16, padding: '6px 12px', borderRadius: 8, border: '1px dashed #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 12, cursor: 'pointer' }}>+ Adicionar item</button>

            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 16, textAlign: 'right' }}>Total: {formatarValor(totalEstimado)}</div>

            {erro && <div style={{ marginBottom: 16 }}><Feedback type="erro" message={erro} onClose={() => setErro('')} /></div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="ped-btn-cancelar" onClick={() => setModalNovo(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button className="ped-btn-salvar" onClick={salvar} disabled={salvando} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>
                {salvando ? 'Salvando...' : 'Registrar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
