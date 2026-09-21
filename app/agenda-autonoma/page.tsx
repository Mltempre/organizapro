'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { gerarCasosAgendaAutonoma, type CasoAgendaAutonoma, type TipoCasoAgenda } from '../../lib/agenda-autonoma';

// ── Agenda Autônoma de Receita V1 · triagem operacional ──────────────────
// Os 3 sinais já existem e já funcionam (computados hoje dentro de
// app/dashboard/page.tsx, consumidos pelo Radar/Diretor) — esta tela só
// dá a eles uma superfície própria, clara, sem misturar com orçamento/
// cobrança/tratamento/pedido. Mesmas consultas reais já usadas pelo
// Dashboard (mesmos filtros de status/data) — nenhuma consulta nova,
// nenhum motor novo. Toda ação real (reagendar, criar compromisso) só
// acontece em /agendamentos — a única exceção é "confirmar", uma
// atualização estritamente escopada (id + clinica_id + status=agendado)
// que nunca toca nos demais campos do agendamento nem em pacientes.

type AgendaRow = { id: string; paciente_nome: string; telefone: string | null; status: string; data: string };
type ClienteRow = { id: string; nome: string; telefone: string | null; whatsapp: string | null; proxima_consulta: string | null };

const TIPO_LABELS: Record<TipoCasoAgenda, { label: string; icon: string }> = {
  cancelamento_sem_reagendamento: { label: 'Cancelou e não reagendou', icon: '🔁' },
  confirmacao_pendente:           { label: 'Confirmação pendente',     icon: '⏳' },
  sem_proximo_compromisso:        { label: 'Sem próximo compromisso',  icon: '📆' },
};

function hojeStr() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }
function trintaDiasAtrasStr() {
  const [ano, mes, dia] = hojeStr().split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia - 30)).toISOString().split('T')[0];
}

export default function AgendaAutonomaPage() {
  const router = useRouter();
  const [casos, setCasos] = useState<CasoAgendaAutonoma[]>([]);
  const [clinicaId, setClinicaId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [filtro, setFiltro] = useState<'todos' | TipoCasoAgenda>('todos');
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }

      const cuRes = await fetch('/api/minha-clinica', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      setClinicaId(cid || '');
      if (!cid) { setCasos([]); setCarregando(false); return; }

      const hoje = hojeStr();
      const trintaDiasAtras = trintaDiasAtrasStr();

      // Mesmas 3 consultas reais já usadas por app/dashboard/page.tsx —
      // nenhuma consulta nova, nenhum filtro novo.
      const [{ data: agendaHojeData }, { data: canceladosRecentesData }, { data: clientesAtivosData }] = await Promise.all([
        supabase.from('agendamentos')
          .select('id, paciente_nome, telefone, status, data')
          .eq('clinica_id', cid).eq('data', hoje),
        supabase.from('agendamentos')
          .select('id, paciente_nome, telefone, data')
          .eq('clinica_id', cid).eq('status', 'cancelado')
          .gte('data', trintaDiasAtras)
          .order('data', { ascending: false }).limit(50),
        supabase.from('pacientes')
          .select('id, nome, telefone, whatsapp, proxima_consulta')
          .eq('clinica_id', cid).eq('status', 'ativo')
          .or(`proxima_consulta.is.null,proxima_consulta.lt.${hoje}`)
          .order('nome').limit(50),
      ]);

      const agendaHoje = (agendaHojeData ?? []) as AgendaRow[];
      const canceladosRecentes = ((canceladosRecentesData ?? []) as AgendaRow[]).filter(a => a.telefone);
      const clientesAtivos = (clientesAtivosData ?? []) as ClienteRow[];

      // Mesma lógica real já usada por app/dashboard/page.tsx: um
      // cancelamento só é caso aberto se o telefone não tiver nenhum
      // agendamento futuro ainda ativo.
      const telefonesCancelados = Array.from(new Set(canceladosRecentes.map(a => a.telefone as string)));
      let telefonesComReagendamentoFuturo = new Set<string>();
      if (telefonesCancelados.length > 0) {
        const { data: futuros } = await supabase
          .from('agendamentos')
          .select('telefone')
          .eq('clinica_id', cid)
          .in('telefone', telefonesCancelados)
          .gte('data', hoje)
          .not('status', 'in', '("cancelado","faltou")');
        telefonesComReagendamentoFuturo = new Set((futuros ?? []).map(f => f.telefone as string));
      }

      const lista = gerarCasosAgendaAutonoma({
        hoje,
        cancelamentosRecentes: canceladosRecentes.map(a => ({ id: a.id, nome: a.paciente_nome, telefone: a.telefone as string, data: a.data })),
        telefonesComReagendamentoFuturo,
        agendaHoje: agendaHoje.map(a => ({ id: a.id, nome: a.paciente_nome, telefone: a.telefone, status: a.status })),
        clientesAtivos: clientesAtivos.map(c => ({ id: c.id, nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, proximaConsulta: c.proxima_consulta })),
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

  // Ação real e segura: só muda o status de "agendado" para "confirmado",
  // escopada por id + clinica_id + status atual (guarda otimista, mesmo
  // padrão de defesa em profundidade já usado em tratamentos/cobrancas) —
  // nunca toca em outros campos do agendamento nem em pacientes.
  async function confirmar(caso: CasoAgendaAutonoma) {
    if (!clinicaId) return;
    setConfirmando(caso.id);
    try {
      const { error, data } = await supabase
        .from('agendamentos')
        .update({ status: 'confirmado', confirmado: true })
        .eq('id', caso.id)
        .eq('clinica_id', clinicaId)
        .eq('status', 'agendado')
        .select('id');
      if (error) { setErro(MSG_ERRO_PADRAO); return; }
      if (!data || data.length === 0) {
        // Já não estava mais 'agendado' (confirmado por outra aba, ou o
        // status mudou) — nunca duplica a ação, só recarrega para refletir o estado real.
        carregar();
        return;
      }
      carregar();
      setSucesso('Compromisso confirmado.');
      setTimeout(() => setSucesso(''), 3500);
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setConfirmando(null);
    }
  }

  const filtrados = casos.filter(c => filtro === 'todos' || c.tipo === filtro);
  const contagemPorTipo = (['cancelamento_sem_reagendamento', 'confirmacao_pendente', 'sem_proximo_compromisso'] as TipoCasoAgenda[])
    .map(tipo => ({ tipo, total: casos.filter(c => c.tipo === tipo).length }));

  return (
    <AdminShell title="Agenda Autônoma" subtitle={`${filtrados.length} caso${filtrados.length !== 1 ? 's' : ''} precisando de atenção`}>
      {carregando && <PageLoader title="Consolidando a agenda..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}
      {!carregando && sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />}

      {!carregando && casos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltro('todos')} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
            border: `1px solid ${filtro === 'todos' ? '#1F4E5F' : '#2d3148'}`,
            background: filtro === 'todos' ? 'rgba(31,78,95,0.2)' : 'transparent',
            color: filtro === 'todos' ? '#4a9bb0' : '#64748b', fontWeight: filtro === 'todos' ? 600 : 400,
          }}>Todos ({casos.length})</button>
          {contagemPorTipo.filter(g => g.total > 0).map(g => {
            const info = TIPO_LABELS[g.tipo];
            const ativo = filtro === g.tipo;
            return (
              <button key={g.tipo} onClick={() => setFiltro(g.tipo)} style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                border: `1px solid ${ativo ? '#1F4E5F' : '#2d3148'}`,
                background: ativo ? 'rgba(31,78,95,0.2)' : 'transparent',
                color: ativo ? '#4a9bb0' : '#64748b', fontWeight: ativo ? 600 : 400, whiteSpace: 'nowrap',
              }}>{info.icon} {info.label} ({g.total})</button>
            );
          })}
        </div>
      )}

      {!carregando && casos.length === 0 && (
        <EmptyState icon="✅" title="Nenhum caso de agenda precisando de atenção agora." description="Nenhum cancelamento sem reagendamento, confirmação pendente ou cliente sem próximo compromisso identificado." />
      )}
      {!carregando && casos.length > 0 && filtrados.length === 0 && (
        <EmptyState compact icon="🔍" title="Nenhum caso neste filtro." actionLabel="Ver todos" onAction={() => setFiltro('todos')} />
      )}

      {!carregando && filtrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map(caso => {
            const info = TIPO_LABELS[caso.tipo];
            return (
              <div key={`${caso.tipo}-${caso.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: '#f1f5f9' }}>
                  <span style={{ marginRight: 6 }}>{info.icon}</span>
                  <strong>{caso.nome}</strong> — {caso.motivo}
                  <div style={{ fontSize: 12, marginTop: 4, color: '#4a9bb0' }}>➜ Próxima ação: {caso.proximaAcao}</div>
                </div>
                {caso.tipo === 'confirmacao_pendente' ? (
                  <button disabled={confirmando === caso.id} onClick={() => confirmar(caso)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {confirmando === caso.id ? 'Confirmando...' : 'Confirmar'}
                  </button>
                ) : (
                  <button onClick={() => router.push(caso.destino)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#4a9bb0', fontSize: 11, cursor: 'pointer' }}>Ver na Agenda →</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
