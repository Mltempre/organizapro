'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { FileText, LoaderCircle } from 'lucide-react';
import { obterHorariosVagos } from '../../lib/horarios';

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
  valor?: number | string | null;
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
  horario_funcionamento?: string;
};

function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatarTelefonePdf(telefone?: string): string {
  const n = (telefone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return telefone || '-';
}

function buildPdfHtml(ags: Agendamento[], empresa: EmpresaConfig | null, data: string, responsavel?: string): string {
  const [y, m, d] = data.split('-');
  const dataFmt = `${d}/${m}/${y}`;

  const nomeEmpresa = empresa?.nome_clinica?.trim() || 'Empresa';
  const logo = empresa?.logo_url
    ? `<img src="${escaparHtml(empresa.logo_url)}" style="max-width:150px;max-height:54px;object-fit:contain" alt="Logo da empresa" onerror="this.style.display='none'">`
    : `<div style="width:50px;height:50px;border-radius:12px;background:#1F4E5F;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white;font-family:sans-serif">${escaparHtml(nomeEmpresa.charAt(0).toUpperCase())}</div>`;

  const rodape = ([
    empresa?.telefone ? `Telefone: ${escaparHtml(formatarTelefonePdf(empresa.telefone))}` : null,
    empresa?.email ? `E-mail: ${escaparHtml(empresa.email)}` : null,
    empresa?.endereco ? `Endereço: ${escaparHtml(empresa.endereco)}` : null,
  ] as (string | null)[]).filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const horariosVagos = obterHorariosVagos(ags, empresa?.horario_funcionamento);
  const agendaOrdenada = [...ags].sort((a, b) => a.hora.localeCompare(b.hora));

  const linhas = agendaOrdenada.map(a => {
    const stKey = (a.status === 'agendado' && a.data < data) ? 'vencido' : a.status;
    const stLabel = a.status === 'agendado' ? 'Pendente' : (statusConfig[stKey]?.label || a.status);
    return `<tr>
      <td style="font-weight:700;color:#1F4E5F;white-space:nowrap">${a.hora?.substring(0,5) || '-'}</td>
      <td><strong>${escaparHtml(a.paciente_nome || '-')}</strong></td>
      <td>${escaparHtml(a.tipo_consulta || '-')}</td>
      <td><span class="status status-${stKey}"><i></i>${escaparHtml(stLabel)}</span></td>
      <td class="short-note">${escaparHtml(a.observacao?.trim().slice(0, 80) || '—')}</td>
    </tr>`;
  }).join('');

  const total = ags.filter(a => !['cancelado', 'faltou'].includes(a.status)).length;
  const confirmados = ags.filter(a => a.status === 'confirmado' || a.confirmado).length;
  const pendentes   = ags.filter(a => a.status === 'agendado' && !a.confirmado).length;
  const valores = ags
    .filter(a => !['cancelado', 'faltou'].includes(a.status))
    .map(a => typeof a.valor === 'string' ? Number(a.valor.replace(',', '.')) : Number(a.valor))
    .filter(v => Number.isFinite(v) && v > 0);
  const receitaPrevista = valores.length
    ? valores.reduce((totalValor, valor) => totalValor + valor, 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
    : null;
  const oportunidades = ags.filter(a => ['reagendar', 'faltou'].includes(a.status)).length;
  const observacoes = [
    confirmados > 0 ? `${confirmados} cliente${confirmados !== 1 ? 's confirmaram' : ' confirmou'} o compromisso.` : null,
    pendentes > 0 ? `${pendentes} cliente${pendentes !== 1 ? 's ainda não confirmaram' : ' ainda não confirmou'} presença.` : null,
    ...ags.filter(a => a.status === 'reagendar').slice(0, 3).map(a => `${escaparHtml(a.paciente_nome)} solicitou reagendamento.`),
  ].filter(Boolean) as string[];

  const now = new Date();

  const cabecalho = `<header class="hdr">
    <div class="hdr-l">
      <div class="op-logo"><span class="op-mark">O</span>OrganizaPro</div>
      <div class="brand-divider"></div>${logo}
      <div><div class="brand">${escaparHtml(nomeEmpresa)}</div><div class="emp">Relatório Executivo do Dia</div></div>
    </div>
    <div class="hdr-r"><div class="rtitle">Agenda de hoje</div><div class="rdate">${dataFmt}</div><div class="meta">Gerado às ${now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}${responsavel ? `<br>Responsável: ${escaparHtml(responsavel)}` : ''}</div></div>
  </header>`;

  const tabela = agendaOrdenada.length === 0
    ? `<div class="empty"><div class="empty-icon">✓</div><strong>Agenda livre para hoje.</strong><p>Nenhum compromisso pendente — pronta para novos agendamentos.</p></div>`
    : `<table><thead><tr><th>Horário</th><th>Cliente</th><th>Assunto</th><th>Status</th><th>Observação</th></tr></thead><tbody>${linhas}</tbody></table>`;

  const resumo = `<div class="section-title">Resumo executivo</div><div class="summary">
    <div class="si">Compromissos agendados<strong>${total}</strong></div>
    <div class="si">Confirmações pendentes<strong>${pendentes}</strong></div>
    <div class="si">Oportunidades a recuperar<strong>${oportunidades}</strong></div>
    <div class="si">Horários livres<strong>${horariosVagos.length}</strong></div>
    <div class="si">Receita prevista<strong>${receitaPrevista || '—'}</strong></div>
  </div>`;

  const complementos = `${horariosVagos.length ? `<div class="vacant"><div class="vacant-title">Horários disponíveis · ${horariosVagos.length}</div><div class="vacant-list">${horariosVagos.map(h => `<span class="vacant-slot">${h}</span>`).join('')}</div></div>` : ''}
    ${observacoes.length ? `<div class="notes"><div class="section-title">Observações importantes</div>${observacoes.map(o => `<div class="note"><span class="check">✓</span>${o}</div>`).join('')}</div>` : ''}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Executivo do Dia — ${escaparHtml(nomeEmpresa)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#17212b;background:#eef2f4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;min-height:297mm;margin:12px auto;padding:13mm 13mm 15mm;background:#fff;display:flex;flex-direction:column}
.page main{flex:1}
.hdr{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:25px;border-bottom:1px solid #dce4e8;margin-bottom:28px}
.hdr-l{display:flex;align-items:center;gap:16px}
.op-logo{display:flex;align-items:center;gap:7px;color:#183b49;font-size:12px;font-weight:800;letter-spacing:-.2px}.op-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#183b49;color:#fff;font-size:15px}.brand-divider{width:1px;height:45px;background:#dce4e8}
.brand{font-size:22px;font-weight:750;color:#183b49;letter-spacing:-0.5px}
.emp{font-size:12px;color:#64748b;margin-top:4px}
.hdr-r{text-align:right}
.rtitle{font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.rdate{font-size:20px;font-weight:700;color:#1F4E5F;margin-top:4px}
.meta{margin-top:7px;font-size:10px;color:#7b8b96;line-height:1.55}
.section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#5f707b;margin:0 0 12px}
.summary{margin-bottom:24px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.si{min-height:72px;padding:12px;border:1px solid #e2e8ec;border-radius:10px;background:#fbfcfd;font-size:8.5px;color:#74838d;text-transform:uppercase;letter-spacing:.45px}
.si strong{display:block;margin-top:8px;color:#173947;font-size:17px;letter-spacing:-.4px;text-transform:none;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
thead tr{background:#183b49;color:white}
thead th{padding:11px 12px;text-align:left;font-weight:650;font-size:9px;text-transform:uppercase;letter-spacing:.8px}
tbody tr:nth-child(even){background:#fafcfd}
tbody tr{border-bottom:1px solid #e2e8f0}
tbody td{padding:11px 12px;color:#334155;vertical-align:middle}
.short-note{max-width:160px;color:#687782;font-size:10px;overflow-wrap:anywhere}
.status{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;white-space:nowrap}.status i{width:7px;height:7px;border-radius:50%;background:#94a3b8}
.status-confirmado{color:#16834a}.status-confirmado i{background:#22a861}.status-agendado{color:#a66b09}.status-agendado i{background:#e5a52c}
.status-cancelado,.status-faltou{color:#b83b3b}.status-cancelado i,.status-faltou i{background:#d95050}
.status-reagendar,.status-vencido{color:#bd650c}.status-reagendar i,.status-vencido i{background:#ee8a2d}.status-concluido{color:#28778a}.status-concluido i{background:#4a9bb0}
.vacant{margin-top:25px;padding:18px 20px;border:1px solid #e7dfca;border-radius:10px;background:#fffdf8}
.vacant-title{font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px}
.vacant-list{display:flex;gap:7px;flex-wrap:wrap}
.vacant-slot{padding:5px 9px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700}
.empty{text-align:center;padding:30px 24px;border:1px solid #e2e8ec;border-radius:12px;background:#fbfcfd}.empty-icon{display:grid;place-items:center;width:38px;height:38px;margin:0 auto 12px;border-radius:50%;background:#edf5f2;color:#237455;font-weight:800}.empty strong{display:block;color:#173947;font-size:16px}.empty p{margin-top:7px;color:#6b7b86;font-size:12px}
.notes{margin-top:25px;padding:18px 20px;border:1px solid #e2e8ec;border-radius:10px}.note{font-size:12px;color:#42525d;margin:8px 0}.check{color:#29915a;font-weight:800;margin-right:8px}
.footer{margin-top:30px;padding-top:18px;border-top:1px solid #e2e8f0;text-align:center}
.f-contacts{font-size:11px;color:#5c6773;font-weight:600;margin-bottom:8px}
.f-gen{font-size:10px;color:#7e8c95}
.print-help{max-width:940px;margin:18px auto 0;padding:11px 14px;border-radius:8px;background:#fff7df;color:#785b13;font:12px/1.4 "Segoe UI",Arial,sans-serif;text-align:center}
@media screen and (max-width:850px){.page{width:100%;min-height:auto;margin:0;padding:24px 18px}.hdr{gap:14px;flex-direction:column}.hdr-l{width:100%;flex-wrap:wrap;gap:12px}.hdr-r{text-align:left}.hdr-r .meta{display:none}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.brand-divider{display:none}thead th,tbody td{padding:9px 7px;overflow-wrap:anywhere}.status{gap:3px;white-space:normal;font-size:8px}.vacant-slot{flex:0 0 auto}.f-contacts{display:none}}
@media print{body{background:#fff}.print-help{display:none}.page{margin:0;width:210mm;min-height:297mm;box-shadow:none}@page{size:A4;margin:1.25cm}}
</style>
</head>
<body>
<section class="page">
  ${cabecalho}
  <main>${resumo}<div class="section-title">Agenda cronológica</div>${tabela}${complementos}</main>
  <footer class="footer">${rodape ? `<div class="f-contacts">${rodape}</div>` : ''}<div class="f-gen">Relatório gerado automaticamente pelo OrganizaPro</div></footer>
</section>
<div class="print-help">Ao salvar como PDF no Chrome, escolha A4 e desmarque “Cabeçalhos e rodapés” para remover URL, data e título automáticos do navegador.</div>
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
  const salvandoRef = useRef(false); // trava síncrona de submissão — ver salvar()
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
    // Trava síncrona (ref, não state) — bloqueia cliques/Enter repetidos mesmo
    // antes do primeiro re-render. Ver docs/kensa-premium-dashboard-relatorio.md, K-03.
    if (salvandoRef.current) return;
    salvandoRef.current = true;
    try {
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
    } finally {
      salvandoRef.current = false;
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || !clinicaId) throw new Error('Clínica autenticada não identificada.');

      const { data: cfg, error: configError } = await supabase
        .from('clinica_config')
        .select('nome_clinica,telefone,email,endereco,logo_url,horario_funcionamento')
        .eq('clinica_id', clinicaId)
        .maybeSingle();
      if (configError) throw configError;

      const hojeLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const agHoje = agendamentos
        .filter(a => a.data === hojeLocal)
        .sort((a, b) => a.hora.localeCompare(b.hora));

      const responsavel = user?.user_metadata?.full_name
        || user?.user_metadata?.name
        || undefined;
      const html = buildPdfHtml(agHoje, cfg, hojeLocal, responsavel);
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 800);
    } catch (e) {
      win.close();
      console.error('Erro ao gerar PDF:', e);
      setErro('Não foi possível gerar o relatório com segurança. Tente novamente.');
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
      <div style={{ display:'flex', gap:10, marginBottom:8, flexWrap:'wrap', alignItems:'stretch' }}>
        <input
          style={{ flex:'1 1 240px', minWidth:0, padding:'10px 14px', borderRadius:8, border:'1px solid #2d3148', background:'#1e2130', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }}
          placeholder="Buscar por cliente ou telefone..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <button
          className="ag-btn-pdf"
          onClick={gerarPDF}
          disabled={gerandoPdf}
          style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, flex:'0 0 auto', padding:'10px 16px', borderRadius:8, border:'1px solid rgba(31,78,95,0.4)', background:'rgba(31,78,95,0.12)', color:'#4a9bb0', fontSize:13, fontWeight:600, cursor: gerandoPdf ? 'default' : 'pointer', whiteSpace:'nowrap', opacity: gerandoPdf ? 0.7 : 1, transition:'background 0.15s' }}
        >
          {gerandoPdf ? <LoaderCircle size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
          {gerandoPdf ? 'Gerando...' : 'Relatório do Dia'}
        </button>
      </div>
      <p style={{ margin:'0 0 12px', color:'#64748b', fontSize:11 }}>
        Ao salvar em PDF, selecione A4 e desmarque “Cabeçalhos e rodapés” no Chrome.
      </p>

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
