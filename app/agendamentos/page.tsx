'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';

interface Agendamento {
  id: string;
  paciente_nome: string;
  telefone: string;
  data: string;
  hora: string;
  tipo_consulta: string;
  profissional?: string;
  status: string;
  confirmado?: boolean;
  created_at: string;
  observacao?: string;
}

type FormData = {
  paciente_nome: string;
  telefone: string;
  data: string;
  hora: string;
  tipo_consulta: string;
  profissional: string;
  status: string;
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  agendado:  { label: 'Agendado',   color: '#0ea5e9', bg: '#0ea5e922' },
  confirmado:{ label: 'Confirmado', color: '#16a34a', bg: '#16a34a22' },
  faltou:    { label: 'Faltou',     color: '#dc2626', bg: '#dc262622' },
  concluido: { label: 'Concluído',  color: '#4a9bb0', bg: '#1F4E5F22' },
  cancelado: { label: 'Cancelado',  color: '#64748b', bg: '#64748b22' },
  reagendar: { label: 'Reagendar',  color: '#f59e0b', bg: '#f59e0b22' },
  vencido:   { label: 'Atrasado',   color: '#f97316', bg: '#f9731622' },
};

function normalizarStatus(status: string, data: string, hoje: string) {
  if (status === 'agendado' && data && data < hoje) return statusConfig.vencido;
  return statusConfig[status] || statusConfig.agendado;
}

const tiposServico = [
  'Reunião', 'Atendimento', 'Retorno', 'Visita', 'Apresentação', 'Ligação', 'Outro',
];

const formInicial: FormData = {
  paciente_nome: '', telefone: '', data: '', hora: '',
  tipo_consulta: 'Reunião', profissional: '', status: 'agendado',
};

// ── PDF ───────────────────────────────────────────────────────────────

type EmpresaConfig = {
  nome_clinica?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  logo_url?: string;
};

function buildPdfHtml(ags: Agendamento[], empresa: EmpresaConfig | null, data: string): string {
  const [y, m, d] = data.split('-');
  const dataFmt = `${d}/${m}/${y}`;

  const logo = empresa?.logo_url
    ? `<img src="${empresa.logo_url}" style="height:48px;object-fit:contain" alt="Logo" onerror="this.style.display='none'">`
    : `<div style="width:48px;height:48px;border-radius:10px;background:#1F4E5F;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white;font-family:sans-serif">O</div>`;

  const rodape = ([
    empresa?.telefone ? `📱 ${empresa.telefone}` : null,
    `📧 contato@organizaprooficial.com.br`,
    empresa?.endereco ? `📍 ${empresa.endereco}` : null,
  ] as (string | null)[]).filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const linhas = ags.map(a => {
    const stKey = (a.status === 'agendado' && a.data < data) ? 'vencido' : a.status;
    const stLabel = statusConfig[stKey]?.label || a.status;
    return `<tr>
      <td style="font-weight:700;color:#1F4E5F;white-space:nowrap">${a.hora?.substring(0,5) || '-'}</td>
      <td>${a.paciente_nome || '-'}</td>
      <td>${a.tipo_consulta || '-'}</td>
      <td>${a.profissional || '-'}</td>
      <td class="st-${stKey}">${stLabel}</td>
      <td style="color:#475569">${a.observacao || ''}</td>
    </tr>`;
  }).join('');

  const total      = ags.length;
  const confirmados = ags.filter(a => a.status === 'confirmado' || a.confirmado).length;
  const concluidos  = ags.filter(a => a.status === 'concluido').length;

  const tableHtml = total === 0
    ? `<div style="text-align:center;padding:40px;color:#94a3b8;font-size:14px">Nenhum compromisso agendado para este dia.</div>`
    : `<table>
        <thead><tr>
          <th>Hora</th><th>Cliente</th><th>Serviço</th><th>Responsável</th><th>Status</th><th>Observação</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
       </table>`;

  const now = new Date();
  const geradoEm = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Agenda ${dataFmt}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background:#fff}
.page{max-width:860px;margin:0 auto;padding:40px 48px}
.hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:22px;border-bottom:2px solid #1F4E5F;margin-bottom:26px}
.hdr-l{display:flex;align-items:center;gap:16px}
.brand{font-size:22px;font-weight:800;color:#1F4E5F;letter-spacing:-0.5px}
.emp{font-size:14px;color:#475569;margin-top:3px}
.hdr-r{text-align:right}
.rtitle{font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.rdate{font-size:20px;font-weight:700;color:#1F4E5F;margin-top:4px}
.summary{background:#f8fafc;border-radius:8px;padding:14px 20px;margin-bottom:22px;display:flex;gap:32px;flex-wrap:wrap}
.si{font-size:13px;color:#475569}
.si strong{color:#1F4E5F}
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:#1F4E5F;color:white}
thead th{padding:10px 12px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}
tbody tr:nth-child(even){background:#f8fafc}
tbody tr{border-bottom:1px solid #e2e8f0}
tbody td{padding:10px 12px;color:#334155;vertical-align:top}
.st-agendado{color:#0ea5e9;font-weight:600}
.st-confirmado{color:#16a34a;font-weight:600}
.st-concluido{color:#4a9bb0;font-weight:600}
.st-cancelado{color:#64748b;font-weight:600}
.st-faltou{color:#dc2626;font-weight:600}
.st-reagendar{color:#f59e0b;font-weight:600}
.st-vencido{color:#f97316;font-weight:600}
.footer{margin-top:34px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center}
.f-contacts{font-size:12px;color:#64748b;margin-bottom:6px}
.f-gen{font-size:10px;color:#cbd5e1}
@media print{.page{padding:20px 24px}@page{margin:1.5cm}}
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div class="hdr-l">
      ${logo}
      <div>
        <div class="brand">OrganizaPro</div>
        ${empresa?.nome_clinica ? `<div class="emp">${empresa.nome_clinica}</div>` : ''}
      </div>
    </div>
    <div class="hdr-r">
      <div class="rtitle">Relatório de Agenda</div>
      <div class="rdate">${dataFmt}</div>
    </div>
  </div>
  <div class="summary">
    <div class="si">Total: <strong>${total} compromisso${total !== 1 ? 's' : ''}</strong></div>
    <div class="si">Confirmados: <strong>${confirmados}</strong></div>
    <div class="si">Concluídos: <strong>${concluidos}</strong></div>
  </div>
  ${tableHtml}
  <div class="footer">
    ${rodape ? `<div class="f-contacts">${rodape}</div>` : ''}
    <div class="f-gen">Gerado pelo OrganizaPro em ${geradoEm}</div>
  </div>
</div>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────

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
  const [sucesso, setSucesso]           = useState('');
  const [clinicaId, setClinicaId]       = useState('');
  const [enviando, setEnviando]         = useState<string | null>(null);
  const [filtroData, setFiltroData]     = useState<'proximos' | 'confirmados' | 'historico'>('proximos');
  const [gerandoPdf, setGerandoPdf]     = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: cu, error: cuError } = await supabase
        .from('clinica_usuarios').select('clinica_id')
        .eq('usuario_id', user.id).maybeSingle();
      if (cuError) console.error('Erro ao buscar clinica_usuarios:', cuError);
      const clinicaId = cu?.clinica_id;
      setClinicaId(clinicaId || '');
      if (!clinicaId) { setAgendamentos([]); setCarregando(false); return; }
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('clinica_id', clinicaId)
        .order('data', { ascending: true })
        .order('hora', { ascending: true });
      if (error) throw new Error(`Erro ao carregar compromissos: ${error.message}`);
      if (data) setAgendamentos(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') {
        router.push('/login'); return;
      }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm(formInicial); setErro(''); setModal(true); }

  function abrirEdicao(a: Agendamento) {
    setEditando(a);
    setForm({
      paciente_nome: a.paciente_nome,
      telefone:      a.telefone || '',
      data:          a.data,
      hora:          a.hora,
      tipo_consulta: a.tipo_consulta || 'Reunião',
      profissional:  a.profissional  || '',
      status:        a.status        || 'agendado',
    });
    setErro(''); setModal(true);
  }

  async function salvar() {
    if (!form.paciente_nome.trim()) { setErro('Nome do cliente é obrigatório.'); return; }
    if (!form.data)  { setErro('Data é obrigatória.'); return; }
    if (!form.hora)  { setErro('Horário é obrigatório.'); return; }

    setSalvando(true); setErro('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const telefoneLimpo = form.telefone.replace(/\D/g, '');
      const payload = {
        ...form,
        telefone:          telefoneLimpo,
        profissional:      form.profissional || null,
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
        ({ error } = await supabase.from('agendamentos').update(payloadEdicao).eq('id', editando.id).eq('clinica_id', clinicaId));
      } else {
        ({ error } = await supabase.from('agendamentos').insert({
          ...payload, lembrete_enviado: false, confirmacao_enviada: false,
        }));
        if (!error) {
          const { data: clienteExistente } = await supabase
            .from('pacientes').select('id').eq('clinica_id', clinicaId)
            .or(`telefone.eq.${telefoneLimpo},whatsapp.eq.${telefoneLimpo}`).maybeSingle();
          if (!clienteExistente && telefoneLimpo) {
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
          .gte('data', hojeLocal)
          .neq('status', 'cancelado').neq('status', 'concluido').neq('status', 'faltou')
          .order('data', { ascending: true }).limit(1).maybeSingle();
        await supabase.from('pacientes')
          .update({ proxima_consulta: proximoAg?.data ?? null })
          .eq('clinica_id', clinicaId)
          .or(`telefone.eq.${telefoneLimpo},whatsapp.eq.${telefoneLimpo}`);
      }

      if (error) { console.error(error); setErro(MSG_ERRO_PADRAO); }
      else {
        setModal(false); carregar();
        setSucesso(editando ? 'Compromisso atualizado.' : 'Agendamento criado.');
        setTimeout(() => setSucesso(''), 4000);
      }
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este compromisso?')) return;
    setExcluindo(id);
    try {
      const ag = agendamentos.find(a => a.id === id);
      const telefoneLimpo = (ag?.telefone || '').replace(/\D/g, '');
      const { error } = await supabase.from('agendamentos').delete().eq('id', id).eq('clinica_id', clinicaId);
      if (error) { console.error(error); setErro(MSG_ERRO_PADRAO); return; }
      setSucesso('Registro removido.');
      setTimeout(() => setSucesso(''), 4000);
      if (telefoneLimpo && clinicaId) {
        const hojeLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const { data: proximoAg } = await supabase
          .from('agendamentos').select('data').eq('clinica_id', clinicaId)
          .or(`telefone.eq.${telefoneLimpo},telefone.eq.55${telefoneLimpo}`)
          .gte('data', hojeLocal)
          .neq('status', 'cancelado').neq('status', 'concluido').neq('status', 'faltou')
          .order('data', { ascending: true }).limit(1).maybeSingle();
        await supabase.from('pacientes')
          .update({ proxima_consulta: proximoAg?.data ?? null })
          .eq('clinica_id', clinicaId)
          .or(`telefone.eq.${telefoneLimpo},whatsapp.eq.${telefoneLimpo}`);
      }
      carregar();
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setExcluindo(null);
    }
  }

  function enviarWhatsapp(a: Agendamento) {
    const apenasNumeros = (a.telefone || '').replace(/\D/g, '');
    if (!apenasNumeros) {
      setErro('Este compromisso não possui telefone cadastrado para envio de WhatsApp.');
      return;
    }
    setEnviando(a.id); setErro(''); setSucesso('');
    const numero = (apenasNumeros.length === 10 || apenasNumeros.length === 11) ? `55${apenasNumeros}` : apenasNumeros;
    const mensagem = `Olá ${a.paciente_nome}! Confirmando seu compromisso em ${formatarData(a.data)} às ${formatarHorario(a.hora)}. Por favor confirme sua presença.`;
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setEnviando(null);
  }

  function formatarData(d: string)    { if (!d) return '-'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }
  function formatarHorario(h: string) { if (!h) return '-'; return h.substring(0, 5); }

  async function gerarPDF() {
    // Abre a janela imediatamente (antes de qualquer await) para não ser bloqueada como popup
    const win = window.open('', '_blank', 'width=920,height=700');
    if (!win) { alert('Popup bloqueado. Permita popups para este site e tente novamente.'); return; }
    win.document.write('<html><body style="font-family:sans-serif;padding:48px;color:#64748b;font-size:15px">⏳ Gerando PDF...</body></html>');

    setGerandoPdf(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cfg } = await supabase
        .from('clinica_config')
        .select('nome_clinica,telefone,email,endereco,logo_url')
        .eq('user_id', user?.id)
        .maybeSingle();

      const hojeLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const agHoje = agendamentos
        .filter(a => a.data === hojeLocal)
        .sort((a, b) => a.hora.localeCompare(b.hora));

      const html = buildPdfHtml(agHoje, cfg, hojeLocal);
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 800);
    } catch (e) {
      win.close();
      console.error('Erro ao gerar PDF:', e);
    } finally {
      setGerandoPdf(false);
    }
  }

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
      return a.data < hoje || a.status === 'concluido' || a.status === 'cancelado' || a.status === 'faltou';
    })
    .sort((a, b) => {
      if (filtroData === 'historico')
        return b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora);
      return a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora);
    });

  const compromissosHoje = agendamentos.filter(a => a.data === hoje && !['cancelado','faltou'].includes(a.status)).length;
  const confirmados      = agendamentos.filter(a => a.status === 'confirmado' && a.data >= hoje).length;
  const ausencias        = agendamentos.filter(a => a.status === 'faltou').length;
  const concluidos       = agendamentos.filter(a => a.status === 'concluido').length;

  return (
    <AdminShell
      title="Agenda"
      subtitle={`${exibidos.length} compromisso${exibidos.length !== 1 ? 's' : ''} encontrado${exibidos.length !== 1 ? 's' : ''}`}
      actionLabel="+ Novo compromisso"
      actionOnClick={abrirNovo}
    >
      <style>{`
        .ag-btn-pdf:hover:not(:disabled) { background: rgba(31,78,95,0.22) !important; }
        .ag-tab-pill:hover { border-color: #3d4360 !important; color: #94a3b8 !important; }
        .ag-btn-wa:hover:not(:disabled) { filter: brightness(1.15); }
        .ag-btn-editar:hover { background: rgba(148,163,184,0.1) !important; border-color: #3d4360 !important; color:#cbd5e1 !important; }
        .ag-btn-excluir:hover:not(:disabled) { background: rgba(248,113,113,0.1) !important; }
        .ag-btn-cancelar:hover { background: rgba(148,163,184,0.08) !important; border-color: #3d4360 !important; }
        .ag-btn-salvar:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>
      {carregando ? <PageLoader title="Carregando agenda..." /> : (
      <>
      {erro && (
        <Feedback type="erro" message={erro} onClose={() => setErro('')} />
      )}
      {sucesso && (
        <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />
      )}

      {/* CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16, marginBottom:28 }}>
        {[
          { label:'Compromissos Hoje', valor:compromissosHoje, cor:'#1F4E5F' },
          { label:'Confirmados',       valor:confirmados,      cor:'#16a34a' },
          { label:'Ausências',         valor:ausencias,        cor:'#dc2626' },
          { label:'Concluídos',        valor:concluidos,       cor:'#4a9bb0' },
        ].map(c => (
          <div key={c.label} style={{ background:'#1e2130', borderRadius:12, padding:'20px 24px', border:'1px solid #2d3148' }}>
            <div style={{ fontSize:12, color:'#64748b', fontWeight:500 }}>{c.label}</div>
            <div style={{ fontSize:32, fontWeight:700, color:c.cor, margin:'8px 0 4px' }}>{c.valor}</div>
          </div>
        ))}
      </div>

      {/* BUSCA + PDF */}
      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        <input
          style={{ flex:1, padding:'10px 14px', borderRadius:8, border:'1px solid #2d3148', background:'#1e2130', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}
          placeholder="Buscar por cliente ou telefone..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <button
          className="ag-btn-pdf"
          onClick={gerarPDF}
          disabled={gerandoPdf}
          style={{ padding:'10px 16px', borderRadius:8, border:'1px solid rgba(31,78,95,0.4)', background:'rgba(31,78,95,0.12)', color:'#4a9bb0', fontSize:13, fontWeight:600, cursor: gerandoPdf ? 'default' : 'pointer', whiteSpace:'nowrap', opacity: gerandoPdf ? 0.7 : 1, transition:'background 0.15s' }}
        >
          {gerandoPdf ? '⏳ Gerando...' : '📄 PDF de Hoje'}
        </button>
      </div>

      {/* ABAS */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {([
          { key: 'proximos',    label: 'Próximos Compromissos' },
          { key: 'confirmados', label: 'Confirmados'           },
          { key: 'historico',   label: 'Histórico'             },
        ] as const).map(({ key, label }) => {
          const ativo = filtroData === key;
          return (
            <button
              key={key}
              className={ativo ? undefined : 'ag-tab-pill'}
              onClick={() => setFiltroData(key)}
              style={{
                padding:'5px 16px', borderRadius:20,
                border:`1px solid ${ativo ? '#1F4E5F' : '#2d3148'}`,
                background: ativo ? 'rgba(31,78,95,0.2)' : 'transparent',
                color: ativo ? '#4a9bb0' : '#64748b',
                fontSize:12, fontWeight: ativo ? 600 : 400,
                cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* TABELA */}
      <div style={{ background:'#1e2130', borderRadius:12, border:'1px solid #2d3148', overflow:'hidden' }}>
        {exibidos.length === 0 ? (
          agendamentos.length === 0 ? (
            <EmptyState
              icon="📅"
              title="Ainda não há compromissos cadastrados."
              description="Cadastre seu primeiro compromisso para começar a organizar sua agenda."
              actionLabel="➕ Novo Compromisso"
              onAction={abrirNovo}
            />
          ) : (
            <EmptyState
              compact
              icon="🔍"
              title="Nenhum compromisso encontrado."
              description="Ajuste a busca ou o filtro para ver outros resultados."
              actionLabel="Limpar filtros"
              onAction={() => { setBusca(''); setFiltroData('proximos'); }}
            />
          )
        ) : (
          <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
            <table style={{ width:'100%', minWidth:680, borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#161827' }}>
                  {['Cliente','Data e Hora','Serviço','Responsável','Status','Ações'].map(h => (
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
                          <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#1F4E5F,#0d3547)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
                            {a.paciente_nome?.charAt(0).toUpperCase()}
                          </div>
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
                      <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e', color:'#cbd5e1' }}>
                        {a.tipo_consulta || '-'}
                      </td>
                      <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e', color:'#64748b' }}>
                        {a.profissional || '-'}
                      </td>
                      <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e' }}>
                        <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:st.bg, color:st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding:'14px 16px', fontSize:13, borderBottom:'1px solid #1a1d2e', whiteSpace:'nowrap' }}>
                        {a.telefone && (
                          <button
                            className="ag-btn-wa"
                            onClick={() => enviarWhatsapp(a)}
                            disabled={enviando === a.id}
                            style={{ padding:'6px 10px', borderRadius:6, border:'none', background:'#16a34a22', color:'#4ade80', fontSize:11, cursor: enviando === a.id ? 'default' : 'pointer', marginRight:4, fontWeight:600, opacity: enviando === a.id ? 0.6 : 1, transition:'filter 0.15s' }}
                          >
                            {enviando === a.id ? '...' : 'WA'}
                          </button>
                        )}
                        <button
                          className="ag-btn-editar"
                          onClick={() => abrirEdicao(a)}
                          style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #2d3148', background:'transparent', color:'#94a3b8', fontSize:11, cursor:'pointer', marginRight:4, transition:'background 0.15s, border-color 0.15s, color 0.15s' }}
                        >
                          Editar
                        </button>
                        <button
                          className="ag-btn-excluir"
                          onClick={() => excluir(a.id)}
                          disabled={excluindo === a.id}
                          style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #450a0a', background:'transparent', color:'#f87171', fontSize:11, cursor:'pointer', transition:'background 0.15s' }}
                        >
                          {excluindo === a.id ? '...' : 'Excluir'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* MODAL */}
      {modal && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}
        >
          <div style={{ background:'#1e2130', borderRadius:16, padding:32, width:'100%', maxWidth:480, border:'1px solid #2d3148', maxHeight:'90vh', overflowY:'auto' }}>
            <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', marginBottom:24, marginTop:0 }}>
              {editando ? 'Editar compromisso' : 'Novo compromisso'}
            </h2>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {([
                { key:'paciente_nome', label:'Nome do Cliente',  type:'text', placeholder:'Ex: Maria Silva'   },
                { key:'telefone',      label:'Telefone',         type:'text', placeholder:'Ex: 11999999999'   },
                { key:'data',          label:'Data',             type:'date', placeholder:''                  },
                { key:'hora',          label:'Horário',          type:'time', placeholder:''                  },
                { key:'profissional',  label:'Responsável',      type:'text', placeholder:'Ex: João (opcional)' },
              ] as const).map(f => (
                <div key={f.key}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{f.label}</label>
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
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Tipo de Serviço</label>
                <select
                  value={form.tipo_consulta}
                  onChange={e => setForm(prev => ({ ...prev, tipo_consulta: e.target.value }))}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}
                >
                  {tiposServico.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}
                >
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="reagendar">Reagendar</option>
                  <option value="faltou">Faltou</option>
                </select>
              </div>
            </div>
            {erro && <div style={{ marginTop: 16 }}><Feedback type="erro" message={erro} onClose={() => setErro('')} /></div>}
            <div style={{ display:'flex', gap:10, marginTop:24 }}>
              <button
                className="ag-btn-cancelar"
                onClick={() => setModal(false)}
                style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid #2d3148', background:'transparent', color:'#94a3b8', fontSize:13, cursor:'pointer', transition:'background 0.15s, border-color 0.15s' }}
              >
                Cancelar
              </button>
              <button
                className="ag-btn-salvar"
                onClick={salvar}
                disabled={salvando}
                style={{ flex:2, padding:'10px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#1F4E5F,#0d3547)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity:salvando ? 0.7 : 1, transition:'filter 0.15s' }}
              >
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar compromisso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
