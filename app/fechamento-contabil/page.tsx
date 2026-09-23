'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import type { ResumoFechamento, StatusDocumento, StatusFechamento } from '../../lib/fechamento-contabil';

// ── Contador IA · Fechamento Inteligente V1 ──────────────────────────────
// "Quais clientes ainda não estão prontos para o fechamento do mês,
// exatamente o que falta de cada um, e quem já está pronto?" Esta tela só
// busca (via /api/fechamento e /api/fechamento/tipos) e apresenta — todo
// o cálculo de prontidão vem de lib/fechamento-contabil.ts. Zero número
// fabricado: sem tipo de documento configurado, a tela mostra isso
// explicitamente, nunca inventa um checklist.

type TipoDocumento = { id: string; nome: string; obrigatorio: boolean; ativo: boolean };

const STATUS_LABEL: Record<StatusFechamento, { texto: string; cor: string }> = {
  pronto:    { texto: 'PRONTO',    cor: '#4ade80' },
  pendente:  { texto: 'PENDENTE',  cor: '#fbbf24' },
  bloqueado: { texto: 'BLOQUEADO', cor: '#f87171' },
};

const DOC_STATUS_ICON: Record<StatusDocumento, string> = { recebido: '✅', pendente: '❌', invalido: '⚠️' };

function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatarCompetencia(c: string): string {
  const [ano, mes] = c.split('-');
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const idx = Number(mes) - 1;
  return idx >= 0 && idx < 12 ? `${nomes[idx]} de ${ano}` : c;
}

export default function FechamentoContabilPage() {
  const router = useRouter();
  const [clinicaId, setClinicaId] = useState('');
  const [auth, setAuth] = useState<{ Authorization: string } | null>(null);
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [resumo, setResumo] = useState<ResumoFechamento | null>(null);
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [clienteAberto, setClienteAberto] = useState<string | null>(null);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregarChecklist = useCallback(async (cid: string, headers: { Authorization: string }, comp: string) => {
    const [resumoRes, tiposRes] = await Promise.all([
      fetch(`/api/fechamento?clinica_id=${cid}&competencia=${comp}`, { headers }).then(r => r.json()),
      fetch(`/api/fechamento/tipos?clinica_id=${cid}`, { headers }).then(r => r.json()),
    ]);
    if (!resumoRes.sucesso || !tiposRes.sucesso) { setErro(MSG_ERRO_PADRAO); return; }
    setResumo(resumoRes.resumo);
    setTipos(tiposRes.tipos ?? []);
  }, []);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      const headers = { Authorization: `Bearer ${session.access_token}` };
      setAuth(headers);

      const cuRes = await fetch('/api/minha-clinica', { headers });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      if (!cid) { setErro('Negócio não vinculado ao usuário.'); return; }
      setClinicaId(cid);
      await carregarChecklist(cid, headers, competencia);
    } catch {
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router, competencia, carregarChecklist]);

  useEffect(() => { carregar(); }, [carregar]);

  const atualizarDocumento = useCallback(async (clienteId: string, tipoDocumento: string, status: StatusDocumento) => {
    if (!auth || !clinicaId) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/fechamento/documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ clinica_id: clinicaId, cliente_id: clienteId, competencia, tipo_documento: tipoDocumento, status }),
      });
      if (!res.ok) { setErro(MSG_ERRO_PADRAO); return; }
      await carregarChecklist(clinicaId, auth, competencia);
    } catch {
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setSalvando(false);
    }
  }, [auth, clinicaId, competencia, carregarChecklist]);

  const cadastrarTipo = useCallback(async () => {
    if (!auth || !clinicaId || !novoTipoNome.trim()) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/fechamento/tipos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ clinica_id: clinicaId, nome: novoTipoNome.trim(), obrigatorio: true }),
      });
      if (!res.ok) { setErro(MSG_ERRO_PADRAO); return; }
      setNovoTipoNome('');
      await carregarChecklist(clinicaId, auth, competencia);
    } catch {
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setSalvando(false);
    }
  }, [auth, clinicaId, competencia, novoTipoNome, carregarChecklist]);

  const alternarTipoAtivo = useCallback(async (id: string, ativo: boolean) => {
    if (!auth || !clinicaId) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/fechamento/tipos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ clinica_id: clinicaId, ativo: !ativo }),
      });
      if (!res.ok) { setErro(MSG_ERRO_PADRAO); return; }
      await carregarChecklist(clinicaId, auth, competencia);
    } catch {
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setSalvando(false);
    }
  }, [auth, clinicaId, competencia, carregarChecklist]);

  const tiposAtivos = tipos.filter(t => t.ativo && t.obrigatorio);

  return (
    <AdminShell title="Fechamento Contábil" subtitle="Quem está pronto para o fechamento do mês, e o que falta de quem não está">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>
          Competência:{' '}
          <input
            type="month"
            value={competencia}
            onChange={(e) => e.target.value && setCompetencia(e.target.value)}
            style={{ marginLeft: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid #2d3148', background: 'rgba(255,255,255,0.03)', color: '#f1f5f9', fontSize: 13 }}
          />
        </label>
        <span style={{ fontSize: 12, color: '#64748b' }}>{formatarCompetencia(competencia)}</span>
        <button
          onClick={() => setMostrarConfig(v => !v)}
          style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 12, cursor: 'pointer' }}
        >
          {mostrarConfig ? 'Fechar configuração' : '⚙️ Documentos obrigatórios'}
        </button>
      </div>

      {mostrarConfig && (
        <section style={{ marginBottom: 24, background: 'rgba(255,255,255,0.03)', border: '1px solid #2d3148', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documentos obrigatórios desta clínica</div>
          {tipos.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>Nenhum tipo de documento configurado ainda — cadastre abaixo (ex.: Extrato bancário, Notas fiscais, Folha, Comprovantes).</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {tipos.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ flex: 1, color: t.ativo ? '#f1f5f9' : '#64748b', textDecoration: t.ativo ? 'none' : 'line-through' }}>{t.nome}{!t.obrigatorio ? ' (opcional)' : ''}</span>
                <button
                  onClick={() => alternarTipoAtivo(t.id, t.ativo)}
                  disabled={salvando}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2d3148', background: 'transparent', color: t.ativo ? '#f87171' : '#4ade80', fontSize: 11, cursor: 'pointer' }}
                >
                  {t.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={novoTipoNome}
              onChange={(e) => setNovoTipoNome(e.target.value)}
              placeholder="Nome do documento (ex.: Extrato bancário)"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'rgba(255,255,255,0.03)', color: '#f1f5f9', fontSize: 13 }}
            />
            <button
              onClick={cadastrarTipo}
              disabled={salvando || !novoTipoNome.trim()}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(74,155,176,0.35)', background: 'rgba(74,155,176,0.1)', color: '#4a9bb0', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            >
              Adicionar
            </button>
          </div>
        </section>
      )}

      {carregando && <PageLoader title="Consolidando o fechamento..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}

      {!carregando && !erro && resumo && tiposAtivos.length === 0 && (
        <EmptyState icon="🧮" title="Nenhum documento obrigatório configurado" description="Configure ao menos um tipo de documento acima para começar a acompanhar a prontidão dos clientes." />
      )}

      {!carregando && !erro && resumo && tiposAtivos.length > 0 && resumo.clientes.length === 0 && (
        <EmptyState icon="👥" title="Nenhum cliente ativo" description="Cadastre clientes em /clientes para que apareçam aqui." />
      )}

      {!carregando && !erro && resumo && tiposAtivos.length > 0 && resumo.clientes.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {(['pronto', 'pendente', 'bloqueado'] as const).map(s => (
              <div key={s} style={{ flex: '1 1 140px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${STATUS_LABEL[s].cor}33`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: STATUS_LABEL[s].cor }}>{s === 'pronto' ? resumo.prontos : s === 'pendente' ? resumo.pendentes : resumo.bloqueados}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s === 'pronto' ? 'Prontos' : s === 'pendente' ? 'Pendentes' : 'Bloqueados'}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resumo.clientes.map(c => (
              <div key={c.clienteId} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${STATUS_LABEL[c.status].cor}33`, borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => setClienteAberto(clienteAberto === c.clienteId ? null : c.clienteId)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit' }}
                >
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#f1f5f9' }}>{c.nome}</span>
                  <span style={{ fontSize: 12.5, color: '#94a3b8', minWidth: 40 }}>{c.percentual}%</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_LABEL[c.status].cor, minWidth: 90, textAlign: 'right' }}>{STATUS_LABEL[c.status].texto}</span>
                </button>
                {clienteAberto === c.clienteId && (
                  <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {c.checklist.map(item => (
                      <div key={item.tipoDocumento} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                        <span>{DOC_STATUS_ICON[item.status]}</span>
                        <span style={{ flex: 1, color: '#cbd5e1' }}>{item.tipoDocumento}</span>
                        {item.status !== 'recebido' && (
                          <button disabled={salvando} onClick={() => atualizarDocumento(c.clienteId, item.tipoDocumento, 'recebido')} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(74,222,128,0.35)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontSize: 11, cursor: 'pointer' }}>Marcar recebido</button>
                        )}
                        {item.status !== 'invalido' && (
                          <button disabled={salvando} onClick={() => atualizarDocumento(c.clienteId, item.tipoDocumento, 'invalido')} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>Inválido</button>
                        )}
                        {item.status !== 'pendente' && (
                          <button disabled={salvando} onClick={() => atualizarDocumento(c.clienteId, item.tipoDocumento, 'pendente')} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>Reabrir</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
