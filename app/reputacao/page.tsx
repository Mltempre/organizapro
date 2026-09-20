'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminShell from '../components/AdminShell'
import EmptyState from '../components/EmptyState'
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback'
import { rotuloRespondeu, taxaDeCliquePct } from '../../lib/motor-reputacao'
import { calcularPresencaDigital, type DiagnosticoPresenca } from '../../lib/presenca-digital'

interface Avaliacao {
  id: string
  clinica_id: string
  agendamento_id: string
  paciente_nome: string
  telefone: string
  enviado_em: string
  respondeu: boolean
  codigo: string | null
  clicado_em: string | null
}

interface Resumo {
  total: number
  recebidas: number
  pendentes: number
  taxa: number
  cliques: number
  taxaClique: number
}

export default function ReputacaoPage() {
  const router = useRouter()
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [resumo, setResumo] = useState<Resumo>({ total: 0, recebidas: 0, pendentes: 0, taxa: 0, cliques: 0, taxaClique: 0 })
  const [carregando, setCarregando] = useState(true)
  const [clinicaId, setClinicaId] = useState<string | null>(null)
  const [presenca, setPresenca] = useState<DiagnosticoPresenca | null>(null)
  const [erro, setErro] = useState('')

  // Presença Digital — completude de cadastro (lib/presenca-digital.ts),
  // nunca performance real no Google (não há integração/OAuth com a Google
  // Business Profile API nesta versão — ver diagnostico.observacaoIntegracao).
  async function carregarPresenca(cid: string) {
    const { data } = await supabase
      .from('clinica_config')
      .select('slug, link_google, nota_google, num_avaliacoes, telefone, endereco, horario_funcionamento, seo_titulo, seo_descricao')
      .eq('clinica_id', cid)
      .maybeSingle()
    setPresenca(calcularPresencaDigital({
      slug: data?.slug ?? null,
      linkGoogle: data?.link_google ?? null,
      notaGoogle: data?.nota_google ?? null,
      numAvaliacoes: data?.num_avaliacoes ?? null,
      telefone: data?.telefone ?? null,
      endereco: data?.endereco ?? null,
      horarioFuncionamento: data?.horario_funcionamento ?? null,
      seoTitulo: data?.seo_titulo ?? null,
      seoDescricao: data?.seo_descricao ?? null,
    }))
  }

  async function carregarDados(cid: string) {
    setCarregando(true); setErro('')
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('id, clinica_id, agendamento_id, paciente_nome, telefone, enviado_em, respondeu, codigo, clicado_em')
      .eq('clinica_id', cid)
      .order('enviado_em', { ascending: false })

    if (!error && data) {
      setAvaliacoes(data)
      const total = data.length
      const recebidas = data.filter(a => a.respondeu).length
      const pendentes = total - recebidas
      const taxa = total > 0 ? Math.round((recebidas / total) * 100) : 0
      // Cliques: único fato que o próprio sistema pode confirmar de verdade
      // (é ele quem serve o redirect em /r/[codigo]) — nunca "respondeu",
      // que ninguém confirma sem integração real com o Google.
      const cliques = data.filter(a => a.clicado_em !== null).length
      const taxaClique = taxaDeCliquePct(data.map(a => ({
        id: a.id, codigoRastreio: a.codigo ?? '', linkDestino: '', enviadoEm: a.enviado_em, clicadoEm: a.clicado_em,
      })))
      setResumo({ total, recebidas, pendentes, taxa, cliques, taxaClique })
    } else if (error) {
      console.error(error)
      setErro(MSG_ERRO_PADRAO)
    }
    setCarregando(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { router.push('/login'); return }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { router.push('/login'); return }
      const cuRes = await fetch('/api/minha-clinica', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined

      if (cid) {
        setClinicaId(cid)
        await Promise.all([carregarDados(cid), carregarPresenca(cid)])
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
    { label: 'Avaliações Recebidas',    valor: resumo.recebidas, cor: '#4ade80', icon: '✅' },
    { label: 'Avaliações Pendentes',    valor: resumo.pendentes, cor: '#fb923c', icon: '⏳' },
    { label: 'Taxa de Resposta',       valor: `${resumo.taxa}%`, cor: '#7c3aed', icon: '📊' },
    // Único dado que o próprio sistema confirma de verdade (é ele quem
    // serve o redirect em /r/[codigo]) — "respondeu" acima é uma marcação
    // sem verificação (ver lib/motor-reputacao.ts, rotuloRespondeu).
    { label: 'Cliques Confirmados',    valor: `${resumo.cliques} (${resumo.taxaClique}%)`, cor: '#38bdf8', icon: '🔗' },
  ]

  return (
    <AdminShell title="Reputação" subtitle="Avaliações enviadas e respondidas pelos clientes">
      <style>{`.rep-btn-atualizar:hover:not(:disabled) { background: rgba(148,163,184,0.08) !important; border-color: #3d4360 !important; }`}</style>
      <div style={{ maxWidth: 1100 }}>

        {erro && (
          <Feedback type="erro" message={erro} onClose={() => setErro('')} />
        )}

        {/* Presença Digital — completude de cadastro, NUNCA performance real
            no Google (sem OAuth/API do Google Business Profile nesta versão) */}
        {presenca && (
          <div style={{ background: '#1e2130', borderRadius: 12, border: '1px solid #2d3148', padding: '18px 22px', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>📍 Presença Digital — {presenca.pontuacao}% do cadastro completo</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Sem integração com o Google (nota/avaliações digitadas manualmente)</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {presenca.itens.map(item => (
                <span key={item.chave} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 20,
                  background: item.completo ? 'rgba(74,222,128,0.12)' : 'rgba(148,163,184,0.1)',
                  color: item.completo ? '#4ade80' : '#64748b',
                  border: item.completo ? 'none' : '1px solid #2d3148',
                }}>
                  {item.completo ? '✓' : '○'} {item.label}
                </span>
              ))}
            </div>
          </div>
        )}

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
            <EmptyState
              compact
              icon="⭐"
              title="Nenhuma avaliação registrada ainda"
              description="Assim que seus clientes responderem ao convite enviado pelo WhatsApp, todas as avaliações aparecerão automaticamente nesta tela."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#161827' }}>
                    {['Cliente', 'Telefone', 'Enviado em', 'Clique', 'Status'].map(h => (
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
                        {a.clicado_em ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#0ea5e922', color: '#38bdf8' }}>
                            🔗 Clicou em {formatarData(a.clicado_em)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#475569' }}>— sem clique</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e' }}>
                        {/* Rótulo honesto (lib/motor-reputacao.ts): `respondeu` nunca é
                            confirmado por nenhuma integração real — nunca dizemos "Respondeu". */}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: a.respondeu ? '#16a34a22' : '#1e2130',
                          color:      a.respondeu ? '#4ade80'   : '#475569',
                          border:     a.respondeu ? 'none'      : '1px solid #2d3148',
                        }}>
                          {a.respondeu ? `⚠️ ${rotuloRespondeu(a.respondeu)}` : '⏳ Aguardando'}
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
            className="rep-btn-atualizar"
            onClick={() => clinicaId && carregarDados(clinicaId)}
            disabled={carregando}
            style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer', opacity: carregando ? 0.5 : 1, transition: 'background 0.15s, border-color 0.15s' }}
          >
            {carregando ? 'Atualizando...' : '🔄 Atualizar Dados'}
          </button>
        </div>

      </div>
    </AdminShell>
  )
}