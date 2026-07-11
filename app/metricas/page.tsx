'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../components/AdminShell'
import PageLoader from '../components/PageLoader'
import EmptyState from '../components/EmptyState'
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback'
import { supabase } from '../../lib/supabase'

export default function Metricas() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")
  const [dados, setDados] = useState({
    totalPacientes: 0,
    totalAgendamentos: 0,
    confirmados: 0,
    concluidos: 0,
    cancelados: 0,
    pendentes: 0,
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    try {
      setErro("")
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) { router.push('/login'); return }
      
      const { data: cu, error: cuError } = await supabase.from('clinica_usuarios').select('clinica_id').eq('usuario_id', user.id).maybeSingle()
      if (cuError) {
        console.error("Erro ao buscar clinica_usuarios:", cuError)
        // Não quebrar métricas por erro de clinica_usuarios
      }
      if (!cu?.clinica_id) {
        // Carregar métricas vazias mesmo sem clínica
        setDados({ totalPacientes: 0, totalAgendamentos: 0, confirmados: 0, concluidos: 0, cancelados: 0, pendentes: 0 })
        setLoading(false)
        return
      }

      const clinicaId = cu.clinica_id
      
      const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

      const [
        { count: totalPacientes, error: pacError },
        { data: agData,          error: agError  },
      ] = await Promise.all([
        supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('clinica_id', clinicaId),
        supabase.from('agendamentos').select('id, status, data').eq('clinica_id', clinicaId),
      ])

      if (pacError) throw new Error(`Erro ao carregar pacientes: ${pacError.message}`)
      if (agError)  throw new Error(`Erro ao carregar agendamentos: ${agError.message}`)

      const ags = agData || []
      // agendado com data passada = vencido → entra em cancelados para fechar a soma
      const totalAgendamentos = ags.length
      const confirmados = ags.filter(a => a.status === 'confirmado').length
      const concluidos  = ags.filter(a => a.status === 'concluido').length
      const cancelados  = ags.filter(a =>
        a.status === 'cancelado' ||
        a.status === 'faltou' ||
        (a.status === 'agendado' && a.data < hoje)
      ).length
      const pendentes   = ags.filter(a =>
        (a.status === 'agendado' && a.data >= hoje) ||
        a.status === 'reagendar'
      ).length

      setDados({
        totalPacientes:    totalPacientes || 0,
        totalAgendamentos,
        confirmados,
        concluidos,
        cancelados,
        pendentes,
      })
    } catch (err: unknown) {
      console.error("Erro ao carregar métricas:", err)
      setErro(MSG_ERRO_PADRAO)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <AdminShell title="Métricas" subtitle="Visão geral do seu negócio">
      <PageLoader title="Carregando métricas..." />
    </AdminShell>
  )

  return (
    <AdminShell title="Métricas" subtitle="Visão geral do seu negócio">
      {erro && (
        <Feedback type="erro" message={erro} onClose={() => setErro('')} />
      )}
      {!erro && dados.totalPacientes === 0 && dados.totalAgendamentos === 0 ? (
        <EmptyState
          icon="📊"
          title="Ainda não há dados suficientes para gerar métricas."
          description="Cadastre clientes e compromissos para ver o desempenho do seu negócio aqui."
          actionLabel="➕ Cadastrar cliente"
          onAction={() => router.push('/clientes')}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {[
            { label: 'Total de Clientes', value: dados.totalPacientes, color: '#00e5b4' },
            { label: 'Total Agendamentos', value: dados.totalAgendamentos, color: '#6366f1' },
            { label: 'Confirmados', value: dados.confirmados, color: '#22c55e' },
            { label: 'Pendentes',   value: dados.pendentes,  color: '#f59e0b' },
            { label: 'Concluídos', value: dados.concluidos, color: '#7c3aed' },
            { label: 'Cancelados', value: dados.cancelados, color: '#ef4444' },
          ].map((card) => (
            <div key={card.label} className="panel">
              <div style={{ color: card.color, fontSize: 36, fontWeight: 700, margin: '8px 0' }}>{card.value}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
