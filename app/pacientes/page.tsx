'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';

interface Paciente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  proxima_consulta: string;
  status: string;
  created_at: string;
}

type FormData = {
  nome: string;
  telefone: string;
  email: string;
  proxima_consulta: string;
  status: string;
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  ativo:     { label: 'Ativo',     color: '#16a34a', bg: '#dcfce7' },
  inativo:   { label: 'Inativo',   color: '#dc2626', bg: '#fee2e2' },
  aguardando:{ label: 'Aguardando',color: '#d97706', bg: '#fef3c7' },
};

const camposForm = [
  { key: 'nome',             label: 'Nome completo',       type: 'text',  placeholder: 'Ex: Maria Silva'     },
  { key: 'telefone',         label: 'Telefone / WhatsApp', type: 'text',  placeholder: 'Ex: 11999999999'     },
  { key: 'email',            label: 'E-mail',              type: 'email', placeholder: 'Ex: maria@email.com' },
  { key: 'proxima_consulta', label: 'Proxima consulta',    type: 'date',  placeholder: ''                    },
];

const formInicial: FormData = { nome: '', telefone: '', email: '', proxima_consulta: '', status: 'ativo' };

export default function PacientesPage() {
  const router = useRouter();
  const [pacientes, setPacientes]   = useState<Paciente[]>([]);
  const [busca, setBusca]           = useState('');
  const [modal, setModal]           = useState(false);
  const [editando, setEditando]     = useState<Paciente | null>(null);
  const [form, setForm]             = useState<FormData>(formInicial);
  const [salvando, setSalvando]     = useState(false);
  const [excluindo, setExcluindo]   = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]             = useState('');
  const [clinicaId, setClinicaId]   = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: cu, error: cuError } = await supabase.from('clinica_usuarios').select('clinica_id').eq('usuario_id', user.id).maybeSingle();
      if (cuError) {
        console.error("Erro ao buscar clinica_usuarios:", cuError);
      }
      const clinicaId = cu?.clinica_id;
      setClinicaId(clinicaId || '');
      if (!clinicaId) { setPacientes([]); setCarregando(false); return; }
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('clinica_id', clinicaId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error("Erro ao buscar pacientes:", error);
        throw new Error(`Erro ao carregar pacientes: ${error.message}`);
      }
      if (data) setPacientes(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') {
        router.push('/login');
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("Erro ao carregar pacientes:", message);
      setErro(message || 'Erro ao carregar pacientes');
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm(formInicial); setErro(''); setModal(true); }

  function abrirEdicao(p: Paciente) {
    setEditando(p);
    setForm({ nome: p.nome, telefone: p.telefone || '', email: p.email || '', proxima_consulta: p.proxima_consulta || '', status: p.status || 'ativo' });
    setErro(''); setModal(true);
  }

  // Cria ou atualiza o agendamento correspondente à proxima_consulta do paciente.
  // Busca por telefone + clinica_id + data futura para evitar duplicatas.
  async function sincronizarAgendamento(
    userId: string | undefined,
    nome: string,
    telefone: string,
    proxima: string,
    telefoneAnterior?: string,
  ) {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const telBusca = telefoneAnterior || telefone;

    const { data: existentes } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('clinica_id', clinicaId)
      .eq('telefone', telBusca)
      .gte('data', hoje)
      .not('status', 'in', '("cancelado","concluido","faltou")')
      .order('data', { ascending: true })
      .limit(1);

    const existente = existentes?.[0] ?? null;

    if (existente) {
      await supabase
        .from('agendamentos')
        .update({ paciente_nome: nome, telefone, data: proxima })
        .eq('id', existente.id);
    } else {
      await supabase
        .from('agendamentos')
        .insert({
          paciente_nome:       nome,
          telefone,
          data:                proxima,
          hora:                '09:00',
          tipo_consulta:       'Consulta',
          status:              'agendado',
          clinica_id:          clinicaId,
          user_id:             userId,
          confirmado:          false,
          precisa_reagendar:   false,
          lembrete_enviado:    false,
          confirmacao_enviada: false,
        });
    }
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome e obrigatorio.'); return; }

    // Verificar duplicidade por telefone antes de inserir
    if (!editando && form.telefone.trim()) {
      const telefoneLimpo = form.telefone.replace(/\D/g, '');
      const { data: existente } = await supabase
        .from('pacientes')
        .select('id, nome')
        .eq('clinica_id', clinicaId)
        .or(`telefone.eq.${telefoneLimpo},whatsapp.eq.${telefoneLimpo}`)
        .maybeSingle();
      if (existente) {
        setErro(`Já existe um paciente com este telefone: ${existente.nome}`);
        return;
      }
    }

    setSalvando(true); setErro('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const telefoneSalvo = form.telefone.replace(/\D/g, '');
      const payload = { ...form, telefone: telefoneSalvo, user_id: user?.id, clinica_id: clinicaId };
      let error;
      if (editando) { ({ error } = await supabase.from('pacientes').update(payload).eq('id', editando.id)); }
      else { ({ error } = await supabase.from('pacientes').insert(payload)); }
      if (error) { setErro('Erro ao salvar: ' + error.message); }
      else {
        if (form.proxima_consulta) {
          const telefoneAnterior = editando ? editando.telefone.replace(/\D/g, '') : undefined;
          await sincronizarAgendamento(user?.id, form.nome, telefoneSalvo, form.proxima_consulta, telefoneAnterior);
        }
        setModal(false); carregar();
      }
    } catch (e) {
      setErro('Erro inesperado: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    const paciente = pacientes.find(p => p.id === id);
    if (!paciente) return;

    let aviso = '';
    const telefoneLimpo = (paciente.telefone || '').replace(/\D/g, '');
    if (telefoneLimpo) {
      const hojeLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const { count } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('clinica_id', clinicaId)
        .or(`telefone.eq.${telefoneLimpo},telefone.eq.55${telefoneLimpo}`)
        .gte('data', hojeLocal)
        .not('status', 'in', '("cancelado","concluido","faltou")');
      if (count && count > 0)
        aviso = `\n\n⚠️ Atenção: ${count} agendamento(s) futuro(s) vinculado(s) a este paciente.`;
    }

    if (!confirm(`Excluir o paciente "${paciente.nome}"?${aviso}`)) return;
    setExcluindo(id);
    try {
      const { error } = await supabase.from('pacientes').delete().eq('id', id);
      if (error) { setErro('Erro ao excluir: ' + error.message); return; }
      carregar();
    } catch (e) {
      setErro('Erro ao excluir: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExcluindo(null);
    }
  }

  function whatsapp(telefone: string) { window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}`, '_blank'); }
  function formatarData(data: string) { if (!data) return '-'; const [y,m,d] = data.split('-'); return `${d}/${m}/${y}`; }

  const filtrados = pacientes.filter(p =>
    p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.telefone?.includes(busca) ||
    p.email?.toLowerCase().includes(busca.toLowerCase())
  );

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  return (
    <AdminShell
      title="Clientes"
      subtitle={`${filtrados.length} cliente${filtrados.length !== 1 ? 's' : ''} encontrado${filtrados.length !== 1 ? 's' : ''}`}
      actionLabel="+ Novo cliente"
      actionOnClick={abrirNovo}
    >
      {carregando && <div style={{textAlign:'center', padding:'40px 20px', color:'#64748b'}}>Carregando clientes...</div>}
      {!carregando && erro && <div style={{background:'#450a0a', border:'1px solid #7f1d1d', borderRadius:8, padding:16, marginBottom:20, color:'#fca5a5'}}><strong>Erro:</strong> {erro}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:28 }}>
        {[{ label:'Total de Pacientes', valor:pacientes.length, cor:'#7c3aed' },{ label:'Pacientes Ativos', valor:pacientes.filter(p=>p.status==='ativo').length, cor:'#16a34a' },{ label:'Consultas Hoje', valor:pacientes.filter(p=>p.proxima_consulta===hoje).length, cor:'#0ea5e9' }].map(c => (
          <div key={c.label} style={{ background:'#1e2130', borderRadius:12, padding:'20px 24px', border:'1px solid #2d3148' }}>
            <div style={{ fontSize:12, color:'#64748b', fontWeight:500 }}>{c.label}</div>
            <div style={{ fontSize:32, fontWeight:700, color:c.cor, margin:'8px 0 4px' }}>{c.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:20 }}>
        <input style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #2d3148', background:'#1e2130', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }} placeholder="Buscar por nome, telefone ou e-mail do cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div style={{ background:'#1e2130', borderRadius:12, border:'1px solid #2d3148', overflow:'hidden' }}>
        {carregando ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#475569' }}>Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#475569' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:15, fontWeight:600 }}>Nenhum paciente encontrado</div>
            <div style={{ fontSize:13, marginTop:4 }}>Clique em + Novo paciente para começar</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          <table style={{ width:'100%', minWidth:580, borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#161827' }}>
                {['Paciente','Contato','Proxima Consulta','Status','Acoes'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'12px 16px', fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', borderBottom:'1px solid #2d3148', letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const st = statusConfig[p.status] || statusConfig.ativo;
                return (
                  <tr key={p.id}>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>{p.nome?.charAt(0).toUpperCase()}</div>
                        <div><div style={{ fontWeight:600, color:'#f1f5f9' }}>{p.nome}</div><div style={{ fontSize:11, color:'#475569' }}>{p.email || '-'}</div></div>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e', color:'#cbd5e1' }}>{p.telefone || '-'}</td>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e', color: p.proxima_consulta === hoje ? '#fbbf24' : '#cbd5e1', fontWeight: p.proxima_consulta === hoje ? 600 : 400 }}>
                      {formatarData(p.proxima_consulta)}
                      {p.proxima_consulta === hoje && <span style={{ marginLeft:6, fontSize:10, background:'#78350f', color:'#fbbf24', padding:'2px 6px', borderRadius:4 }}>HOJE</span>}
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e' }}>
                      <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:st.bg, color:st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e' }}>
                      {p.telefone && <button onClick={() => whatsapp(p.telefone)} style={{ padding:'6px 12px', borderRadius:6, border:'none', background:'#16a34a22', color:'#4ade80', fontSize:12, cursor:'pointer', marginRight:4, fontWeight:600 }}>WA</button>}
                      <button onClick={() => abrirEdicao(p)} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #2d3148', background:'transparent', color:'#94a3b8', fontSize:12, cursor:'pointer', marginRight:4 }}>Editar</button>
                      <button onClick={() => excluir(p.id)} disabled={excluindo === p.id} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #450a0a', background:'transparent', color:'#f87171', fontSize:12, cursor:'pointer' }}>{excluindo === p.id ? '...' : 'Excluir'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ background:'#1e2130', borderRadius:16, padding:32, width:'100%', maxWidth:480, border:'1px solid #2d3148' }}>
            <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', marginBottom:24, marginTop:0 }}>{editando ? 'Editar paciente' : 'Novo paciente'}</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {camposForm.map(f => (
                <div key={f.key}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} value={form[f.key as keyof FormData]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Status</label>
                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="aguardando">Aguardando</option>
                </select>
              </div>
            </div>
            {erro && <p style={{ color:'#f87171', fontSize:12, marginTop:8 }}>{erro}</p>}
            <div style={{ display:'flex', gap:10, marginTop:24 }}>
              <button onClick={() => setModal(false)} style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid #2d3148', background:'transparent', color:'#94a3b8', fontSize:13, cursor:'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ flex:2, padding:'10px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity:salvando ? 0.7 : 1 }}>{salvando ? 'Salvando...' : editando ? 'Salvar alteracoes' : 'Adicionar paciente'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
