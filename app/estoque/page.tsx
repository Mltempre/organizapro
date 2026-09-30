'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { buscarItens, ROTULO_MOVIMENTO, type TipoMovimento } from '../../lib/motor-estoque';

// ── Estoque (Estoque Comercial Básico V1) ──────────────────────────────────
// Operacional/comercial apenas — nenhuma função fiscal, tributária ou
// contábil. Para cada item do catálogo: tipo (produto físico ou serviço),
// SKU e código de barras opcionais, controle de estoque e mínimo; para os
// produtos controlados: saldo, entrada, ajuste (saldo contado) e histórico.
// O cadastro do item (nome, preço, foto) continua em Catálogo e Pedidos.
// Tudo via /api/estoque — as tabelas de estoque só são acessíveis pelo
// servidor. A busca aceita nome, SKU ou código de barras; um leitor de código
// de barras digita no campo como um teclado e o Enter abre o item exato.

type ItemEstoque = {
  id: string; nome: string; tipo_item: 'produto' | 'servico'; sku: string | null; codigo_barras: string | null;
  controla_estoque: boolean; estoque_minimo: number | null; saldo: number | null; baixo: boolean;
};
type Movimento = { id: string; tipo: TipoMovimento; quantidade: number; saldo_apos: number; motivo: string | null; pedido_id: string | null; criado_em: string };
type Modal = { tipo: 'entrada' | 'ajuste' | 'historico' | 'config'; item: ItemEstoque } | null;
type FormConfig = { tipo_item: 'produto' | 'servico'; sku: string; codigo_barras: string; controla_estoque: boolean; estoque_minimo: string };

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' };
const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' };
const primario: React.CSSProperties = { flex: 2, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1F4E5F,#0d3547)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

export default function EstoquePage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [clinicaId, setClinicaId] = useState('');
  const [token, setToken] = useState('');
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [config, setConfig] = useState<FormConfig>({ tipo_item: 'servico', sku: '', codigo_barras: '', controla_estoque: false, estoque_minimo: '' });
  const [erroModal, setErroModal] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [movimentos, setMovimentos] = useState<Movimento[] | null>(null);
  const chaveRef = useRef('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      setToken(session.access_token);
      const cuRes = await fetch('/api/minha-clinica', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      if (!cid) throw new Error('Negócio não vinculado ao usuário.');
      setClinicaId(cid);
      const res = await fetch(`/api/estoque?clinica_id=${encodeURIComponent(cid)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const json = res.ok ? await res.json() : null;
      if (!json?.sucesso || !Array.isArray(json.itens)) throw new Error(MSG_ERRO_PADRAO);
      setAtivo(json.estoqueAtivo === true);
      setItens(json.itens as ItemEstoque[]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  // Produtos controlados primeiro (os que têm saldo), depois os demais itens.
  const ordenados = [...itens].sort((a, b) => Number(b.controla_estoque) - Number(a.controla_estoque));
  const visiveis = buscarItens(ordenados, busca);
  const controlados = itens.filter(i => i.controla_estoque).length;
  const baixos = itens.filter(i => i.baixo).length;

  function abrir(tipo: 'entrada' | 'ajuste', item: ItemEstoque) {
    setModal({ tipo, item }); setQuantidade(tipo === 'ajuste' ? String(item.saldo ?? 0) : ''); setMotivo(''); setErroModal('');
    chaveRef.current = crypto.randomUUID();
  }
  function abrirConfig(item: ItemEstoque) {
    setConfig({ tipo_item: item.tipo_item, sku: item.sku ?? '', codigo_barras: item.codigo_barras ?? '', controla_estoque: item.controla_estoque, estoque_minimo: item.estoque_minimo === null ? '' : String(item.estoque_minimo) });
    setModal({ tipo: 'config', item }); setErroModal('');
  }

  async function abrirHistorico(item: ItemEstoque) {
    setModal({ tipo: 'historico', item }); setMovimentos(null); setErroModal('');
    try {
      const res = await fetch(`/api/estoque/movimentos?clinica_id=${encodeURIComponent(clinicaId)}&servico_id=${encodeURIComponent(item.id)}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || !json.sucesso) { setErroModal(json.error || MSG_ERRO_PADRAO); return; }
      setMovimentos(json.movimentos as Movimento[]);
    } catch { setErroModal(MSG_ERRO_PADRAO); }
  }

  async function enviar(url: string, method: 'POST' | 'PUT', body: Record<string, unknown>, mensagem: (json: { saldo?: number }) => string) {
    if (salvando) return;
    setSalvando(true); setErroModal('');
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ clinica_id: clinicaId, ...body }) });
      const json = await res.json();
      if (!res.ok || !json.sucesso) { setErroModal(json.error || MSG_ERRO_PADRAO); return; }
      setModal(null);
      setSucesso(mensagem(json));
      setTimeout(() => setSucesso(''), 3500);
      await carregar();
    } catch {
      setErroModal('Não foi possível confirmar o registro. Tente novamente sem fechar o formulário.');
    } finally { setSalvando(false); }
  }

  function registrar() {
    if (!modal || (modal.tipo !== 'entrada' && modal.tipo !== 'ajuste')) return;
    const tipo = modal.tipo;
    enviar('/api/estoque/movimentos', 'POST',
      { servico_id: modal.item.id, tipo, quantidade: Number(quantidade), motivo, idempotency_key: chaveRef.current },
      json => `${tipo === 'entrada' ? 'Entrada registrada' : 'Ajuste registrado'}. Saldo atual: ${json.saldo}.`);
  }
  function salvarConfig() {
    if (!modal || modal.tipo !== 'config') return;
    enviar('/api/estoque', 'PUT',
      { servico_id: modal.item.id, ...config, controla_estoque: config.tipo_item === 'produto' && config.controla_estoque },
      () => 'Configuração de estoque salva.');
  }

  // Leitor de código de barras: digita o código e envia Enter. Com um item
  // de código/SKU exato em primeiro lugar, abre a entrada (ou a configuração,
  // se o item ainda não controla estoque).
  function aoTeclarBusca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const t = busca.trim();
    const primeiro = visiveis[0];
    if (!primeiro || !(primeiro.codigo_barras === t.replace(/\s+/g, '') || (primeiro.sku ?? '').toLowerCase() === t.toLowerCase())) return;
    if (primeiro.controla_estoque) abrir('entrada', primeiro); else abrirConfig(primeiro);
  }

  return (
    <AdminShell title="Estoque" subtitle={ativo ? `${controlados} produto${controlados !== 1 ? 's' : ''} com controle de estoque${baixos ? ` · ${baixos} com estoque baixo` : ''}` : undefined}>
      {carregando && <PageLoader title="Carregando estoque..." />}
      {!carregando && erro && <><Feedback type="erro" message={erro} onClose={() => setErro('')} /><button onClick={carregar}>Tentar novamente</button></>}
      {!carregando && sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />}

      {!carregando && !erro && ativo === false && (
        <EmptyState icon="📦" title="O controle de estoque ainda não está ativo." description="Assim que for ativado, os itens do catálogo aparecem aqui para configurar SKU, código de barras e controle de estoque." />
      )}

      {!carregando && !erro && ativo && itens.length === 0 && (
        <EmptyState icon="📦" title="Seu catálogo está vazio." description="Cadastre produtos em Catálogo e Pedidos; depois configure o estoque deles aqui."
          actionLabel="Abrir Catálogo e Pedidos" onAction={() => router.push('/pedidos')} />
      )}

      {!carregando && !erro && ativo && itens.length > 0 && (
        <>
          <input data-testid="busca-estoque" autoFocus value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={aoTeclarBusca}
            placeholder="Buscar por nome, SKU ou código de barras (o leitor pode ser usado aqui)" aria-label="Buscar item"
            style={{ ...inp, marginBottom: 16 }} />
          {controlados === 0 && (
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
              Nenhum produto com controle de estoque ainda. Use “Configurar” em um produto físico e marque “Controlar estoque”. Variações (tamanho, cor) podem ser itens separados, cada um com seu SKU.
            </p>
          )}
          {visiveis.length === 0 ? (
            <EmptyState compact icon="🔍" title="Nenhum item encontrado." actionLabel="Limpar busca" onAction={() => setBusca('')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visiveis.map(i => (
                <div key={i.id} data-testid="item-estoque" style={{ background: '#1e2130', border: `1px solid ${i.baixo ? 'rgba(248,113,113,0.45)' : '#2d3148'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', opacity: i.controla_estoque ? 1 : 0.8 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{i.nome}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                      {[i.tipo_item === 'produto' ? 'Produto físico' : 'Serviço', i.sku && `SKU ${i.sku}`, i.codigo_barras && `Código ${i.codigo_barras}`, i.estoque_minimo !== null && `Mínimo ${i.estoque_minimo}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {i.controla_estoque ? (
                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: i.baixo ? '#f87171' : '#f1f5f9' }}>{i.saldo ?? 0}</div>
                      <div style={{ fontSize: 11, color: i.baixo ? '#f87171' : '#64748b', fontWeight: i.baixo ? 700 : 400 }}>{i.baixo ? 'Estoque baixo' : 'em estoque'}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#64748b', minWidth: 90, textAlign: 'right' }}>Sem controle de estoque</div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {i.controla_estoque && <>
                      <button onClick={() => abrir('entrada', i)} style={{ ...btn, border: '1px solid #1F4E5F', color: '#7dd3e8' }}>+ Entrada</button>
                      <button onClick={() => abrir('ajuste', i)} style={btn}>Ajustar</button>
                    </>}
                    <button onClick={() => abrirHistorico(i)} style={btn}>Histórico</button>
                    <button onClick={() => abrirConfig(i)} style={btn}>Configurar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 16 }}>
            Pedidos confirmados em Catálogo e Pedidos baixam o estoque dos produtos controlados; pedidos cancelados devolvem. Um pedido sem saldo suficiente não pode ser confirmado.
          </p>
        </>
      )}

      {modal && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 16 }} onClick={e => { if (e.target === e.currentTarget && !salvando) setModal(null); }}>
          <div style={{ background: '#1e2130', borderRadius: 16, padding: 28, width: '100%', maxWidth: modal.tipo === 'historico' ? 620 : 460, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3148' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>
              {{ entrada: 'Registrar entrada', ajuste: 'Ajustar estoque', historico: 'Histórico do item', config: 'Configurar estoque' }[modal.tipo]}
            </h2>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 18px' }}>{modal.item.nome}{modal.item.controla_estoque ? ` · saldo atual ${modal.item.saldo ?? 0}` : ''}</p>
            {erroModal && <div style={{ marginBottom: 14 }}><Feedback type="erro" message={erroModal} onClose={() => setErroModal('')} /></div>}

            {(modal.tipo === 'entrada' || modal.tipo === 'ajuste') && (
              <>
                <label style={lbl}>{modal.tipo === 'entrada' ? 'Quantidade que entrou' : 'Saldo contado agora'}</label>
                <input type="number" min={modal.tipo === 'entrada' ? 1 : 0} step={1} value={quantidade} onChange={e => setQuantidade(e.target.value)} style={{ ...inp, marginBottom: 14 }} autoFocus />
                <label style={lbl}>{modal.tipo === 'entrada' ? 'Motivo (opcional)' : 'Motivo *'}</label>
                <input value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300}
                  placeholder={modal.tipo === 'entrada' ? 'Ex.: reposição, compra do fornecedor' : 'Ex.: contagem, perda, avaria, uso interno'} style={{ ...inp, marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setModal(null)} disabled={salvando} style={{ ...btn, flex: 1, padding: 10, fontSize: 13 }}>Cancelar</button>
                  <button onClick={registrar} disabled={salvando} style={{ ...primario, opacity: salvando ? 0.7 : 1 }}>
                    {salvando ? 'Salvando...' : modal.tipo === 'entrada' ? 'Registrar entrada' : 'Salvar ajuste'}
                  </button>
                </div>
              </>
            )}

            {modal.tipo === 'config' && (
              <>
                <label style={lbl}>Tipo</label>
                <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                  {(['produto', 'servico'] as const).map(t => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1', cursor: 'pointer' }}>
                      <input type="radio" name="tipo_item" checked={config.tipo_item === t} onChange={() => setConfig(p => ({ ...p, tipo_item: t, controla_estoque: t === 'produto' && p.controla_estoque }))} />
                      {t === 'produto' ? 'Produto físico' : 'Serviço'}
                    </label>
                  ))}
                </div>
                <label style={lbl}>SKU / código interno (opcional)</label>
                <input value={config.sku} onChange={e => setConfig(p => ({ ...p, sku: e.target.value }))} maxLength={60} placeholder="Ex.: CAM-PRETA-M" style={{ ...inp, marginBottom: 14 }} />
                <label style={lbl}>Código de barras (opcional)</label>
                <input value={config.codigo_barras} onChange={e => setConfig(p => ({ ...p, codigo_barras: e.target.value }))} maxLength={64} placeholder="Digite ou use o leitor (EAN)" style={{ ...inp, marginBottom: 14 }} />
                {config.tipo_item === 'produto' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1', marginBottom: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={config.controla_estoque} onChange={e => setConfig(p => ({ ...p, controla_estoque: e.target.checked }))} />
                    Controlar estoque (pedido confirmado baixa o saldo)
                  </label>
                )}
                {config.tipo_item === 'produto' && config.controla_estoque && (
                  <>
                    <label style={lbl}>Estoque mínimo para alerta (opcional)</label>
                    <input type="number" min={0} step={1} value={config.estoque_minimo} onChange={e => setConfig(p => ({ ...p, estoque_minimo: e.target.value }))} style={{ ...inp, marginBottom: 14 }} />
                  </>
                )}
                <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 18px' }}>SKU e código de barras são únicos dentro do seu negócio. Desligar o controle mantém o saldo e o histórico.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setModal(null)} disabled={salvando} style={{ ...btn, flex: 1, padding: 10, fontSize: 13 }}>Cancelar</button>
                  <button onClick={salvarConfig} disabled={salvando} style={{ ...primario, opacity: salvando ? 0.7 : 1 }}>{salvando ? 'Salvando...' : 'Salvar configuração'}</button>
                </div>
              </>
            )}

            {modal.tipo === 'historico' && (
              <>
                {movimentos === null && !erroModal && <p style={{ fontSize: 13, color: '#94a3b8' }}>Carregando...</p>}
                {movimentos?.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>Nenhuma movimentação registrada ainda.</p>}
                {!!movimentos?.length && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {movimentos.map(m => (
                      <li key={m.id} data-testid="movimento-estoque" style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 10px', borderRadius: 8, background: '#0f1117', fontSize: 12, color: '#cbd5e1', flexWrap: 'wrap' }}>
                        <span style={{ color: '#64748b', minWidth: 118 }}>{formatarDataHora(m.criado_em)}</span>
                        <span style={{ flex: 1, minWidth: 140 }}>{ROTULO_MOVIMENTO[m.tipo] ?? m.tipo}{m.motivo ? ` — ${m.motivo}` : ''}</span>
                        <strong style={{ color: m.quantidade > 0 ? '#4ade80' : '#f87171' }}>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</strong>
                        <span style={{ color: '#94a3b8' }}>saldo {m.saldo_apos}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button onClick={() => setModal(null)} style={{ ...btn, marginTop: 18, width: '100%', padding: 10, fontSize: 13 }}>Fechar</button>
              </>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
