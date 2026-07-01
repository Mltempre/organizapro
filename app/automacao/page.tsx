'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';

interface WhatsappLog {
  id: string;
  clinica_id: string;
  telefone: string;
  mensagem: string;
  status: string;
  created_at: string;
}

interface Avaliacao {
  id: string;
  clinica_id: string;
  paciente_nome: string;
  telefone: string;
  enviado_em: string;
  respondeu: boolean;
}

interface ConfirmacaoItem {
  id: string;
  paciente_nome: string;
  telefone: string;
  data: string;
  hora: string;
  confirmado: boolean;
  precisa_reagendar: boolean;
  respondido_em: string | null;
  resposta_confirmacao: string | null;
}

export default function AutomacaoPage() {
  const router = useRouter();
  const [logs, setLogs]                     = useState<WhatsappLog[]>([]);
  const [avaliacoes, setAvaliacoes]         = useState<Avaliacao[]>([]);
  const [confirmacoes, setConfirmacoes]     = useState<ConfirmacaoItem[]>([]);
  const [, setClinicaId]                    = useState('');
  const [carregando, setCarregando]         = useState(true);
  const [erro, setErro]                     = useState('');
  const [abaSelecionada, setAba]            = useState<'whatsapp' | 'avaliacoes' | 'confirmacoes'>('whatsapp');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [busca, setBusca]                   = useState('');
  const [filtroPeriodo, setFiltroPeriodo]   = useState<'hoje' | '7' | '30' | 'todos'>('todos');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro('');

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push('/login'); return; }

      const { data: cu } = await supabase
        .from('clinica_usuarios')
        .select('clinica_id')
        .eq('usuario_id', user.id)
        .maybeSingle();

      const cId = cu?.clinica_id || '';
      setClinicaId(cId);
      if (!cId) { setCarregando(false); return; }

      const [
        { data: logsData,  error: logsErro  },
        { data: avData,    error: avErro    },
        { data: confData,  error: confErro  },
      ] = await Promise.all([
        supabase
          .from('whatsapp_logs')
          .select('*')
          .eq('clinica_id', cId)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('avaliacoes')
          .select('*')
          .eq('clinica_id', cId)
          .order('enviado_em', { ascending: false })
          .limit(100),
        supabase
          .from('agendamentos')
          .select('id, paciente_nome, telefone, data, hora, confirmado, precisa_reagendar, respondido_em, resposta_confirmacao')
          .eq('clinica_id', cId)
          .eq('confirmacao_enviada', true)
          .order('data', { ascending: false })
          .limit(100),
      ]);

      if (logsErro || avErro || confErro) {
        const msg = [
          logsErro  && `whatsapp_logs: ${logsErro.message}`,
          avErro    && `avaliacoes: ${avErro.message}`,
          confErro  && `agendamentos: ${confErro.message}`,
        ].filter(Boolean).join(' | ');
        setErro(msg);
      }

      setLogs(logsData     || []);
      setAvaliacoes(avData || []);
      setConfirmacoes(confData || []);
      setUltimaAtualizacao(new Date());

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function formatarDataHora(iso: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatarHora(d: Date): string {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function truncar(texto: string, max = 60): string {
    if (!texto) return '-';
    return texto.length > max ? texto.substring(0, max) + '...' : texto;
  }

  // ── Filtros client-side ───────────────────────────────────────────────────
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const cutoff: Date | null = (() => {
    if (filtroPeriodo === 'hoje') {
      const d = new Date(); d.setHours(0, 0, 0, 0); return d;
    }
    if (filtroPeriodo === '7')  return new Date(Date.now() - 7  * 86400000);
    if (filtroPeriodo === '30') return new Date(Date.now() - 30 * 86400000);
    return null;
  })();

  const buscaLower = busca.toLowerCase().trim();

  const logsFiltrados = logs
    .filter(l => !cutoff || new Date(l.created_at) >= cutoff)
    .filter(l => !buscaLower ||
      l.telefone?.includes(buscaLower) ||
      l.mensagem?.toLowerCase().includes(buscaLower)
    );

  const avFiltradas = avaliacoes.filter(a =>
    !buscaLower ||
    (a.paciente_nome || '').toLowerCase().includes(buscaLower) ||
    a.telefone?.includes(buscaLower)
  );

  const confFiltradas = confirmacoes.filter(c =>
    !buscaLower ||
    (c.paciente_nome || '').toLowerCase().includes(buscaLower) ||
    c.telefone?.includes(buscaLower)
  );

  // ── Métricas (sempre sobre dados completos) ──────────────────────────────
  const totalEnviados    = logs.filter(l => l.status === 'enviado').length;
  const totalErros       = logs.filter(l => l.status === 'erro').length;
  const totalAvaliacoes  = avaliacoes.length;
  const totalRespondeu   = avaliacoes.filter(a => a.respondeu).length;
  const totalConfirmados = confirmacoes.filter(c => c.confirmado).length;
  const totalReagendar   = confirmacoes.filter(c => c.precisa_reagendar).length;

  const card: React.CSSProperties = {
    background: '#1e2130', borderRadius: 12,
    border: '1px solid #2d3148', padding: '20px 24px',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '11px 16px', fontSize: 11,
    fontWeight: 600, color: '#64748b', textTransform: 'uppercase',
    borderBottom: '1px solid #2d3148', letterSpacing: '0.05em', whiteSpace: 'nowrap',
  };

  return (
    <AdminShell title="WhatsApp" subtitle="Historico de automacoes e envios">
      <div style={{ maxWidth: 1100 }}>

        {erro && (
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#fca5a5', fontSize: 13 }}>
            {erro}
          </div>
        )}

        {/* Cards de métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Mensagens Enviadas',    valor: totalEnviados,    cor: '#4ade80', icon: '✅' },
            { label: 'Erros de Envio',        valor: totalErros,       cor: '#f87171', icon: '❌' },
            { label: 'Avaliacoes Enviadas',   valor: totalAvaliacoes,  cor: '#fbbf24', icon: '⭐' },
            { label: 'Avaliacoes Recebidas',  valor: totalRespondeu,   cor: '#7c3aed', icon: '🏆' },
            { label: 'Consultas Confirmadas', valor: totalConfirmados, cor: '#38bdf8', icon: '📅' },
            { label: 'Aguard. Reagendamento', valor: totalReagendar,   cor: '#fb923c', icon: '⚠️' },
          ].map(c => (
            <div key={c.label} style={card}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>{c.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <span style={{ fontSize: 30, fontWeight: 700, color: c.cor }}>{c.valor}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Barra de busca + botão atualizar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por paciente ou telefone..."
            style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid #2d3148', background: '#1e2130', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {ultimaAtualizacao && !carregando && (
              <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
                Atualizado às {formatarHora(ultimaAtualizacao)}
              </span>
            )}
            <button
              onClick={carregar}
              disabled={carregando}
              style={{
                padding: '9px 16px', borderRadius: 8, border: '1px solid #2d3148',
                background: carregando ? 'rgba(124,58,237,0.1)' : 'transparent',
                color: carregando ? '#a78bfa' : '#94a3b8',
                fontSize: 13, cursor: carregando ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              <span style={{ display: 'inline-block', animation: carregando ? 'spin 0.8s linear infinite' : 'none' }}>🔄</span>
              {carregando ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#1e2130', borderRadius: 10, padding: 4, border: '1px solid #2d3148', width: 'fit-content' }}>
          {([
            { key: 'whatsapp',     label: '💬 Mensagens' },
            { key: 'avaliacoes',   label: '⭐ Avaliações' },
            { key: 'confirmacoes', label: '📅 Confirmações' },
          ] as const).map(aba => (
            <button
              key={aba.key}
              onClick={() => setAba(aba.key)}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: abaSelecionada === aba.key ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'transparent',
                color: abaSelecionada === aba.key ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {aba.label}
            </button>
          ))}
        </div>

        {/* Filtro por período — só na aba WhatsApp */}
        {abaSelecionada === 'whatsapp' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#475569', marginRight: 4 }}>Período:</span>
            {([
              { key: 'hoje', label: 'Hoje'    },
              { key: '7',    label: '7 dias'  },
              { key: '30',   label: '30 dias' },
              { key: 'todos',label: 'Todos'   },
            ] as const).map(({ key, label }) => {
              const ativo = filtroPeriodo === key;
              return (
                <button
                  key={key}
                  onClick={() => setFiltroPeriodo(key)}
                  style={{
                    padding: '4px 12px', borderRadius: 20,
                    border: `1px solid ${ativo ? '#7c3aed' : '#2d3148'}`,
                    background: ativo ? 'rgba(124,58,237,0.15)' : 'transparent',
                    color: ativo ? '#a78bfa' : '#64748b',
                    fontSize: 12, fontWeight: ativo ? 600 : 400, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Tabela WhatsApp Logs ── */}
        {abaSelecionada === 'whatsapp' && (
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #2d3148', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Histórico de Mensagens</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{logsFiltrados.length} registro{logsFiltrados.length !== 1 ? 's' : ''}</div>
            </div>

            {carregando ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>Carregando...</div>
            ) : logsFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {busca || filtroPeriodo !== 'todos' ? 'Nenhum resultado para este filtro' : 'Nenhuma mensagem enviada ainda'}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Os envios automáticos aparecerão aqui</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#161827' }}>
                      {['Status', 'Telefone', 'Mensagem', 'Data e Hora'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logsFiltrados.map(log => (
                      <tr key={log.id}>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: log.status === 'enviado' ? '#16a34a22' : '#dc262622',
                            color:      log.status === 'enviado' ? '#4ade80'   : '#f87171',
                          }}>
                            {log.status === 'enviado' ? '✅' : '❌'} {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 13, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                          {log.telefone || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 12, color: '#64748b', maxWidth: 320 }}>
                          {truncar(log.mensagem)}
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {formatarDataHora(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tabela Avaliações ── */}
        {abaSelecionada === 'avaliacoes' && (
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #2d3148', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Avaliações Solicitadas</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{avFiltradas.length} registro{avFiltradas.length !== 1 ? 's' : ''}</div>
            </div>

            {carregando ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>Carregando...</div>
            ) : avFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {busca ? 'Nenhum resultado para esta busca' : 'Nenhuma avaliação solicitada ainda'}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Marque uma consulta como concluída para disparar o pedido</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#161827' }}>
                      {['Paciente', 'Telefone', 'Enviado em', 'Respondeu'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {avFiltradas.map(av => (
                      <tr key={av.id}>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>
                          {av.paciente_nome || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 13, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                          {av.telefone || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {formatarDataHora(av.enviado_em)}
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: av.respondeu ? '#16a34a22' : '#1e2130',
                            color:      av.respondeu ? '#4ade80'   : '#475569',
                            border:     av.respondeu ? 'none'      : '1px solid #2d3148',
                          }}>
                            {av.respondeu ? '✅ Sim' : '⏳ Aguardando'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tabela Confirmações ── */}
        {abaSelecionada === 'confirmacoes' && (
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #2d3148', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Confirmações de Consulta</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{confFiltradas.length} registro{confFiltradas.length !== 1 ? 's' : ''}</div>
            </div>

            {carregando ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>Carregando...</div>
            ) : confFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {busca ? 'Nenhum resultado para esta busca' : 'Nenhuma confirmação enviada ainda'}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>As respostas dos pacientes aparecerão aqui</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#161827' }}>
                      {['Paciente', 'Data', 'Hora', 'Status', 'Resposta', 'Respondido em'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {confFiltradas.map(c => {
                      const st = c.confirmado
                        ? { label: '✅ Confirmado', bg: '#16a34a22', cor: '#4ade80'  }
                        : c.precisa_reagendar
                        ? { label: '⚠️ Reagendar',  bg: '#ea580c22', cor: '#fb923c' }
                        : { label: '⏳ Aguardando',  bg: '#1e2130',   cor: '#475569' };
                      const dataFmt = c.data ? c.data.split('-').reverse().join('/') : '-';
                      return (
                        <tr key={c.id}>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>{c.paciente_nome || '-'}</td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 13, color: '#cbd5e1', whiteSpace: 'nowrap' }}>{dataFmt}</td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 13, color: '#cbd5e1', whiteSpace: 'nowrap' }}>{c.hora || '-'}</td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                              background: st.bg, color: st.cor,
                              border: c.confirmado || c.precisa_reagendar ? 'none' : '1px solid #2d3148',
                            }}>
                              {st.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 12, color: '#64748b', maxWidth: 220 }}>
                            {truncar(c.resposta_confirmacao || '-', 50)}
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                            {formatarDataHora(c.respondido_em || '')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>

      </div>
    </AdminShell>
  );
}
