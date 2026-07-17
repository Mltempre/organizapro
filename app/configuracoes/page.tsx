'use client';

import { useEffect, useState } from 'react';
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

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [config, setConfig]     = useState<Config>(configInicial);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso]   = useState('');
  const [erro, setErro]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [clinicaId, setClinicaId] = useState('');
  const [testando, setTestando] = useState(false);
  const [testeMsg, setTesteMsg] = useState('');
  const [linkGoogleMsg, setLinkGoogleMsg] = useState('');

  async function carregar() {
    setLoading(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { router.push('/login'); return; }

    const { data: cu } = await supabase
      .from('clinica_usuarios')
      .select('clinica_id')
      .eq('usuario_id', user.id)
      .maybeSingle();

    setClinicaId(cu?.clinica_id || '');

    const { data } = await supabase
      .from('clinica_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
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
        zapi_token:            data.zapi_token            || '',
        zapi_client_token:     data.zapi_client_token     || '',
      });
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvar() {
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
      const { error } = await supabase
        .from('clinica_config')
        .upsert(
          { ...config, user_id: user.id, clinica_id: clinicaId, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      if (error) { console.error(error); setErro(MSG_ERRO_PADRAO); }
      else { setSucesso('Configuração salva.'); setTimeout(() => setSucesso(''), 4000); }
    } catch (e) {
      console.error(e);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setSalvando(false);
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

  async function testarWhatsapp() {
    setTestando(true); setTesteMsg('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push('/login'); return; }

      const { data: cu } = await supabase
        .from('clinica_usuarios').select('clinica_id').eq('usuario_id', user.id).maybeSingle();

      if (!cu?.clinica_id) {
        setTesteMsg('erro:Negócio não vinculado ao usuário.');
        return;
      }

      if (!config.telefone) {
        setTesteMsg('erro:Informe o WhatsApp do negócio no campo acima antes de testar.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setTesteMsg('erro:Sessão expirada. Recarregue a página e tente novamente.');
        return;
      }

      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clinica_id: cu.clinica_id,
          user_id: user.id,
          telefone: config.telefone,
          mensagem: '✅ Teste OrganizaPro: integração Z-API funcionando corretamente!',
        }),
      });

      const data = await res.json();
      if (res.ok && data?.sucesso === true) {
        setTesteMsg('sucesso:Mensagem de teste enviada com sucesso.');
      } else {
        console.error(data);
        const detalhe = data?.error || data?.detalhe;
        setTesteMsg('erro:' + (detalhe ? `${MSG_ERRO_PADRAO} (${res.status}: ${detalhe})` : MSG_ERRO_PADRAO));
      }
    } catch (e) {
      console.error(e);
      setTesteMsg('erro:' + MSG_ERRO_PADRAO);
    } finally {
      setTestando(false);
      setTimeout(() => setTesteMsg(''), 4000);
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
              <label style={lbl}>Link do Google Meu Negócio</label>
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
                  🔗 Testar Link
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#475569', margin: '6px 0 0' }}>
                Esse link será utilizado para solicitar avaliações automaticamente aos seus clientes.
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
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
            Encontre esses dados em <strong style={{ color: '#a78bfa' }}>app.z-api.io</strong> → sua instância → Credenciais e Segurança.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={lbl}>Z-API Instance ID</label>
              <input type="text" placeholder="Ex: 3EB1F8A2B4C..." value={config.zapi_instance} onChange={e => setConfig(p => ({ ...p, zapi_instance: e.target.value }))} style={inp} />
              <p style={{ fontSize: 11, color: '#475569', margin: '5px 0 0' }}>Aba &quot;Instância&quot; → campo Instance ID</p>
            </div>
            <div>
              <label style={lbl}>Z-API Token da Instância</label>
              <input type="password" placeholder="Token da instância" value={config.zapi_token} onChange={e => setConfig(p => ({ ...p, zapi_token: e.target.value }))} style={inp} />
              <p style={{ fontSize: 11, color: '#475569', margin: '5px 0 0' }}>Aba &quot;Instância&quot; → campo Token — vai na URL da requisição</p>
            </div>
            <div>
              <label style={lbl}>Z-API Security Token (Client-Token)</label>
              <input type="password" placeholder="Security Token da conta" value={config.zapi_client_token} onChange={e => setConfig(p => ({ ...p, zapi_client_token: e.target.value }))} style={inp} />
              <p style={{ fontSize: 11, color: '#475569', margin: '5px 0 0' }}>Aba &quot;Segurança&quot; → Security Token — vai no header Client-Token</p>
            </div>
          </div>

          {/* Botão de teste */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              className="cfg-btn-testar"
              onClick={testarWhatsapp}
              disabled={testando || !config.zapi_instance || !config.zapi_token || !config.zapi_client_token}
              style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #4f46e5', background: 'rgba(79,70,229,0.12)', color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (testando || !config.zapi_instance || !config.zapi_token || !config.zapi_client_token) ? 0.5 : 1, transition: 'background 0.15s' }}
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
