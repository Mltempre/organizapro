/**
 * Teste ponta a ponta do Chatbot IA — fluxo treinamento
 * Uso: node scripts/test-chatbot.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE_URL     = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const MENSAGEM     = 'quanto custa limpeza?'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[ERRO] Variáveis de ambiente não encontradas.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const OK   = '\x1b[32m✅\x1b[0m'
const FAIL = '\x1b[31m❌\x1b[0m'
const WARN = '\x1b[33m⚠️ \x1b[0m'

function sep(n, label) {
  console.log(`\n${'─'.repeat(62)}`)
  console.log(` ETAPA ${n} — ${label}`)
  console.log('─'.repeat(62))
}

// ─── Funções que espelham o código de produção ────────────────────────────────

function normalizar(t) {
  return t.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function classificarResposta(texto) {
  const t = normalizar(texto)
  const CEX = new Set(['s','👍','✅','estarei la','estou indo','pode confirmar'])
  const REX = new Set(['n'])
  const CP  = ['sim','confirmo','confirmado','ok','certo']
  const RP  = ['nao','cancelar','cancela','reagendar','remarcar']
  const ini = (t, p) => t === p || (t.startsWith(p) && /^[\s,!.?]/.test(t.slice(p.length)))
  if (CEX.has(t)) return 'confirmar'
  if (REX.has(t)) return 'reagendar'
  if (CP.some(p => ini(t,p))) return 'confirmar'
  if (RP.some(p => ini(t,p))) return 'reagendar'
  return 'ignorar'
}

function ehConfirmacao(msg) {
  const t = normalizar(msg)
  if (t === '👍' || t === '✅') return true
  return /^(sim|s|nao|n|confirmo|confirmado|ok|certo|cancelar|cancela|reagendar|remarcar|estarei la|estou indo|pode confirmar)[\s,!.?]?$/.test(t)
}

function matchTreinamento(msgNorm, lista) {
  for (const t of lista) {
    if (!t.palavras_chave?.trim()) continue
    const kws = t.palavras_chave.split(',').map(k => normalizar(k.trim())).filter(k => k)
    const hit = kws.find(kw => msgNorm.includes(kw))
    if (hit) return { treinamento: t, keyword: hit }
  }
  return null
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║   TESTE PONTA A PONTA — Treinamento Chatbot ClinicaFlow     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`\n  Mensagem : "${MENSAGEM}"`)
  console.log(`  Servidor : ${BASE_URL}\n`)

  // ══════════════════════════════════════════════════════
  sep(1, 'Webhook Z-API: classificarResposta')
  // ══════════════════════════════════════════════════════

  const acao = classificarResposta(MENSAGEM)
  console.log(`  classificarResposta("${MENSAGEM}") = "${acao}"`)

  if (acao !== 'ignorar') {
    console.log(`\n  ${FAIL} BLOQUEIO: classificado como "${acao}" — vai para confirmação de consulta, não chatbot!`)
    console.log(`  → Mensagem contém palavra de confirmação. Use outra mensagem de teste.`)
    process.exit(1)
  }
  console.log(`  ${OK} acao = "ignorar" → roteia para /api/chatbot/message`)

  // ══════════════════════════════════════════════════════
  sep(2, 'Chatbot/message: guarda ehConfirmacaoDeConsulta')
  // ══════════════════════════════════════════════════════

  const eConf = ehConfirmacao(MENSAGEM)
  console.log(`  ehConfirmacaoDeConsulta("${MENSAGEM}") = ${eConf}`)

  if (eConf) {
    console.log(`  ${FAIL} BLOQUEIO: mensagem seria descartada como confirmação de consulta`)
    process.exit(1)
  }
  console.log(`  ${OK} Passa pelo guarda — segue para verificação do chatbot_config`)

  // ══════════════════════════════════════════════════════
  sep(3, 'Banco: clinica_config (instanceId → clinica_id)')
  // ══════════════════════════════════════════════════════

  const { data: clinicas, error: cErr } = await supabase
    .from('clinica_config')
    .select('clinica_id, zapi_instance, zapi_token, zapi_client_token, nome_clinica')
    .limit(5)

  if (cErr || !clinicas?.length) {
    console.log(`  ${FAIL} BLOQUEIO: clinica_config não encontrada — ${cErr?.message ?? 'vazio'}`)
    process.exit(1)
  }

  const clinica = clinicas.find(c => !!c.zapi_instance) ?? clinicas[0]
  const clinicaId = clinica.clinica_id

  console.log(`  ${OK} clinica_config encontrada`)
  console.log(`     clinica_id   : ${clinicaId.slice(0,8)}…`)
  console.log(`     nome         : ${clinica.nome_clinica ?? '(sem nome)'}`)
  console.log(`     zapi_instance: ${clinica.zapi_instance ? OK + ' configurado' : FAIL + ' VAZIO'}`)
  console.log(`     zapi_token   : ${clinica.zapi_token    ? OK + ' configurado' : FAIL + ' VAZIO'}`)

  if (!clinica.zapi_instance) {
    console.log(`\n  ${WARN} zapi_instance vazio → webhook não conseguirá rotear pelo instanceId`)
    console.log(`  → Preencha clinica_config.zapi_instance com o instanceId da Z-API`)
  }

  // ══════════════════════════════════════════════════════
  sep(4, 'Banco: chatbot_config (ativo)')
  // ══════════════════════════════════════════════════════

  const { data: cbCfg, error: cbErr } = await supabase
    .from('chatbot_config')
    .select('ativo, nome_clinica, horario_funcionamento, link_humano')
    .eq('clinica_id', clinicaId)
    .maybeSingle()

  if (cbErr) {
    console.log(`  ${FAIL} BLOQUEIO: erro ao buscar chatbot_config — ${cbErr.message}`)
    process.exit(1)
  }
  if (!cbCfg) {
    console.log(`  ${FAIL} BLOQUEIO: chatbot_config não encontrada para esta clínica`)
    console.log(`  → Acesse /chatbot → Configuração e salve`)
    process.exit(1)
  }

  console.log(`  chatbot_config.ativo = ${cbCfg.ativo}`)

  if (!cbCfg.ativo) {
    console.log(`  ${FAIL} BLOQUEIO: chatbot_config.ativo = false`)
    console.log(`  → Acesse /chatbot → Configuração → ligue o toggle Chatbot Ativo → Salvar`)
    process.exit(1)
  }
  console.log(`  ${OK} chatbot_config.ativo = true → chatbot vai responder`)

  // ══════════════════════════════════════════════════════
  sep(5, 'Banco: chatbot_treinamento (busca por palavra-chave)')
  // ══════════════════════════════════════════════════════

  const { data: treins, error: tErr } = await supabase
    .from('chatbot_treinamento')
    .select('id, pergunta, resposta, palavras_chave, ativo')
    .eq('clinica_id', clinicaId)
    .eq('ativo', true)

  if (tErr) {
    console.log(`  ${FAIL} BLOQUEIO: erro ao buscar treinamentos — ${tErr.message}`)
    process.exit(1)
  }

  console.log(`  Treinamentos ativos encontrados: ${treins?.length ?? 0}`)

  if (!treins?.length) {
    console.log(`  ${WARN} Nenhum treinamento ativo — chatbot usará apenas regras fixas`)
    console.log(`  → Acesse /chatbot → Treinamento e cadastre uma entrada`)
  } else {
    treins.forEach((t, i) => {
      console.log(`\n  [${i+1}] ID: ${t.id.slice(0,8)}…`)
      console.log(`       Pergunta    : ${t.pergunta}`)
      console.log(`       Palavras-chave: ${t.palavras_chave}`)
      console.log(`       Resposta    : ${t.resposta.slice(0,80)}…`)
    })
  }

  const msgNorm = normalizar(MENSAGEM)
  console.log(`\n  Mensagem normalizada: "${msgNorm}"`)

  const resultado = treins?.length ? matchTreinamento(msgNorm, treins) : null

  if (!resultado) {
    console.log(`  ${WARN} Nenhum treinamento com match para "${MENSAGEM}"`)
    if (treins?.length) {
      console.log(`  → Palavras cadastradas:`)
      treins.forEach(t => {
        const kws = t.palavras_chave?.split(',').map(k => k.trim()).filter(Boolean) ?? []
        console.log(`     "${t.pergunta}" → [${kws.join(', ')}]`)
        kws.forEach(kw => {
          const norm = normalizar(kw)
          const match = msgNorm.includes(norm)
          console.log(`       "${kw}" (norm: "${norm}") — ${match ? OK + ' MATCH' : 'sem match'}`)
        })
      })
    }
    console.log(`\n  → Chatbot usará regras fixas para esta mensagem`)
  } else {
    console.log(`\n  ${OK} MATCH encontrado!`)
    console.log(`     Treinamento ID : ${resultado.treinamento.id.slice(0,8)}…`)
    console.log(`     Keyword usada  : "${resultado.keyword}"`)
    console.log(`     Resposta       : ${resultado.treinamento.resposta.slice(0,120)}`)
  }

  // ══════════════════════════════════════════════════════
  sep(6, 'HTTP: POST /api/chatbot/message (teste real)')
  // ══════════════════════════════════════════════════════

  const telefone = '5541999999999'
  const payload  = { clinica_id: clinicaId, telefone, mensagem: MENSAGEM, nome_paciente: 'Paciente Teste' }
  console.log(`  Chamando ${BASE_URL}/api/chatbot/message`)
  console.log(`  Payload: ${JSON.stringify(payload)}`)

  let httpOk = false
  let httpResp = null
  try {
    const r = await fetch(`${BASE_URL}/api/chatbot/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    httpResp = await r.json()
    httpOk   = r.ok
    if (httpOk) {
      console.log(`\n  ${OK} HTTP ${r.status} — resposta recebida:`)
      console.log(`     sucesso        : ${httpResp.sucesso}`)
      console.log(`     topico         : ${httpResp.topico}`)
      console.log(`     processado_por : ${httpResp.processado_por}`)
      if (httpResp.resposta) {
        console.log(`     resposta       :`)
        String(httpResp.resposta).split('\n').forEach(l => console.log(`       ${l}`))
      }
      if (httpResp.ignorado) {
        console.log(`  ${WARN} IGNORADO: ${httpResp.ignorado}`)
      }
    } else {
      console.log(`  ${FAIL} HTTP ${r.status}: ${JSON.stringify(httpResp)}`)
    }
  } catch (e) {
    if (e.name === 'TimeoutError' || e.message?.includes('ECONNREFUSED')) {
      console.log(`  ${WARN} Servidor não disponível em ${BASE_URL}`)
      console.log(`  → Para testar o HTTP, rode: npm run dev  (em outro terminal)`)
      console.log(`  → Depois reexecute este script`)
    } else {
      console.log(`  ${FAIL} Erro HTTP: ${e.message}`)
    }
  }

  // ══════════════════════════════════════════════════════
  sep(7, 'Banco: chatbot_logs (registros após teste)')
  // ══════════════════════════════════════════════════════

  const { data: logsApos } = await supabase
    .from('chatbot_logs')
    .select('id, telefone, mensagem_paciente, resposta_bot, processado_por, created_at')
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false })
    .limit(3)

  if (!logsApos?.length) {
    console.log(`  ${WARN} chatbot_logs ainda vazio para esta clínica`)
    console.log(`  → Log será gravado quando a mensagem for processada via HTTP`)
  } else {
    console.log(`  ${OK} Últimos ${logsApos.length} log(s):`)
    logsApos.forEach((l, i) => {
      const data = new Date(l.created_at).toLocaleString('pt-BR')
      const ehTeste = l.telefone === telefone
      console.log(`\n  [${i+1}]${ehTeste ? ' ← ESTE TESTE' : ''}`)
      console.log(`       Data      : ${data}`)
      console.log(`       Telefone  : ${l.telefone}`)
      console.log(`       Mensagem  : ${l.mensagem_paciente?.slice(0,60)}`)
      console.log(`       Resposta  : ${l.resposta_bot?.slice(0,80)}…`)
      console.log(`       Proc.por  : ${l.processado_por}`)
    })
  }

  // ══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(62))
  console.log(' RESUMO FINAL')
  console.log('═'.repeat(62))
  console.log(`\n  Mensagem: "${MENSAGEM}"`)
  console.log(`\n  [WEBHOOK]     classificarResposta → "ignorar"         ${OK}`)
  console.log(`  [CHATBOT/MSG] guarda confirmação → false               ${OK}`)
  console.log(`  [BANCO]       clinica_config encontrada                ${OK}`)
  console.log(`  [BANCO]       chatbot_config.ativo = true              ${cbCfg.ativo ? OK : FAIL}`)
  console.log(`  [BANCO]       treinamento com match                    ${resultado ? OK : WARN + ' (usará regras fixas)'}`)
  console.log(`  [HTTP]        POST /api/chatbot/message                ${httpOk ? OK : WARN + ' (servidor off)'}`)
  console.log(`  [Z-API]       zapi_instance + token configurados       ${(clinica.zapi_instance && clinica.zapi_token) ? OK : FAIL}`)
  console.log(`  [BANCO]       chatbot_logs gravado                     ${logsApos?.find(l => l.telefone === telefone) ? OK : WARN + ' (aguarda HTTP)'}`)

  const bloqueios = []
  if (!cbCfg.ativo) bloqueios.push('chatbot_config.ativo = false → ative em /chatbot → Configuração')
  if (!resultado && treins?.length) bloqueios.push(`Nenhum treinamento com keyword que case "${MENSAGEM}"`)
  if (!resultado && !treins?.length) bloqueios.push('Nenhum treinamento cadastrado → cadastre em /chatbot → Treinamento')
  if (!clinica.zapi_instance) bloqueios.push('zapi_instance vazio → webhook não consegue rotear')
  if (!clinica.zapi_token)    bloqueios.push('zapi_token vazio → /api/whatsapp não consegue enviar')

  if (bloqueios.length) {
    console.log(`\n  ${FAIL} Itens que precisam de atenção:`)
    bloqueios.forEach(b => console.log(`     • ${b}`))
  } else {
    console.log(`\n  ${OK} Fluxo sem bloqueios! Envie "${MENSAGEM}" via WhatsApp para confirmar em produção.`)
  }
  console.log('\n' + '═'.repeat(62) + '\n')
}

main().catch(err => { console.error('\n[ERRO FATAL]', err.message); process.exit(1) })
