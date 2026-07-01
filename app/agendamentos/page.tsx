'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';

interface Agendamento {
  id: string;
  paciente_nome: string;
  telefone: string;
  data: string;
  hora: string;
  tipo_consulta: string;
  status: string;
  confirmado?: boolean;
  created_at: string;
}

type FormData = {
  paciente_nome: string;
  telefone: string;
  data: string;
  hora: string;
  tipo_consulta: string;
  status: string;
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  agendado:  { label: 'Agendado',  color: '#0ea5e9', bg: '#0ea5e922' },
  confirmado:{ label: 'Confirmado',color: '#16a34a', bg: '#16a34a22' },
  faltou:    { label: 'Faltou',    color: '#dc2626', bg: '#dc262622' },
  concluido: { label: 'Concluido', color: '#7c3aed', bg: '#7c3aed22' },
  cancelado: { label: 'Cancelado', color: '#64748b', bg: '#64748b22' },
  reagendar: { label: 'Reagendar', color: '#f59e0b', bg: '#f59e0b22' },
  vencido:   { label: 'Vencido',   color: '#f97316', bg: '#f9731622' },
};

function normalizarStatus(status: string, data: string, hoje: string) {
  if (status === 'agendado' && data && data < hoje) return statusConfig.vencido;
  return statusConfig[status] || statusConfig.agendado;
}

const tiposConsulta = ['Consulta', 'Retorno', 'Avaliacao', 'Limpeza', 'Exame', 'Cirurgia', 'Outro'];

const formInicial: FormData = { paciente_nome: '', telefone: '', data: '', hora: '', tipo_consulta: 'Consulta', status: 'agendado' };

export default function AgendamentosPage() {
  const router = useRouter();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [busca, setBusca]               = useState('');
  const [modal, setModal]               = useState(false);
  const [editando, setEditando]         = useState<Agendamento | null>(null);
  const [form, setForm]                 = useState<FormData>(formInicial);
  const [salvando, setSalvando]         = useState(false);
  const [excluindo, setExcluindo]       = useState<string | null>(null);
  const [carregando, setCarregando]     = useState(true);
  const [erro, setErro]                 = useState('');
  const [clinicaId, setClinicaId]       = useState('');
  const [userId, setUserId]             = useState('');
  const [enviando, setEnviando]         = useState<string | null>(null);
  const [msgEnvio, setMsgEnvio]         = useState('');
  const [filtroData, setFiltroData]     = useState<'proximos' | 'confirmados' | 'historico'>('proximos');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      const { data: cu, error: cuError } = await supabase.from('clinica_usuarios').select('clinica_id').eq('usuario_id', user.id).maybeSingle();
      if (cuError) {
        console.error("Erro ao buscar clinica_usuarios:", cuError);
      }
      const clinicaId = cu?.clinica_id;
      setClinicaId(clinicaId || '');
      if (!clinicaId) { setAgendamentos([]); setCarregando(false); return; }
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('clinica_id', clinicaId)
        .order('data', { ascending: true })
        .order('hora', { ascending: true });
      if (error) {
        console.error("Erro ao buscar agendamentos:", error);
        throw new Error(`Erro ao carregar agendamentos: ${error.message}`);
      }
      if (data) setAgendamentos(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') {
        router.push('/login');
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("Erro ao carregar agendamentos:", message);
      setErro(message || 'Erro ao carregar agendamentos');
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm(formInicial); setErro(''); setModal(true); }

  function abrirEdicao(a: Agendamento) {
    setEditando(a);
    setForm({ paciente_nome: a.paciente_nome, telefone: a.telefone || '', data: a.data, hora: a.hora, tipo_consulta: a.tipo_consulta || 'Consulta', status: a.status || 'agendado' });
    setErro(''); setModal(true);
  }

  async function salvar() {
    if (!form.paciente_nome.trim()) { setErro('Nome do paciente e obrigatorio.'); return; }
    if (!form.data) { setErro('Data e obrigatoria.'); return; }
    if (!form.hora) { setErro('Horario e obrigatorio.'); return; }

    setSalvando(true);
    setErro('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const telefoneLimpo = form.telefone.replace(/\D/g, '');

      const payload = {
        ...form,
        telefone:          telefoneLimpo,
        user_id:           user?.id,
        clinica_id:        clinicaId,
        confirmado:        form.status === 'confirmado',
        precisa_reagendar: form.status === 'reagendar',
      };

      let error;

      if (editando) {
        const payloadEdicao = editando.data !== form.data
          ? { ...payload, lembrete_enviado: false, confirmacao_enviada: false }
          : payload;
        ({ error } = await supabase.from('agendamentos').update(payloadEdicao).eq('id', editando.id));
      } else {
        ({ error } = await supabase.from('agendamentos').insert({ ...payload, lembrete_enviado: false, confirmacao_enviada: false }));
        if (!error) {
          const { data: pacienteExistente } = await supabase
            .from('pacientes').select('id').eq('clinica_id', clinicaId)
            .or(`telefone.eq.${telefoneLimpo},whatsapp.eq.${telefoneLimpo}`).maybeSingle();
          if (!pacienteExistente) {
            await supabase.from('pacientes').insert({
              nome: form.paciente_nome, telefone: telefoneLimpo, whatsapp: telefoneLimpo,
              email: '', status: 'ativo', clinica_id: clinicaId, user_id: user?.id,
              proxima_consulta: form.data,
            });
          }
        }
      }

      if (!error && telefoneLimpo) {
        const hojeLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const { data: proximoAg } = await supabase
          .from('agendamentos').select('data').eq('clinica_id', clinicaId)
          .or(`telefone.eq.${telefoneLimpo},telefone.eq.55${telefoneLimpo}`)
          .gte('data', hojeLocal).neq('status', 'cancelado').neq('status', 'concluido').neq('status', 'faltou')
          .order('data', { ascending: true }).limit(1).maybeSingle();
        await supabase.from('pacientes')
          .update({ proxima_consulta: proximoAg?.data ?? null })
          .eq('clinica_id', clinicaId)
          .or(`telefone.eq.${telefoneLimpo},whatsapp.eq.${telefoneLimpo}`);
      }

      if (error) {
        setErro('Erro ao salvar: ' + error.message);
      } else {
        setModal(false);
        carregar();
      }
    } catch (e) {
      setErro('Erro inesperado: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }
    

  async function excluir(id: string) {
    if (!confirm('Excluir este agendamento?')) return;
    setExcluindo(id);
    try {
      const ag = agendamentos.find(a => a.id === id);
      const telefoneLimpo = (ag?.telefone || '').replace(/\D/g, '');

      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
      if (error) { setErro('Erro ao excluir: ' + error.message); return; }

      if (telefoneLimpo && clinicaId) {
        const hojeLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const { data: proximoAg } = await supabase
          .from('agendamentos').select('data').eq('clinica_id', clinicaId)
          .or(`telefone.eq.${telefoneLimpo},telefone.eq.55${telefoneLimpo}`)
          .gte('data', hojeLocal).neq('status', 'cancelado').neq('status', 'concluido').neq('status', 'faltou')
          .order('data', { ascending: true }).limit(1).maybeSingle();
        await supabase.from('pacientes')
          .update({ proxima_consulta: proximoAg?.data ?? null })
          .eq('clinica_id', clinicaId)
          .or(`telefone.eq.${telefoneLimpo},whatsapp.eq.${telefoneLimpo}`);
      }

      carregar();
    } catch (e) {
      setErro('Erro ao excluir: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExcluindo(null);
    }
  }

  async function enviarWhatsapp(a: Agendamento) {
    if (!a.telefone) return;
    setEnviando(a.id);
    setMsgEnvio('');
    try {
      const mensagem = `Olá ${a.paciente_nome}! Confirmando sua consulta em ${formatarData(a.data)} às ${formatarHorario(a.hora)}. Por favor confirme sua presença.`;
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinica_id: clinicaId, user_id: userId, telefone: a.telefone, mensagem }),
      });
      const json = await res.json();
      if (json.sucesso) {
        // Marca confirmacao_enviada=true para que o webhook processe a resposta do paciente
        await supabase.from('agendamentos').update({ confirmacao_enviada: true }).eq('id', a.id);
        setMsgEnvio('sucesso:Mensagem enviada com sucesso!');
        carregar();
      } else {
        setMsgEnvio('erro:' + (json.error ?? JSON.stringify(json)));
      }
    } catch (err) {
      setMsgEnvio('erro:' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setEnviando(null);
      setTimeout(() => setMsgEnvio(''), 4000);
    }
  }

  function formatarData(data: string) { if (!data) return '-'; const [y,m,d] = data.split('-'); return `${d}/${m}/${y}`; }
  function formatarHorario(h: string) { if (!h) return '-'; return h.substring(0,5); }

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const filtrados = agendamentos.filter(a =>
    a.paciente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
    a.telefone?.includes(busca)
  );

  const exibidos = filtrados
    .filter(a => {
      if (filtroData === 'proximos')
        return a.data >= hoje && a.status !== 'concluido' && a.status !== 'cancelado' && a.status !== 'faltou';
      if (filtroData === 'confirmados')
        return a.confirmado === true || a.status === 'confirmado';
      // historico: data passada OU concluído OU cancelado OU faltou
      return a.data < hoje || a.status === 'concluido' || a.status === 'cancelado' || a.status === 'faltou';
    })
    .sort((a, b) => {
      if (filtroData === 'historico')
        return b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora);
      return a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora);
    });

  // Contadores sobre todos os agendamentos (sem filtro de aba)
  const agendadosHoje = agendamentos.filter(a => a.data === hoje && !['cancelado','faltou'].includes(a.status)).length;
  const confirmados   = agendamentos.filter(a => a.status === 'confirmado' && a.data >= hoje).length;
  const faltas        = agendamentos.filter(a => a.status === 'faltou').length;
  const concluidos    = agendamentos.filter(a => a.status === 'concluido').length;

  return (
    <AdminShell
      title="Agendamentos"
      subtitle={`${exibidos.length} agendamento${exibidos.length !== 1 ? 's' : ''} encontrado${exibidos.length !== 1 ? 's' : ''}`}
      actionLabel="+ Novo agendamento"
      actionOnClick={abrirNovo}
    >
      {carregando && <div style={{textAlign:'center', padding:'40px 20px', color:'#64748b'}}>Carregando agendamentos...</div>}
      {!carregando && erro && <div style={{background:'#450a0a', border:'1px solid #7f1d1d', borderRadius:8, padding:16, marginBottom:20, color:'#fca5a5'}}><strong>Erro:</strong> {erro}</div>}
      {msgEnvio && (
        <div style={{ background: msgEnvio.startsWith('sucesso') ? '#052e16' : '#450a0a', border: `1px solid ${msgEnvio.startsWith('sucesso') ? '#166534' : '#7f1d1d'}`, borderRadius:8, padding:'12px 16px', marginBottom:16, color: msgEnvio.startsWith('sucesso') ? '#4ade80' : '#fca5a5', fontSize:13 }}>
          {msgEnvio.replace(/^(sucesso|erro):/, '')}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16, marginBottom:28 }}>
        {[
          { label:'Agendamentos Hoje', valor:agendadosHoje, cor:'#0ea5e9' },
          { label:'Confirmados',       valor:confirmados,   cor:'#16a34a' },
          { label:'Faltas',            valor:faltas,        cor:'#dc2626' },
          { label:'Concluidos',        valor:concluidos,    cor:'#7c3aed' },
        ].map(c => (
          <div key={c.label} style={{ background:'#1e2130', borderRadius:12, padding:'20px 24px', border:'1px solid #2d3148' }}>
            <div style={{ fontSize:12, color:'#64748b', fontWeight:500 }}>{c.label}</div>
            <div style={{ fontSize:32, fontWeight:700, color:c.cor, margin:'8px 0 4px' }}>{c.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:12 }}>
        <input style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #2d3148', background:'#1e2130', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }} placeholder="Buscar por paciente ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {([
          { key: 'proximos',    label: 'Próximos Agendamentos' },
          { key: 'confirmados', label: 'Confirmados'           },
          { key: 'historico',   label: 'Histórico'             },
        ] as const).map(({ key, label }) => {
          const ativo = filtroData === key;
          return (
            <button
              key={key}
              onClick={() => setFiltroData(key)}
              style={{ padding:'5px 16px', borderRadius:20, border:`1px solid ${ativo ? '#7c3aed' : '#2d3148'}`, background: ativo ? 'rgba(124,58,237,0.15)' : 'transparent', color: ativo ? '#a78bfa' : '#64748b', fontSize:12, fontWeight: ativo ? 600 : 400, cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ background:'#1e2130', borderRadius:12, border:'1px solid #2d3148', overflow:'hidden' }}>
        {carregando ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#475569' }}>Carregando...</div>
        ) : exibidos.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#475569' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
            <div style={{ fontSize:15, fontWeight:600 }}>Nenhum agendamento encontrado</div>
            <div style={{ fontSize:13, marginTop:4 }}>Clique em + Novo agendamento para comecar</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          <table style={{ width:'100%', minWidth:620, borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#161827' }}>
                {['Paciente','Data e Hora','Tipo','Status','Acoes'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'12px 16px', fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', borderBottom:'1px solid #2d3148', letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exibidos.map(a => {
                const st = normalizarStatus(a.status, a.data, hoje);
                const isHoje = a.data === hoje;
                return (
                  <tr key={a.id}>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>{a.paciente_nome?.charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight:600, color:'#f1f5f9' }}>{a.paciente_nome}</div>
                          <div style={{ fontSize:11, color:'#475569' }}>{a.telefone || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e' }}>
                      <div style={{ color: isHoje ? '#fbbf24' : '#cbd5e1', fontWeight: isHoje ? 600 : 400 }}>
                        {formatarData(a.data)}
                        {isHoje && <span style={{ marginLeft:6, fontSize:10, background:'#78350f', color:'#fbbf24', padding:'2px 6px', borderRadius:4 }}>HOJE</span>}
                      </div>
                      <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{formatarHorario(a.hora)}</div>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e', color:'#cbd5e1' }}>{a.tipo_consulta || '-'}</td>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e' }}>
                      <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:st.bg, color:st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e' }}>
                      {a.telefone && <button onClick={() => enviarWhatsapp(a)} disabled={enviando === a.id} style={{ padding:'6px 12px', borderRadius:6, border:'none', background:'#16a34a22', color:'#4ade80', fontSize:12, cursor: enviando === a.id ? 'default' : 'pointer', marginRight:4, fontWeight:600, opacity: enviando === a.id ? 0.6 : 1 }}>{enviando === a.id ? '...' : 'WA'}</button>}
                      <button onClick={() => abrirEdicao(a)} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #2d3148', background:'transparent', color:'#94a3b8', fontSize:12, cursor:'pointer', marginRight:4 }}>Editar</button>
                      <button onClick={() => excluir(a.id)} disabled={excluindo === a.id} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #450a0a', background:'transparent', color:'#f87171', fontSize:12, cursor:'pointer' }}>{excluindo === a.id ? '...' : 'Excluir'}</button>
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
          <div style={{ background:'#1e2130', borderRadius:16, padding:32, width:'100%', maxWidth:480, border:'1px solid #2d3148', maxHeight:'90vh', overflowY:'auto' }}>
            <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', marginBottom:24, marginTop:0 }}>{editando ? 'Editar agendamento' : 'Novo agendamento'}</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {[
                { key:'paciente_nome', label:'Nome do Paciente', type:'text',  placeholder:'Ex: Maria Silva'  },
                { key:'telefone',      label:'Telefone/WhatsApp', type:'text',  placeholder:'Ex: 11999999999' },
                { key:'data',          label:'Data',              type:'date',  placeholder:''                },
                { key:'hora',          label:'Horario',           type:'time',  placeholder:''                },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} value={form[f.key as keyof FormData]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Tipo de Consulta</label>
                <select value={form.tipo_consulta} onChange={e => setForm(prev => ({ ...prev, tipo_consulta: e.target.value }))} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}>
                  {tiposConsulta.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Status</label>
                <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}>
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="faltou">Faltou</option>
                  <option value="concluido">Concluido</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="reagendar">Reagendar</option>
                </select>
              </div>
            </div>
            {erro && <p style={{ color:'#f87171', fontSize:12, marginTop:8 }}>{erro}</p>}
            <div style={{ display:'flex', gap:10, marginTop:24 }}>
              <button onClick={() => setModal(false)} style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid #2d3148', background:'transparent', color:'#94a3b8', fontSize:13, cursor:'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ flex:2, padding:'10px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity:salvando ? 0.7 : 1 }}>{salvando ? 'Salvando...' : editando ? 'Salvar alteracoes' : 'Adicionar agendamento'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
