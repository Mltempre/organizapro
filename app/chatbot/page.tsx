'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminShell from '../components/AdminShell'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ChatbotConfig {
  id?: string; clinica_id?: string; nome_clinica?: string
  horario_funcionamento?: string; endereco?: string; convenios?: string
  procedimentos?: string; faq?: string; link_humano?: string; ativo?: boolean
}

interface ChatLog {
  id: string; telefone: string; nome_paciente?: string
  mensagem_paciente: string; resposta_bot: string
  processado_por: string; created_at: string
}

interface Treinamento {
  id: string; pergunta: string; resposta: string
  palavras_chave: string; ativo: boolean; created_at: string
}

interface TreinamentoForm {
  id?: string; pergunta: string; resposta: string; palavras_chave: string
}

const formVazio: TreinamentoForm = { pergunta: '', resposta: '', palavras_chave: '' }

// ─── Paleta ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#0f1117', card: '#1a1d2e', cardBorder: '#252840',
  purple: '#7c3aed', purpleLight: '#9f67ff', purpleDim: 'rgba(124,58,237,0.12)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,0.12)',
  red: '#f87171', redDim: 'rgba(248,113,113,0.1)',
  yellow: '#fbbf24',
  text: '#f1f5f9', textSub: '#94a3b8', textMuted: '#64748b',
  border: '#252840', inputBg: '#0d1017',
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', background: C.inputBg, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, fontSize: 13, padding: '11px 14px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const ta = (h = 90): React.CSSProperties => ({ ...inp, resize: 'vertical', minHeight: h, lineHeight: 1.6 })
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C.textSub, marginBottom: 6,
  display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase',
}
const cardBase: React.CSSProperties = {
  background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, overflow: 'hidden',
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={cardBase}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: C.textMuted, margin: '-3px 0 8px' }}>{hint}</p>}
      {children}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div style={{ ...cardBase, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: color ? `${color}18` : C.purpleDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: color ?? C.text, lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${color}18`, color, border: `1px solid ${color}33`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function processadoPorBadge(p: string) {
  if (p === 'treinamento') return <Badge label="Treinamento" color="#f59e0b" />
  if (p === 'regras')      return <Badge label="Regras" color={C.purpleLight} />
  return <Badge label="IA" color={C.green} />
}

// ─── Página ───────────────────────────────────────────────────────────────────

type Aba = 'historico' | 'config' | 'treinamento'

export default function ChatbotPage() {
  const router = useRouter()
  const [clinicaId, setClinicaId]   = useState<string | null>(null)
  const [aba, setAba]               = useState<Aba>('historico')
  const [logs, setLogs]             = useState<ChatLog[]>([])
  const [config, setConfig]         = useState<ChatbotConfig>({})
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando]     = useState(false)
  const [msg, setMsg]               = useState('')
  const [expandido, setExpandido]   = useState<string | null>(null)

  // form treinamento
  const [form, setForm]             = useState<TreinamentoForm>(formVazio)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [salvandoT, setSalvandoT]   = useState(false)
  const [msgT, setMsgT]             = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { router.push('/login'); return }
      const { data: cu } = await supabase
        .from('clinica_usuarios').select('clinica_id').eq('usuario_id', user.id).maybeSingle()
      if (cu?.clinica_id) {
        setClinicaId(cu.clinica_id)
        await Promise.all([
          carregarLogs(cu.clinica_id),
          carregarConfig(cu.clinica_id),
          carregarTreinamentos(cu.clinica_id),
        ])
      }
      setCarregando(false)
    }
    init()
  }, [])

  async function carregarLogs(cid: string) {
    const { data } = await supabase
      .from('chatbot_logs')
      .select('id,telefone,nome_paciente,mensagem_paciente,resposta_bot,processado_por,created_at')
      .eq('clinica_id', cid).order('created_at', { ascending: false }).limit(50)
    setLogs(data ?? [])
  }

  async function carregarConfig(cid: string) {
    const r = await fetch(`/api/chatbot/config?clinica_id=${cid}`)
    const j = await r.json()
    if (j.data) setConfig(j.data)
    else setConfig({ clinica_id: cid })
  }

  async function carregarTreinamentos(cid: string) {
    const r = await fetch(`/api/chatbot/treinamento?clinica_id=${cid}`)
    const j = await r.json()
    setTreinamentos(j.data ?? [])
  }

  async function salvarConfig() {
    if (!clinicaId) return
    setSalvando(true); setMsg('')
    try {
      const r = await fetch('/api/chatbot/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, clinica_id: clinicaId }),
      })
      const j = await r.json()
      if (j.sucesso) { setMsg('ok:Configuração salva com sucesso!'); setConfig(j.data) }
      else setMsg('erro:' + (j.error ?? 'Erro desconhecido'))
    } finally { setSalvando(false); setTimeout(() => setMsg(''), 4000) }
  }

  async function salvarTreinamento() {
    if (!clinicaId || !form.pergunta.trim() || !form.resposta.trim()) {
      setMsgT('erro:Pergunta e Resposta são obrigatórias')
      setTimeout(() => setMsgT(''), 3000)
      return
    }
    setSalvandoT(true); setMsgT('')
    try {
      const method = modoEdicao ? 'PUT' : 'POST'
      const payload = modoEdicao
        ? { id: form.id, pergunta: form.pergunta, resposta: form.resposta, palavras_chave: form.palavras_chave }
        : { clinica_id: clinicaId, pergunta: form.pergunta, resposta: form.resposta, palavras_chave: form.palavras_chave }
      const r = await fetch('/api/chatbot/treinamento', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (j.sucesso) {
        setMsgT('ok:' + (modoEdicao ? 'Treinamento atualizado!' : 'Treinamento salvo!'))
        setForm(formVazio); setModoEdicao(false)
        await carregarTreinamentos(clinicaId)
      } else {
        setMsgT('erro:' + (j.error ?? 'Erro desconhecido'))
      }
    } finally { setSalvandoT(false); setTimeout(() => setMsgT(''), 4000) }
  }

  async function toggleAtivo(t: Treinamento) {
    const r = await fetch('/api/chatbot/treinamento', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, ativo: !t.ativo }),
    })
    const j = await r.json()
    if (j.sucesso && clinicaId) await carregarTreinamentos(clinicaId)
  }

  async function excluirTreinamento(id: string) {
    if (!confirm('Excluir este treinamento?')) return
    const r = await fetch(`/api/chatbot/treinamento?id=${id}`, { method: 'DELETE' })
    const j = await r.json()
    if (j.sucesso && clinicaId) await carregarTreinamentos(clinicaId)
  }

  function editarTreinamento(t: Treinamento) {
    setForm({ id: t.id, pergunta: t.pergunta, resposta: t.resposta, palavras_chave: t.palavras_chave })
    setModoEdicao(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() { setForm(formVazio); setModoEdicao(false) }

  function formatarData(iso: string) {
    const d = new Date(iso), hoje = new Date(), ontem = new Date(hoje)
    ontem.setDate(ontem.getDate() - 1)
    const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === hoje.toDateString())  return `Hoje, ${h}`
    if (d.toDateString() === ontem.toDateString()) return `Ontem, ${h}`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ` · ${h}`
  }

  const msgTipo  = msg.startsWith('ok:') ? 'ok' : 'erro'
  const msgTexto = msg.replace(/^(ok|erro):/, '')
  const msgTTipo  = msgT.startsWith('ok:') ? 'ok' : 'erro'
  const msgTTexto = msgT.replace(/^(ok|erro):/, '')

  const abas: { id: Aba; label: string; icon: string }[] = [
    { id: 'historico',    label: 'Histórico',    icon: '💬' },
    { id: 'treinamento',  label: 'Treinamento',  icon: '🧠' },
    { id: 'config',       label: 'Configuração', icon: '⚙️' },
  ]

  return (
    <AdminShell title="Chatbot IA" subtitle="Configure respostas automáticas para dúvidas frequentes da clínica">
      <style>{`
        @media (max-width:640px){
          .cb-stats{flex-direction:column!important}
          .cb-grid2{grid-template-columns:1fr!important}
          .cb-log-card{flex-direction:column!important;gap:8px!important}
          .cb-log-meta{text-align:left!important;min-width:0!important}
        }
      `}</style>

      <div style={{ maxWidth: 900 }}>

        {/* Badge status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, background: config.ativo ? C.greenDim : 'rgba(100,116,139,0.1)', border: `1px solid ${config.ativo ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.2)'}` }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: config.ativo ? C.green : C.textMuted, boxShadow: config.ativo ? `0 0 6px ${C.green}` : 'none' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: config.ativo ? C.green : C.textMuted }}>
              {config.ativo ? 'Chatbot Ativo' : 'Chatbot Inativo'}
            </span>
          </div>
        </div>

        {/* Cards de estatísticas */}
        <div className="cb-stats" style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <StatCard icon={config.ativo ? '🟢' : '⭕'} label="Status" value={config.ativo ? 'Ativo' : 'Inativo'} color={config.ativo ? C.green : C.textMuted} />
          <StatCard icon="💬" label="Conversas" value={carregando ? '...' : logs.length} color={C.purpleLight} />
          <StatCard icon="🧠" label="Treinamentos" value={carregando ? '...' : treinamentos.filter(t => t.ativo).length} color="#f59e0b" />
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {abas.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)} style={{
              padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: aba === a.id ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : C.card,
              color: aba === a.id ? '#fff' : C.textMuted,
              boxShadow: aba === a.id ? '0 4px 14px rgba(124,58,237,0.3)' : 'none',
            }}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>

        {/* ══════════════ ABA: HISTÓRICO ══════════════ */}
        {aba === 'historico' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>
                {carregando ? 'Carregando...' : `${logs.length} conversa${logs.length !== 1 ? 's' : ''}`}
              </span>
              {logs.length > 0 && <span style={{ fontSize: 11, color: C.textMuted }}>Últimas 50</span>}
            </div>

            {!carregando && logs.length === 0 && (
              <div style={{ ...cardBase, padding: '64px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🤖</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>Nenhuma conversa registrada ainda</div>
                <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
                  Assim que o chatbot responder pacientes, o histórico aparecerá aqui.
                </div>
              </div>
            )}

            {logs.map(log => {
              const aberto = expandido === log.id
              return (
                <div key={log.id} style={cardBase}>
                  <div className="cb-log-card" onClick={() => setExpandido(aberto ? null : log.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px', cursor: 'pointer' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: C.purpleDim, border: `1px solid ${C.purple}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: C.purpleLight }}>
                      {(log.nome_paciente || log.telefone).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{log.nome_paciente || 'Paciente'}</span>
                        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{log.telefone}</span>
                        {processadoPorBadge(log.processado_por)}
                      </div>
                      <div style={{ fontSize: 13, color: C.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: aberto ? 'pre-wrap' : 'nowrap' }}>
                        💬 {log.mensagem_paciente}
                      </div>
                      {aberto && (
                        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.08)', border: `1px solid ${C.purple}22`, fontSize: 13, color: C.textSub, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.purpleLight, display: 'block', marginBottom: 5 }}>🤖 RESPOSTA DO BOT</span>
                          {log.resposta_bot}
                        </div>
                      )}
                    </div>
                    <div className="cb-log-meta" style={{ flexShrink: 0, textAlign: 'right', minWidth: 100 }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>{formatarData(log.created_at)}</div>
                      <span style={{ fontSize: 11, color: C.textMuted, display: 'inline-block', transform: `rotate(${aberto ? 180 : 0}deg)`, transition: 'transform 0.2s' }}>▾</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════════ ABA: TREINAMENTO ══════════════ */}
        {aba === 'treinamento' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Formulário novo / edição */}
            <div style={cardBase}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15 }}>{modoEdicao ? '✏️' : '➕'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{modoEdicao ? 'Editar Treinamento' : 'Novo Treinamento'}</span>
                </div>
                {modoEdicao && (
                  <button onClick={cancelarEdicao} style={{ fontSize: 12, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                    ✕ Cancelar
                  </button>
                )}
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

                <Field label="Pergunta de Exemplo" hint="Como o paciente pode perguntar isso">
                  <input style={inp} value={form.pergunta} onChange={e => setForm(f => ({ ...f, pergunta: e.target.value }))} placeholder='Ex: Quanto custa a limpeza dental?' />
                </Field>

                <Field label="Palavras-chave" hint="Separadas por vírgula — o chatbot detecta qualquer uma delas na mensagem">
                  <input style={inp} value={form.palavras_chave} onChange={e => setForm(f => ({ ...f, palavras_chave: e.target.value }))} placeholder='limpeza, profilaxia, valor limpeza, preço limpeza' />
                </Field>

                <Field label="Resposta do Chatbot" hint="Texto exato que será enviado ao paciente">
                  <textarea style={ta(100)} value={form.resposta} onChange={e => setForm(f => ({ ...f, resposta: e.target.value }))} placeholder={'A limpeza dental começa a partir de R$ 150.\nPara confirmar o valor exato, nossa equipe pode te atender pelo WhatsApp.'} />
                </Field>

                {msgT && (
                  <div style={{ padding: '11px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, background: msgTTipo === 'ok' ? C.greenDim : C.redDim, border: `1px solid ${msgTTipo === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(248,113,113,0.3)'}`, color: msgTTipo === 'ok' ? C.green : C.red }}>
                    {msgTTipo === 'ok' ? '✅' : '⚠️'} {msgTTexto}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={salvarTreinamento} disabled={salvandoT} style={{ padding: '10px 26px', borderRadius: 8, border: 'none', cursor: salvandoT ? 'not-allowed' : 'pointer', background: salvandoT ? '#2d3148' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontSize: 13, fontWeight: 700, opacity: salvandoT ? 0.7 : 1, boxShadow: salvandoT ? 'none' : '0 4px 14px rgba(124,58,237,0.35)' }}>
                    {salvandoT ? '⏳ Salvando...' : modoEdicao ? '✏️ Atualizar' : '➕ Salvar Treinamento'}
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de treinamentos */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>
                {treinamentos.length} treinamento{treinamentos.length !== 1 ? 's' : ''} cadastrado{treinamentos.length !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {treinamentos.filter(t => t.ativo).length} ativo{treinamentos.filter(t => t.ativo).length !== 1 ? 's' : ''}
              </span>
            </div>

            {treinamentos.length === 0 && (
              <div style={{ ...cardBase, padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.5 }}>🧠</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>Nenhum treinamento cadastrado</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
                  Cadastre perguntas e respostas acima para o chatbot responder com mais precisão.
                </div>
              </div>
            )}

            {treinamentos.map(t => (
              <div key={t.id} style={{ ...cardBase, opacity: t.ativo ? 1 : 0.55 }}>
                <div style={{ padding: '14px 18px' }}>
                  {/* Cabeçalho do card */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' as const }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{t.pergunta}</span>
                        {t.ativo
                          ? <Badge label="Ativo" color={C.green} />
                          : <Badge label="Inativo" color={C.textMuted} />}
                      </div>
                      {/* Keywords */}
                      {t.palavras_chave && (
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 8 }}>
                          {t.palavras_chave.split(',').map((k, i) => (
                            <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(251,191,36,0.1)', color: C.yellow, border: '1px solid rgba(251,191,36,0.25)' }}>
                              {k.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Resposta truncada */}
                      <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5, borderLeft: `3px solid ${C.purple}44`, paddingLeft: 10, whiteSpace: 'pre-line' }}>
                        {t.resposta.slice(0, 180)}{t.resposta.length > 180 ? '…' : ''}
                      </div>
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => toggleAtivo(t)} title={t.ativo ? 'Desativar' : 'Ativar'} style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${C.cardBorder}`, background: t.ativo ? C.greenDim : '#2d3148', color: t.ativo ? C.green : C.textMuted, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {t.ativo ? '✓' : '○'}
                      </button>
                      <button onClick={() => editarTreinamento(t)} title="Editar" style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${C.cardBorder}`, background: C.purpleDim, color: C.purpleLight, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ✏
                      </button>
                      <button onClick={() => excluirTreinamento(t.id)} title="Excluir" style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid rgba(248,113,113,0.25)`, background: 'rgba(248,113,113,0.08)', color: C.red, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════ ABA: CONFIGURAÇÃO ══════════════ */}
        {aba === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Toggle */}
            <div style={{ ...cardBase, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Chatbot Ativo</div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
                  {config.ativo ? 'Respondendo automaticamente mensagens dos pacientes.' : 'Desativado. Mensagens chegam mas sem resposta automática.'}
                </div>
              </div>
              <button onClick={() => setConfig(c => ({ ...c, ativo: !c.ativo }))} aria-label="toggle chatbot" style={{ width: 56, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer', flexShrink: 0, position: 'relative', transition: 'background 0.25s', background: config.ativo ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : '#2d3148', boxShadow: config.ativo ? '0 0 12px rgba(124,58,237,0.4)' : 'none' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1)', left: config.ativo ? 29 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
              </button>
            </div>

            <SectionCard title="Informações da Clínica" icon="🏥">
              <div className="cb-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Nome da Clínica" hint="Usado na saudação automática">
                  <input style={inp} value={config.nome_clinica ?? ''} onChange={e => setConfig(c => ({ ...c, nome_clinica: e.target.value }))} placeholder="Ex: Clínica Odontológica Sorrisos" />
                </Field>
                <Field label="Link WhatsApp Humano" hint="Enviado quando paciente pede atendente">
                  <input style={inp} value={config.link_humano ?? ''} onChange={e => setConfig(c => ({ ...c, link_humano: e.target.value }))} placeholder="https://wa.me/5541999999999" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Atendimento e Localização" icon="📍">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Horário de Funcionamento">
                  <textarea style={ta(80)} value={config.horario_funcionamento ?? ''} onChange={e => setConfig(c => ({ ...c, horario_funcionamento: e.target.value }))} placeholder={'Seg a Sex: 08h às 18h\nSáb: 08h às 12h'} />
                </Field>
                <Field label="Endereço">
                  <textarea style={ta(80)} value={config.endereco ?? ''} onChange={e => setConfig(c => ({ ...c, endereco: e.target.value }))} placeholder={'Rua das Flores, 123 — Centro\nCuritiba — PR'} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Convênios e Procedimentos" icon="🩺">
              <div className="cb-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Convênios Aceitos" hint="Um por linha">
                  <textarea style={ta(110)} value={config.convenios ?? ''} onChange={e => setConfig(c => ({ ...c, convenios: e.target.value }))} placeholder={'Unimed\nBradesco Saúde\nAmil\nParticular'} />
                </Field>
                <Field label="Procedimentos Realizados" hint="Um por linha">
                  <textarea style={ta(110)} value={config.procedimentos ?? ''} onChange={e => setConfig(c => ({ ...c, procedimentos: e.target.value }))} placeholder={'Consulta Clínica\nOrtodontia\nImplantes'} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="FAQ e Encaminhamento" icon="❓">
              <Field label="Perguntas Frequentes / Valores">
                <textarea style={ta(110)} value={config.faq ?? ''} onChange={e => setConfig(c => ({ ...c, faq: e.target.value }))} placeholder={'Consulta particular: R$ 150\nOrtodontia: a partir de R$ 180/mês'} />
              </Field>
            </SectionCard>

            {msg && (
              <div style={{ padding: '12px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, background: msgTipo === 'ok' ? C.greenDim : C.redDim, border: `1px solid ${msgTipo === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(248,113,113,0.3)'}`, color: msgTipo === 'ok' ? C.green : C.red }}>
                {msgTipo === 'ok' ? '✅' : '⚠️'} {msgTexto}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8 }}>
              <button onClick={salvarConfig} disabled={salvando} style={{ padding: '11px 30px', borderRadius: 10, border: 'none', cursor: salvando ? 'not-allowed' : 'pointer', background: salvando ? '#2d3148' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontSize: 13, fontWeight: 700, opacity: salvando ? 0.7 : 1, boxShadow: salvando ? 'none' : '0 4px 16px rgba(124,58,237,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {salvando ? '⏳ Salvando...' : '💾 Salvar Configuração'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
