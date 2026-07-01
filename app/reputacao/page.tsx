'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminShell from '../components/AdminShell'

interface Avaliacao {
  id: string
  clinica_id: string
  agendamento_id: string
  paciente_nome: string
  telefone: string
  enviado_em: string
  respondeu: boolean
}

interface Resumo {
  total: number
  recebidas: number
  pendentes: number
  taxa: number
}

export default function ReputacaoPage() {
  const router = useRouter()
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [resumo, setResumo] = useState<Resumo>({ total: 0, recebidas: 0, pendentes: 0, taxa: 0 })
  const [carregando, setCarregando] = useState(true)
  const [clinicaId, setClinicaId] = useState<string | null>(null)

  async function carregarDados(cid: string) {
    setCarregando(true)
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('id, clinica_id, agendamento_id, paciente_nome, telefone, enviado_em, respondeu')
      .eq('clinica_id', cid)
      .order('enviado_em', { ascending: false })

    if (!error && data) {
      setAvaliacoes(data)
      const total = data.length
      const recebidas = data.filter(a => a.respondeu).length
      const pendentes = total - recebidas
      const taxa = total > 0 ? Math.round((recebidas / total) * 100) : 0
      setResumo({ total, recebidas, pendentes, taxa })
    }
    setCarregando(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { router.push('/login'); return }

      const { data: cu } = await supabase
        .from('clinica_usuarios')
        .select('clinica_id')
        .eq('usuario_id', user.id)
        .maybeSingle()

      if (cu?.clinica_id) {
        setClinicaId(cu.clinica_id)
        await carregarDados(cu.clinica_id)
      }
    }
    init()
  }, [])

  function formatarData(iso: string) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatarTelefone(tel: string) {
    if (!tel) return '—'
    const d = tel.replace(/\D/g, '')
    if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
    return tel
  }

  const card: React.CSSProperties = {
    background: '#1e2130',
    borderRadius: 12,
    border: '1px solid #2d3148',
    padding: '20px 24px',
  }

  const cards = [
    { label: 'Avaliações Solicitadas', valor: resumo.total,    cor: '#fbbf24', icon: '⭐' },
    { label: 'Responderam',            valor: resumo.recebidas, cor: '#4ade80', icon: '✅' },
    { label: 'Pendentes',              valor: resumo.pendentes, cor: '#fb923c', icon: '⏳' },
    { label: 'Taxa de Resposta',       valor: `${resumo.taxa}%`, cor: '#7c3aed', icon: '📊' },
  ]

  return (
    <AdminShell title="Reputação" subtitle="Avaliações enviadas e respondidas pelos pacientes">
      <div style={{ maxWidth: 1100 }}>

        {/* Cards de métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
          {cards.map(c => (
            <div key={c.label} style={card}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>{c.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <span style={{ fontSize: 30, fontWeight: 700, color: c.cor }}>
                  {carregando ? '—' : c.valor}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Tabela de histórico */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2d3148', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Histórico de Avaliações</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{resumo.total} registro{resumo.total !== 1 ? 's' : ''}</div>
          </div>

          {carregando ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>Carregando...</div>
          ) : avaliacoes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhuma avaliação enviada ainda</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>As avaliações aparecem aqui após o envio automático via WhatsApp</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#161827' }}>
                    {['Paciente', 'Telefone', 'Enviado em', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #2d3148', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {avaliacoes.map(a => (
                    <tr key={a.id}>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>
                        {a.paciente_nome || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 13, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                        {formatarTelefone(a.telefone)}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatarData(a.enviado_em)}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: a.respondeu ? '#16a34a22' : '#1e2130',
                          color:      a.respondeu ? '#4ade80'   : '#475569',
                          border:     a.respondeu ? 'none'      : '1px solid #2d3148',
                        }}>
                          {a.respondeu ? '✅ Respondeu' : '⏳ Aguardando'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Botão atualizar */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => clinicaId && carregarDados(clinicaId)}
            disabled={carregando}
            style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer', opacity: carregando ? 0.5 : 1 }}
          >
            {carregando ? 'Atualizando...' : '🔄 Atualizar'}
          </button>
        </div>

      </div>
    </AdminShell>
  )
}