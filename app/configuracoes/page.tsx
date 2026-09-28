'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';

type Config = {
  nome_clinica: string;
  telefone: string;
  email: string;
  endereco: string;
  logo_url: string;
  link_google: string;
  msg_lembrete: string;
  msg_confirmacao: string;
  msg_avaliacao: string;
  msg_reagendamento: string;
  horario_funcionamento: string;
  zapi_instance: string;
  zapi_token: string;
  zapi_client_token: string;
};

const configInicial: Config = {
  nome_clinica: '',
  telefone: '',
  email: '',
  endereco: '',
  logo_url: '',
  link_google: '',
  msg_lembrete:
    'Olá, {nome}! 👋\n\nPassamos para lembrar do seu compromisso agendado para *amanhã, {data}* às *{horario}*.\n\nPara confirmar sua presença, responda *SIM*.\nPara remarcar, é só nos avisar com antecedência. 📅\n\nContamos com você. Até amanhã! 😊',
  msg_confirmacao:
    'Olá, {nome}! ✅\n\nSeu compromisso está *confirmado* para *{data}* às *{horario}*.\n\n📍 Chegue com 5 minutos de antecedência.\n\nQualquer dúvida, é só chamar aqui. Até lá! 😊',
  msg_avaliacao:
    'Olá, {nome}! 😊\n\nEsperamos que seu atendimento tenha sido excelente! Sua opinião é muito importante para nós e ajuda outros clientes a nos encontrar.\n\nPoderia nos avaliar no Google? Leva menos de 1 minuto:\n👉 {link}\n\nMuito obrigado pela confiança! 🙏',
  msg_reagendamento:
    'Olá, {nome}! 📅\n\nIdentificamos que seu compromisso do dia *{data}* às *{horario}* precisa ser reagendado.\n\nQual o melhor horário para você? Estamos à disposição para encontrar uma data conveniente.\n\nAguardamos seu retorno! 😊',
  horario_funcionamento: 'Seg a Sex: 08h - 18h',
  zapi_instance: '',
  zapi_token: '',
  zapi_client_token: '',
};

// Resposta do teste de envio em linguagem de operação — nunca o erro técnico
// cru da rota (status/segredo/provedor).
function mensagemFalhaTeste(status: number): string {
  if (status === 401) return 'Sessão expirada. Entre novamente e repita o teste.';
  if (status === 403) return 'O teste só envia para o WhatsApp salvo do negócio. Salve as configurações e tente de novo.';
  if (status === 409) return 'Já houve um teste nesta hora (ou este número pediu para não receber mensagens). Confira o aparelho antes de repetir; um novo teste fica disponível na próxima hora.';
  if (status === 503) return 'WhatsApp não configurado: preencha Instance ID, Token e Security Token, salve e tente de novo.';
  if (status === 502 || status === 500) return 'A Z-API não confirmou o envio. Confira no painel da Z-API se a instância está conectada (QR Code lido) e confira o aparelho antes de repetir.';
  return MSG_ERRO_PADRAO;
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [config, setConfig]     = useState<Config>(configInicial);
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false); // trava síncrona de submissão — ver salvar()
  const [sucesso, setSucesso]   = useState('');
  const [erro, setErro]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [clinicaId, setClinicaId] = useState('');
  const [zapiConfigurado, setZapiConfigurado] = useState(false);
  const [testando, setTestando] = useState(false);
  const testandoRef = useRef(false); // trava síncrona contra duplo clique no teste
  const [testeMsg, setTesteMsg] = useState('');
  const [chatbotAtivo, setChatbotAtivo] = useState(false);
  const [automacoesAtivas, setAutomacoesAtivas] = useState(false);
  const [alterandoAutomacoes, setAlterandoAutomacoes] = useState(false);
  const [automacoesMsg, setAutomacoesMsg] = useState('');
  const [linkGoogleMsg, setLinkGoogleMsg] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    // try/catch envolvendo toda a função — sem isso, uma exceção inesperada
    // (rede instável, etc.) em qualquer chamada ao Supabase deixava
    // setLoading(false) sem executar, e a tela ficava presa no loader para
    // sempre. Mesmo padrão já aplicado em app/site/page.tsx.
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push('/login'); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      const cuRes = await fetch('/api/minha-clinica', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!cuRes.ok) throw new Error('Negócio indisponível');
      const cid = (await cuRes.json()).clinica_id;
      if (!cid) throw new Error('Negócio indisponível');
      setClinicaId(cid);
      const res = await fetch('/api/configuracoes?clinica_id=' + encodeURIComponent(cid), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Configuração indisponível');
      const segura = await res.json();
      const data = segura.config;
      if (!data || typeof segura.zapi_configurado !== 'boolean') throw new Error('Configuração inválida');
      setZapiConfigurado(segura.zapi_configurado);
      setChatbotAtivo(segura.chatbot_ativo === true);
      setAutomacoesAtivas(segura.automacoes_ativas === true);
      if (data) {
        setConfig({
          nome_clinica:          data.nome_clinica          || '',
          telefone:              data.telefone              || '',
          email:                 data.email                 || '',
          endereco:              data.endereco              || '',
          logo_url:              data.logo_url              || '',
          link_google:           data.link_google           || '',
          msg_lembrete:          data.msg_lembrete          || configInicial.msg_lembrete,
          msg_confirmacao:       data.msg_confirmacao       || configInicial.msg_confirmacao,
          msg_avaliacao:         data.msg_avaliacao         || configInicial.msg_avaliacao,
          msg_reagendamento:     data.msg_reagendamento     || configInicial.msg_reagendamento,
          horario_funcionamento: data.horario_funcionamento || configInicial.horario_funcionamento,
          zapi_instance:         data.zapi_instance         || '',
          zapi_token:            '',
          zapi_client_token:     '',
        });
      }
    } catch (e) {
      console.error(e);
      setErro('Não foi possível carregar as configurações agora. Recarregue a página; se o problema continuar, tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    // Trava síncrona (ref, não state) — ver docs/kensa-premium-dashboard-relatorio.md, K-03.
    if (salvandoRef.current) return;
    salvandoRef.current = true;
    try {
      setErro(''); setSucesso('');
      const link = config.link_google.trim();
      if (link && !/^https?:\/\//i.test(link)) {
        setErro('Informe um link válido do Google.');
        return;
      }
      setSalvando(true);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { router.push('/login'); return; }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || !clinicaId) throw new Error('Sessão indisponível');
        const res = await fetch('/api/configuracoes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ ...config, clinica_id: clinicaId }),
        });
        if (!res.ok) throw new Error('Não foi possível salvar');
        const segura = await res.json();
        if (typeof segura.zapi_configurado !== 'boolean') throw new Error('Resposta inválida');
        setZapiConfigurado(segura.zapi_configurado);
        setConfig(p => ({ ...p, zapi_token: '', zapi_client_token: '' }));
        setSucesso('Configuração salva.'); setTimeout(() => setSucesso(''), 4000);
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

  function testarLinkGoogle() {
    const link = config.link_google.trim();
    if (!link) {
      setLinkGoogleMsg('Informe primeiro o link de avaliação.');
      return;
    }
    setLinkGoogleMsg('');
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  async function alternarAutomacoes() {
    if (alterandoAutomacoes || !clinicaId) return;
    const ativar = !automacoesAtivas;
    const aviso = ativar
      ? 'Ativar as automações de WhatsApp deste negócio?\n\nA partir de agora, lembretes (às 18h, na véspera de cada compromisso) e pedidos de avaliação no Google serão enviados automaticamente aos clientes.'
      : 'Desativar as automações de WhatsApp deste negócio?\n\nLembretes e pedidos de avaliação deixam de ser enviados. O chatbot não é afetado.';
    if (!window.confirm(aviso)) return;
    setAlterandoAutomacoes(true); setAutomacoesMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      const res = await fetch('/api/whatsapp/automacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ clinica_id: clinicaId, ativas: ativar, idempotency_key: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.automacoes_ativas !== 'boolean') throw new Error('Falha ao alterar automações');
      setAutomacoesAtivas(data.automacoes_ativas);
      setAutomacoesMsg(data.automacoes_ativas ? 'sucesso:Automações ativadas.' : 'sucesso:Automações desativadas. Nenhum lembrete ou avaliação será enviado.');
    } catch (e) {
      console.error(e);
      setAutomacoesMsg('erro:Não foi possível alterar as automações agora. Nada foi alterado; tente novamente.');
    } finally {
      setAlterandoAutomacoes(false);
    }
  }

  async function testarWhatsapp() {
    if (testandoRef.current) return;
    testandoRef.current = true;
    setTestando(true); setTesteMsg('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push('/login'); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setTesteMsg('erro:Sessão expirada. Recarregue a página e tente novamente.');
        return;
      }

      const cuRes = await fetch('/api/minha-clinica', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;

      if (!cid) {
        setTesteMsg('erro:Negócio não vinculado ao usuário.');
        return;
      }

      if (!config.telefone) {
        setTesteMsg('erro:Informe o WhatsApp do negócio no campo acima antes de testar.');
        return;
      }

      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clinica_id: cid,
          user_id: user.id,
          telefone: config.telefone,
          mensagem: '✅ Teste OrganizaPro: integração Z-API funcionando corretamente!',
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.sucesso === true) {
        setTesteMsg('sucesso:Mensagem de teste enviada para o WhatsApp salvo do negócio. Confira o aparelho.');
      } else {
        setTesteMsg('erro:' + mensagemFalhaTeste(res.status));
      }
    } catch (e) {
      console.error(e);
      setTesteMsg('erro:' + MSG_ERRO_PADRAO);
    } finally {
      setTestando(false);
      testandoRef.current = false;
      setTimeout(() => setTesteMsg(''), 10000);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #2d3148', background: '#0f1117',
    color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
  };
  const card: React.CSSProperties = {
    background: '#1e2130', borderRadius: 12,
    border: '1px solid #2d3148', padding: 28, marginBottom: 20,
  };

  if (loading) return (
    <AdminShell title="⚙️ Configurações da Empresa" subtitle="Mantenha os dados da sua empresa sempre atualizados. Essas informações serão utilizadas em todo o OrganizaPro.">
      <PageLoader title="Carregando configurações..." />
    </AdminShell>
  );

  return (
    <AdminShell title="⚙️ Configurações da Empresa" subtitle="Mantenha os dados da sua empresa sempre atualizados. Essas informações serão utilizadas em todo o OrganizaPro.">
      <style>{`
        .cfg-btn-salvar:hover:not(:disabled) { filter: brightness(1.1); }
        .cfg-btn-testar:hover:not(:disabled) { background: rgba(79,70,229,0.2) !important; }
      `}</style>
      <div style={{ width: '100%', maxWidth: 960 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>⚙️ Configurações da Empresa</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0' }}>Mantenha os dados da sua empresa sempre atualizados. Essas informações serão utilizadas em todo o OrganizaPro.</p>
          </div>
          <button className="cfg-btn-salvar" onClick={salvar} disabled={salvando} style={{ padding: '12px 22px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: salvando ? 0.7 : 1, transition: 'filter 0.15s' }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        {/* Feedback */}
        {sucesso && (
          <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso('')} />
        )}
        {erro && (
          <Feedback type="erro" message={erro} onClose={() => setErro('')} />
        )}

        {/* Card — Informações do Negócio */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 20, marginTop: 0 }}>Informações do Negócio</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {[
              { k: 'nome_clinica', l: 'Nome do Negócio', t: 'text',  p: 'Ex.: Barbearia Imperial'        },
              { k: 'telefone',     l: 'WhatsApp',        t: 'text',  p: '(00) 00000-0000'                },
              { k: 'email',        l: 'Email',           t: 'email', p: 'contato@suaempresa.com.br'      },
              { k: 'endereco',     l: 'Endereço',        t: 'text',  p: 'Ex.: Av. Brasil, 1250 - Centro' },
            ].map(f => (
              <div key={f.k}>
                <label style={lbl}>{f.l}</label>
                <input type={f.t} placeholder={f.p} value={config[f.k as keyof Config]} onChange={e => setConfig(p => ({ ...p, [f.k]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
        </div>

        {/* Card — Links e Horários */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 20, marginTop: 0 }}>Google, Avaliações e Horários</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {[
              { k: 'logo_url',              l: 'Logo da Empresa',       p: 'Cole a URL da sua logo' },
              { k: 'horario_funcionamento', l: 'Horário de Atendimento', p: 'Seg a Sex: 08h-18h'     },
            ].map(f => (
              <div key={f.k}>
                <label style={lbl}>{f.l}</label>
                <input type="text" placeholder={f.p} value={config[f.k as keyof Config]} onChange={e => setConfig(p => ({ ...p, [f.k]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>⭐ Link para Avaliação no Google</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Cole aqui o link do seu perfil no Google"
                  value={config.link_google}
                  onChange={e => { setConfig(p => ({ ...p, link_google: e.target.value })); setLinkGoogleMsg(''); }}
                  style={{ ...inp, flex: '1 1 260px' }}
                />
                <button
                  className="cfg-btn-testar"
                  type="button"
                  onClick={testarLinkGoogle}
                  style={{
                    padding: '10px 16px', borderRadius: 8,
                    border: '1px solid #4f46e5', background: 'rgba(79,70,229,0.12)',
                    color: '#a78bfa', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s',
                  }}
                >
                  🔗 Abrir Link de Avaliação
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#475569', margin: '6px 0 0' }}>
                Cole aqui o link direto da tela de avaliação do Google. Este é o link que será enviado automaticamente aos seus clientes após um atendimento concluído para solicitar uma avaliação.
              </p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0' }}>
                💡 Dica: Esse é o mesmo link que aparece quando você clica em &quot;Compartilhar formulário de avaliação&quot; no Perfil da Empresa no Google.
              </p>
              {linkGoogleMsg && (
                <div style={{ marginTop: 8 }}>
                  <Feedback type="aviso" message={linkGoogleMsg} onClose={() => setLinkGoogleMsg('')} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card — Mensagens Automáticas */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 8, marginTop: 0 }}>Mensagens Automáticas</h2>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
            Variáveis disponíveis:{' '}
            <code style={{ color: '#a78bfa' }}>{'{nome}'}</code>{' '}
            <code style={{ color: '#a78bfa' }}>{'{data}'}</code>{' '}
            <code style={{ color: '#a78bfa' }}>{'{horario}'}</code>{' '}
            <code style={{ color: '#a78bfa' }}>{'{link}'}</code>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { k: 'msg_lembrete',       l: 'Lembrete de Atendimento'  },
              { k: 'msg_confirmacao',    l: 'Confirmação de Presença'   },
              { k: 'msg_avaliacao',      l: 'Solicitação de Avaliação'  },
              { k: 'msg_reagendamento',  l: 'Reagendamento'             },
            ].map(f => (
              <div key={f.k}>
                <label style={lbl}>{f.l}</label>
                <textarea value={config[f.k as keyof Config]} onChange={e => setConfig(p => ({ ...p, [f.k]: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Card — Z-API */}
        <div style={{ ...card, border: '1px solid #3b1f6e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>📲</span>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Integração WhatsApp (Z-API)</h2>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
            Encontre esses dados em <strong style={{ color: '#a78bfa' }}>app.z-api.io</strong> → sua instância → Credenciais e Segurança.
          </p>

          {/* Estado operacional — só situação, nunca credencial */}
          <div data-testid="whatsapp-status" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { l: 'WhatsApp (Z-API)', ok: zapiConfigurado, sim: 'Configurado', nao: 'Não configurado' },
              { l: 'Chatbot', ok: chatbotAtivo, sim: 'Ativo', nao: 'Desativado', dica: 'Ligue/desligue em Chatbot' },
              { l: 'Automações (lembretes e avaliações)', ok: automacoesAtivas, sim: 'Ativas', nao: 'Desativadas' },
            ].map(s => (
              <div key={s.l} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.l}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: s.ok ? '#22c55e' : '#f59e0b' }}>{s.ok ? '● ' + s.sim : '○ ' + s.nao}</div>
                {s.dica && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{s.dica}</div>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <button
              className="cfg-btn-testar"
              type="button"
              onClick={alternarAutomacoes}
              disabled={alterandoAutomacoes || !clinicaId}
              style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${automacoesAtivas ? '#b45309' : '#16a34a'}`, background: automacoesAtivas ? 'rgba(180,83,9,0.12)' : 'rgba(22,163,74,0.12)', color: automacoesAtivas ? '#fbbf24' : '#4ade80', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: alterandoAutomacoes ? 0.5 : 1 }}
            >
              {alterandoAutomacoes ? '⏳ Alterando...' : automacoesAtivas ? '⏸ Desativar automações' : '▶ Ativar automações'}
            </button>
            <span style={{ fontSize: 11, color: '#64748b', flex: '1 1 260px' }}>
              Conectar o WhatsApp não liga as automações. Teste envio, chatbot e atendimento humano antes; só então ative.
            </span>
          </div>
          {automacoesMsg && (
            <div style={{ marginBottom: 16 }}>
              <Feedback type={automacoesMsg.startsWith('sucesso:') ? 'sucesso' : 'erro'} message={automacoesMsg.split(':').slice(1).join(':')} onClose={() => setAutomacoesMsg('')} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={lbl}>Z-API Instance ID</label>
              <input type="text" placeholder="Ex: 3EB1F8A2B4C..." value={config.zapi_instance} onChange={e => setConfig(p => ({ ...p, zapi_instance: e.target.value }))} style={inp} />
              <p style={{ fontSize: 11, color: '#475569', margin: '5px 0 0' }}>Aba &quot;Instância&quot; → campo Instance ID</p>
            </div>
            <div>
              <label style={lbl}>Z-API Token da Instância</label>
              <input type="password" placeholder={zapiConfigurado ? "Configurado — deixe vazio para manter" : "Novo token da instância"} value={config.zapi_token} onChange={e => setConfig(p => ({ ...p, zapi_token: e.target.value }))} style={inp} />
              <p style={{ fontSize: 11, color: '#475569', margin: '5px 0 0' }}>Aba &quot;Instância&quot; → campo Token — vai na URL da requisição</p>
            </div>
            <div>
              <label style={lbl}>Z-API Security Token (Client-Token)</label>
              <input type="password" placeholder={zapiConfigurado ? "Configurado — deixe vazio para manter" : "Novo Security Token da conta"} value={config.zapi_client_token} onChange={e => setConfig(p => ({ ...p, zapi_client_token: e.target.value }))} style={inp} />
              <p style={{ fontSize: 11, color: '#475569', margin: '5px 0 0' }}>Aba &quot;Segurança&quot; → Security Token — vai no header Client-Token</p>
            </div>
          </div>

          {/* Botão de teste */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              className="cfg-btn-testar"
              onClick={testarWhatsapp}
              disabled={testando || !zapiConfigurado}
              style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #4f46e5', background: 'rgba(79,70,229,0.12)', color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (testando || !zapiConfigurado) ? 0.5 : 1, transition: 'background 0.15s' }}
            >
              {testando ? '⏳ Enviando...' : '🧪 Enviar mensagem de teste'}
            </button>
          </div>
          {testeMsg && (
            <div style={{ marginTop: 14 }}>
              <Feedback
                type={testeMsg.startsWith('sucesso:') ? 'sucesso' : 'erro'}
                message={testeMsg.split(':').slice(1).join(':')}
                onClose={() => setTesteMsg('')}
              />
            </div>
          )}
          <p style={{ fontSize: 11, color: '#475569', marginTop: 10, marginBottom: 0 }}>
            Salve as configurações antes de testar. O teste envia uma mensagem para o WhatsApp cadastrado no campo acima.
          </p>
        </div>

        {/* Botão salvar rodapé */}
        <div style={{ textAlign: 'center', paddingBottom: 32 }}>
          <button className="cfg-btn-salvar" onClick={salvar} disabled={salvando} style={{ padding: '12px 40px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: salvando ? 0.7 : 1, transition: 'filter 0.15s' }}>
            {salvando ? 'Salvando...' : 'Salvar todas as alterações'}
          </button>
        </div>

      </div>
    </AdminShell>
  );
}
