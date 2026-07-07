'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';

// ── Types ─────────────────────────────────────────────────────────────

interface Paciente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  proxima_consulta: string;
  status: string;
  created_at: string;
  whatsapp?: string;
  endereco?: string;
  site_link?: string;
  observacoes?: string;
}

type FormData = {
  nome: string;
  telefone: string;
  whatsapp: string;
  email: string;
  proxima_consulta: string;
  status: string;
  endereco: string;
  site_link: string;
  observacoes: string;
};

type AgHistorico = {
  id: string;
  data: string;
  hora: string;
  tipo_consulta: string;
  status: string;
};

type Ordenacao = 'recentes' | 'nome' | 'proximo';

// ── Config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  ativo:     { label: 'Ativo',     color: '#16a34a', bg: '#dcfce7' },
  inativo:   { label: 'Inativo',   color: '#dc2626', bg: '#fee2e2' },
  aguardando:{ label: 'Aguardando',color: '#d97706', bg: '#fef3c7' },
};

const stHistorico: Record<string, { color: string; label: string }> = {
  confirmado: { color: '#16a34a', label: 'Confirmado' },
  agendado:   { color: '#0ea5e9', label: 'Agendado'   },
  concluido:  { color: '#4a9bb0', label: 'Concluído'  },
  faltou:     { color: '#dc2626', label: 'Faltou'     },
  cancelado:  { color: '#64748b', label: 'Cancelado'  },
  reagendar:  { color: '#f59e0b', label: 'Reagendar'  },
};

type CampoForm = {
  key: 'nome' | 'telefone' | 'whatsapp' | 'email' | 'proxima_consulta' | 'endereco' | 'site_link';
  label: string;
  type: string;
  placeholder: string;
};

const camposForm: CampoForm[] = [
  { key: 'nome',             label: 'Nome completo',           type: 'text',  placeholder: 'Ex: Maria Silva'                          },
  { key: 'telefone',         label: 'Telefone',                type: 'text',  placeholder: 'Ex: 11999999999'                          },
  { key: 'whatsapp',         label: 'WhatsApp (se diferente)', type: 'text',  placeholder: 'Ex: 11988888888'                          },
  { key: 'email',            label: 'E-mail',                  type: 'email', placeholder: 'Ex: maria@email.com'                      },
  { key: 'proxima_consulta', label: 'Próximo compromisso',     type: 'date',  placeholder: ''                                         },
  { key: 'endereco',         label: 'Endereço',                type: 'text',  placeholder: 'Ex: Rua das Flores, 123, São Paulo - SP'  },
  { key: 'site_link',        label: 'Site / Link',             type: 'url',   placeholder: 'Ex: https://meusite.com.br'              },
];

const formInicial: FormData = {
  nome: '', telefone: '', whatsapp: '', email: '',
  proxima_consulta: '', status: 'ativo', endereco: '', site_link: '', observacoes: '',
};

const cBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '5px 12px', borderRadius: 8,
  border: '1px solid rgba(31,78,95,0.4)', background: 'rgba(31,78,95,0.15)',
  color: '#4a9bb0', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
};

function normalizar(tel: string) { return tel.replace(/\D/g, ''); }
function formatarData(d: string) {
  if (!d) return '-';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

// ── Page ──────────────────────────────────────────────────────────────

export default function PacientesPage() {
  const router = useRouter();
  const [pacientes, setPacientes]         = useState<Paciente[]>([]);
  const [busca, setBusca]                 = useState('');
  const [ordenacao, setOrdenacao]         = useState<Ordenacao>('recentes');
  const [modal, setModal]                 = useState(false);
  const [editando, setEditando]           = useState<Paciente | null>(null);
  const [form, setForm]                   = useState<FormData>(formInicial);
  const [salvando, setSalvando]           = useState(false);
  const [excluindo, setExcluindo]         = useState<string | null>(null);
  const [carregando, setCarregando]       = useState(true);
  const [erro, setErro]                   = useState('');
  const [sucesso, setSucesso]             = useState('');
  const [clinicaId, setClinicaId]         = useState('');
  const [detalhe, setDetalhe]             = useState<Paciente | null>(null);
  const [historico, setHistorico]         = useState<AgHistorico[]>([]);
  const [carregandoHist, setCarregandoHist] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: cu, error: cuError } = await supabase
        .from('clinica_usuarios').select('clinica_id').eq('usuario_id', user.id).maybeSingle();
      if (cuError) console.error('Erro ao buscar clinica_usuarios:', cuError);
      const cid = cu?.clinica_id;
      setClinicaId(cid || '');
      if (!cid) { setPacientes([]); setCarregando(false); return; }
      const { data, error } = await supabase
        .from('pacientes').select('*').eq('clinica_id', cid)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Erro ao carregar clientes: ${error.message}`);
      if (data) setPacientes(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Histórico ──

  async function carregarHistorico(p: Paciente, cid: string) {
    setHistorico([]);
    const tel = normalizar(p.whatsapp || p.telefone || '');
    if (!tel) return;
    setCarregandoHist(true);
    try {
      const { data } = await supabase
        .from('agendamentos')
        .select('id, data, hora, tipo_consulta, status')
        .eq('clinica_id', cid)
        .or(`telefone.eq.${tel},telefone.eq.55${tel}`)
        .order('data', { ascending: false }).limit(10);
      setHistorico((data || []) as AgHistorico[]);
    } catch (e) { console.error(e); }
    finally { setCarregandoHist(false); }
  }

  function abrirDetalhe(p: Paciente) {
    setDetalhe(p);
    if (clinicaId) carregarHistorico(p, clinicaId);
  }

  // ── Form ──

  function abrirNovo() { setEditando(null); setForm(formInicial); setErro(''); setModal(true); }

  function abrirEdicao(p: Paciente) {
    setEditando(p);
    setForm({
      nome:             p.nome,
      telefone:         p.telefone        || '',
      whatsapp:         p.whatsapp        || '',
      email:            p.email           || '',
      proxima_consulta: p.proxima_consulta|| '',
      status:           p.status          || 'ativo',
      endereco:         p.endereco        || '',
      site_link:        p.site_link        || '',
      observacoes:      p.observacoes     || '',
    });
    setErro(''); setModal(true);
  }

  function editarDeDetalhe() {
    if (!detalhe) return;
    const p = detalhe;
    setDetalhe(null);
    abrirEdicao(p);
  }

  // ── Sincronizar agendamento ao salvar cliente ──

  async function sincronizarAgendamento(
    userId: string | undefined, nome: string, telefone: string,
    proxima: string, telefoneAnterior?: string,
  ) {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const telBusca = telefoneAnterior || telefone;
    const { data: existentes } = await supabase
      .from('agendamentos').select('id').eq('clinica_id', clinicaId)
      .eq('telefone', telBusca).gte('data', hoje)
      .not('status', 'in', '("cancelado","concluido","faltou")')
      .order('data', { ascending: true }).limit(1);
    const existente = existentes?.[0] ?? null;
    if (existente) {
      await supabase.from('agendamentos')
        .update({ paciente_nome: nome, telefone, data: proxima }).eq('id', existente.id).eq('clinica_id', clinicaId);
    } else {
      await supabase.from('agendamentos').insert({
        paciente_nome: nome, telefone, data: proxima, hora: '09:00',
        tipo_consulta: 'Reunião', status: 'agendado', clinica_id: clinicaId,
        user_id: userId, confirmado: false, precisa_reagendar: false,
        lembrete_enviado: false, confirmacao_enviada: false,
      });
    }
  }

  // ── Salvar ──

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return; }
    if (!editando && form.telefone.trim()) {
      const tel = normalizar(form.telefone);
      const { data: ex } = await supabase.from('pacientes').select('id, nome')
        .eq('clinica_id', clinicaId).or(`telefone.eq.${tel},whatsapp.eq.${tel}`).maybeSingle();
      if (ex) { setErro(`Já existe um cliente com este telefone: ${ex.nome}`); return; }
    }
    setSalvando(true); setErro('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const telefoneSalvo = normalizar(form.telefone);
      const payload = {
        ...form,
        telefone:    telefoneSalvo,
        whatsapp:    form.whatsapp    ? normalizar(form.whatsapp) : null,
        endereco:    form.endereco    || null,
        site_link:   form.site_link    || null,
        observacoes: form.observacoes || null,
        user_id:     user?.id,
        clinica_id:  clinicaId,
      };
      let error;
      if (editando) { ({ error } = await supabase.from('pacientes').update(payload).eq('id', editando.id).eq('clinica_id', clinicaId)); }
      else          { ({ error } = await supabase.from('pacientes').insert(payload)); }
      if (error) { setErro('Erro ao salvar: ' + error.message); }
      else {
        if (form.proxima_consulta) {
          const telefoneAnterior = editando ? normalizar(editando.telefone) : undefined;
          await sincronizarAgendamento(user?.id, form.nome, telefoneSalvo, form.proxima_consulta, telefoneAnterior);
        }
        setModal(false); carregar();
        setSucesso(editando ? 'Cliente atualizado.' : 'Cliente cadastrado com sucesso.');
        setTimeout(() => setSucesso(''), 3500);
      }
    } catch (e) {
      setErro('Erro inesperado: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }

  // ── Excluir ──

  async function excluir(id: string) {
    const p = pacientes.find(x => x.id === id);
    if (!p) return;
    let aviso = '';
    const tel = normalizar(p.telefone || '');
    if (tel) {
      const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const { count } = await supabase.from('agendamentos')
        .select('*', { count: 'exact', head: true }).eq('clinica_id', clinicaId)
        .or(`telefone.eq.${tel},telefone.eq.55${tel}`).gte('data', hoje)
        .not('status', 'in', '("cancelado","concluido","faltou")');
      if (count && count > 0)
        aviso = `\n\n⚠️ Atenção: ${count} compromisso(s) futuro(s) vinculado(s).`;
    }
    if (!confirm(`Excluir o cliente "${p.nome}"?${aviso}`)) return;
    setDetalhe(null);
    setExcluindo(id);
    try {
      const { error } = await supabase.from('pacientes').delete().eq('id', id).eq('clinica_id', clinicaId);
      if (error) { setErro('Erro ao excluir: ' + error.message); return; }
      carregar();
      setSucesso('Cliente removido.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      setErro('Erro ao excluir: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExcluindo(null);
    }
  }

  // ── Filtro + Ordenação ──

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const filtrados = pacientes.filter(p =>
    p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.telefone?.includes(busca) ||
    p.email?.toLowerCase().includes(busca.toLowerCase())
  );

  const ordenados = [...filtrados].sort((a, b) => {
    if (ordenacao === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR');
    if (ordenacao === 'proximo') {
      if (!a.proxima_consulta && !b.proxima_consulta) return 0;
      if (!a.proxima_consulta) return 1;
      if (!b.proxima_consulta) return -1;
      return a.proxima_consulta.localeCompare(b.proxima_consulta);
    }
    return b.created_at.localeCompare(a.created_at);
  });

  // ── Render ──

  return (
    <AdminShell
      title="Clientes"
      subtitle={`${filtrados.length} cliente${filtrados.length !== 1 ? 's' : ''} encontrado${filtrados.length !== 1 ? 's' : ''}`}
      actionLabel="+ Novo cliente"
      actionOnClick={abrirNovo}
    >
      <style>{`
        @keyframes slideInRight { from { opacity:0; transform:translateX(32px) } to { opacity:1; transform:translateX(0) } }
        .cli-card { transition: background 0.15s, border-color 0.15s; }
        .cli-card:hover { background: #222540 !important; border-color: rgba(31,78,95,0.45) !important; }
        .cli-btn-ver:hover { background: rgba(31,78,95,0.22) !important; }
        .cli-btn-editar:hover { background: rgba(148,163,184,0.1) !important; border-color: #3d4360 !important; color:#cbd5e1 !important; }
        .cli-btn-excluir:hover:not(:disabled) { background: rgba(248,113,113,0.1) !important; }
        .cli-btn-cancelar:hover { background: rgba(148,163,184,0.08) !important; border-color: #3d4360 !important; }
        .cli-btn-salvar:hover:not(:disabled) { filter: brightness(1.1); }
        .cli-ord-pill:hover { border-color: #3d4360 !important; color: #94a3b8 !important; }
      `}</style>

      {carregando && <PageLoader title="Carregando clientes..." />}
      {!carregando && erro && (
        <div style={{ background:'#450a0a', border:'1px solid #7f1d1d', borderRadius:8, padding:16, marginBottom:20, color:'#fca5a5' }}>
          <strong>Erro:</strong> {erro}
        </div>
      )}
      {!carregando && sucesso && (
        <div style={{ background:'#14532d', border:'1px solid #16a34a', borderRadius:10, padding:'14px 20px', marginBottom:20, color:'#4ade80', fontSize:13, fontWeight:600 }}>
          ✅ {sucesso}
        </div>
      )}

      {/* ── BUSCA + ORDENAÇÃO ─────────────────────────────────────────────── */}
      {!carregando && (
        <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap', alignItems:'center' }}>
          <input
            style={{ flex:1, minWidth:200, padding:'10px 14px', borderRadius:8, border:'1px solid #2d3148', background:'#1e2130', color:'#e2e8f0', fontSize:13, outline:'none' }}
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {([
              { key: 'recentes', label: 'Mais recentes'       },
              { key: 'nome',     label: 'Nome A-Z'            },
              { key: 'proximo',  label: 'Próximo compromisso' },
            ] as const).map(({ key, label }) => {
              const ativo = ordenacao === key;
              return (
                <button key={key} className={ativo ? undefined : 'cli-ord-pill'} onClick={() => setOrdenacao(key)} style={{
                  padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12,
                  border:`1px solid ${ativo ? '#1F4E5F' : '#2d3148'}`,
                  background: ativo ? 'rgba(31,78,95,0.2)' : 'transparent',
                  color: ativo ? '#4a9bb0' : '#64748b',
                  fontWeight: ativo ? 600 : 400, whiteSpace:'nowrap',
                  transition:'border-color 0.15s, color 0.15s',
                }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ESTADO VAZIO ──────────────────────────────────────────────────── */}
      {!carregando && pacientes.length === 0 && (
        <div style={{ textAlign:'center', padding:'80px 24px' }}>
          <div style={{ fontSize:64, marginBottom:20, opacity:0.35 }}>👥</div>
          <div style={{ fontSize:18, fontWeight:600, color:'#64748b', marginBottom:8 }}>
            Nenhum cliente cadastrado.
          </div>
          <div style={{ fontSize:13, color:'#475569', marginBottom:28 }}>
            Cadastre seu primeiro cliente para começar a organizar.
          </div>
          <button onClick={abrirNovo} style={{
            display:'inline-flex', alignItems:'center', gap:8,
            padding:'12px 28px', borderRadius:10, border:'none',
            background:'linear-gradient(135deg,#1F4E5F,#0d3547)',
            color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
          }}>
            ➕ Novo Cliente
          </button>
        </div>
      )}

      {/* ── ESTADO BUSCA VAZIA ────────────────────────────────────────────── */}
      {!carregando && pacientes.length > 0 && ordenados.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 24px', color:'#475569' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Nenhum cliente encontrado para a busca.</div>
          <button
            onClick={() => setBusca('')}
            style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #2d3148', background:'transparent', color:'#94a3b8', fontSize:13, cursor:'pointer' }}
          >
            Limpar busca
          </button>
        </div>
      )}

      {/* ── LISTA DE CLIENTES ─────────────────────────────────────────────── */}
      {!carregando && ordenados.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {ordenados.map(p => {
            const st = statusConfig[p.status] || statusConfig.ativo;
            return (
              <div
                key={p.id}
                className="cli-card"
                style={{ background:'#1e2130', border:'1px solid #2d3148', borderRadius:14, padding:'20px 24px' }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                  {/* Avatar */}
                  <div
                    onClick={() => abrirDetalhe(p)}
                    style={{ width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg,#1F4E5F,#0d3547)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, fontWeight:700, color:'#fff', flexShrink:0, cursor:'pointer' }}
                  >
                    {p.nome?.charAt(0).toUpperCase()}
                  </div>

                  {/* Dados */}
                  <div style={{ flex:1, minWidth:160 }}>
                    <div
                      onClick={() => abrirDetalhe(p)}
                      style={{ fontWeight:700, color:'#f1f5f9', fontSize:15, marginBottom:4, cursor:'pointer' }}
                    >
                      {p.nome}
                    </div>
                    <div style={{ fontSize:12, color:'#64748b' }}>
                      {[p.telefone, p.email].filter(Boolean).join('  ·  ') || 'Sem contato cadastrado'}
                    </div>
                    {p.proxima_consulta && (
                      <div style={{ fontSize:12, marginTop:5, color: p.proxima_consulta === hoje ? '#fbbf24' : '#4a9bb0' }}>
                        📅 {formatarData(p.proxima_consulta)}{p.proxima_consulta === hoje ? '  ·  HOJE' : ''}
                      </div>
                    )}
                  </div>

                  {/* Status + Ações */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:st.bg, color:st.color }}>
                      {st.label}
                    </span>
                    <button
                      className="cli-btn-ver"
                      onClick={() => abrirDetalhe(p)}
                      style={{ padding:'6px 14px', borderRadius:8, border:'1px solid rgba(31,78,95,0.4)', background:'rgba(31,78,95,0.12)', color:'#4a9bb0', fontSize:12, cursor:'pointer', fontWeight:600, transition:'background 0.15s' }}
                    >
                      Ver
                    </button>
                    <button
                      className="cli-btn-editar"
                      onClick={() => abrirEdicao(p)}
                      style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #2d3148', background:'transparent', color:'#94a3b8', fontSize:12, cursor:'pointer', transition:'background 0.15s, border-color 0.15s, color 0.15s' }}
                    >
                      Editar
                    </button>
                    <button
                      className="cli-btn-excluir"
                      onClick={() => excluir(p.id)}
                      disabled={excluindo === p.id}
                      style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #450a0a', background:'transparent', color:'#f87171', fontSize:12, cursor:'pointer', transition:'background 0.15s' }}
                    >
                      {excluindo === p.id ? '...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL DETALHE DO CLIENTE ──────────────────────────────────────── */}
      {detalhe && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
          onClick={e => { if (e.target === e.currentTarget) setDetalhe(null); }}
        >
          <div style={{ background:'#1e2130', borderRadius:20, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', border:'1px solid #2d3148', animation:'slideInRight 0.25s ease' }}>

            {/* Header */}
            <div style={{ padding:'28px 28px 20px', borderBottom:'1px solid #2d3148' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#1F4E5F,#0d3547)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {detalhe.nome?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:19, fontWeight:700, color:'#f1f5f9', marginBottom:7 }}>{detalhe.nome}</div>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:(statusConfig[detalhe.status] || statusConfig.ativo).bg, color:(statusConfig[detalhe.status] || statusConfig.ativo).color }}>
                      {(statusConfig[detalhe.status] || statusConfig.ativo).label}
                    </span>
                  </div>
                </div>
                <button onClick={() => setDetalhe(null)} style={{ background:'none', border:'none', color:'#64748b', fontSize:22, cursor:'pointer', padding:'4px 8px', lineHeight:1, flexShrink:0 }}>✕</button>
              </div>
            </div>

            <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:28 }}>

              {/* Informações */}
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:'#4a9bb0', letterSpacing:2, textTransform:'uppercase', marginBottom:16 }}>
                  Informações
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                  {[
                    { icon:'📱', label:'Telefone',    value: detalhe.telefone    },
                    { icon:'💬', label:'WhatsApp',    value: detalhe.whatsapp    },
                    { icon:'📧', label:'E-mail',      value: detalhe.email       },
                    { icon:'🏠', label:'Endereço',    value: detalhe.endereco    },
                    { icon:'🌐', label:'Site',        value: detalhe.site_link   },
                    { icon:'📝', label:'Observações', value: detalhe.observacoes },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <span style={{ fontSize:14, flexShrink:0, width:22 }}>{f.icon}</span>
                      <span style={{ fontSize:11, color:'#64748b', fontWeight:600, width:82, flexShrink:0, paddingTop:1 }}>{f.label}</span>
                      <span style={{ fontSize:13, color:'#cbd5e1', flex:1, wordBreak:'break-word' }}>{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Central de Contatos */}
              {(detalhe.telefone || detalhe.email || detalhe.endereco || detalhe.site_link) && (
                <div>
                  <div style={{ fontSize:10, fontWeight:800, color:'#4a9bb0', letterSpacing:2, textTransform:'uppercase', marginBottom:14 }}>
                    Central de Contatos
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {detalhe.telefone && (
                      <a href={`tel:${normalizar(detalhe.telefone)}`} style={cBtn}>☎️ Ligar</a>
                    )}
                    {(detalhe.whatsapp || detalhe.telefone) && (
                      <a
                        href={`https://wa.me/55${normalizar(detalhe.whatsapp || detalhe.telefone || '')}?text=${encodeURIComponent('Olá, tudo bem?')}`}
                        target="_blank" rel="noreferrer" style={cBtn}
                      >
                        💬 WhatsApp
                      </a>
                    )}
                    {detalhe.email && (
                      <a href={`mailto:${detalhe.email}`} style={cBtn}>📧 E-mail</a>
                    )}
                    {detalhe.endereco && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detalhe.endereco)}`}
                        target="_blank" rel="noreferrer" style={cBtn}
                      >
                        📍 Google Maps
                      </a>
                    )}
                    {detalhe.site_link && (
                      <a
                        href={detalhe.site_link.startsWith('http') ? detalhe.site_link : `https://${detalhe.site_link}`}
                        target="_blank" rel="noreferrer" style={cBtn}
                      >
                        🌐 Site
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Histórico */}
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:'#4a9bb0', letterSpacing:2, textTransform:'uppercase', marginBottom:14 }}>
                  Histórico de Compromissos
                </div>
                {carregandoHist ? (
                  <div style={{ color:'#475569', fontSize:13 }}>Carregando...</div>
                ) : historico.length === 0 ? (
                  <div style={{ color:'#475569', fontSize:13 }}>Nenhum compromisso encontrado.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                    {historico.map((h, i) => {
                      const cor   = stHistorico[h.status]?.color || '#64748b';
                      const label = stHistorico[h.status]?.label || h.status;
                      return (
                        <div key={`${h.id}-${i}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom: i < historico.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'#4a9bb0', minWidth:52 }}>{formatarData(h.data)}</span>
                          <span style={{ fontSize:13, color:'#cbd5e1', flex:1 }}>{h.tipo_consulta || 'Compromisso'}</span>
                          <span style={{ fontSize:11, color:cor, fontWeight:600, whiteSpace:'nowrap' }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ações */}
              <div style={{ display:'flex', gap:10 }}>
                <button
                  className="cli-btn-ver"
                  onClick={editarDeDetalhe}
                  style={{ flex:1, padding:'11px', borderRadius:9, border:'1px solid rgba(31,78,95,0.4)', background:'rgba(31,78,95,0.12)', color:'#4a9bb0', fontSize:13, fontWeight:600, cursor:'pointer', transition:'background 0.15s' }}
                >
                  ✏️ Editar
                </button>
                <button
                  className="cli-btn-excluir"
                  onClick={() => excluir(detalhe.id)}
                  disabled={excluindo === detalhe.id}
                  style={{ flex:1, padding:'11px', borderRadius:9, border:'1px solid #450a0a', background:'transparent', color:'#f87171', fontSize:13, fontWeight:600, cursor:'pointer', transition:'background 0.15s' }}
                >
                  {excluindo === detalhe.id ? '...' : '🗑️ Excluir'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CADASTRO / EDIÇÃO ───────────────────────────────────────── */}
      {modal && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1010, padding:16 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}
        >
          <div style={{ background:'#1e2130', borderRadius:16, padding:32, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', border:'1px solid #2d3148' }}>
            <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', marginBottom:24, marginTop:0 }}>
              {editando ? 'Editar cliente' : 'Novo cliente'}
            </h2>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {camposForm.map(f => (
                <div key={f.key}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Observações
                </label>
                <textarea
                  placeholder="Ex: Cliente VIP, prefere atendimento pela manhã..."
                  value={form.observacoes}
                  onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={3}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box', resize:'vertical', fontFamily:'inherit' }}
                />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="aguardando">Aguardando</option>
                </select>
              </div>
            </div>
            {erro && <p style={{ color:'#f87171', fontSize:12, marginTop:8 }}>{erro}</p>}
            <div style={{ display:'flex', gap:10, marginTop:24 }}>
              <button
                className="cli-btn-cancelar"
                onClick={() => setModal(false)}
                style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid #2d3148', background:'transparent', color:'#94a3b8', fontSize:13, cursor:'pointer', transition:'background 0.15s, border-color 0.15s' }}
              >
                Cancelar
              </button>
              <button
                className="cli-btn-salvar"
                onClick={salvar}
                disabled={salvando}
                style={{ flex:2, padding:'10px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#1F4E5F,#0d3547)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity:salvando ? 0.7 : 1, transition:'filter 0.15s' }}
              >
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
