'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';

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
    'Olá, {nome}! 👋\n\nPassamos para lembrar da sua consulta agendada para *amanhã, {data}* às *{horario}*.\n\nPara confirmar sua presença, responda *SIM*.\nPara remarcar, é só nos avisar com antecedência. 📅\n\nContamos com você. Até amanhã! 😊',
  msg_confirmacao:
    'Olá, {nome}! ✅\n\nSua consulta está *confirmada* para *{data}* às *{horario}*.\n\n📍 Chegue com 5 minutos de antecedência.\n📋 Traga documento com foto e cartão do convênio, se houver.\n\nQualquer dúvida, é só chamar aqui. Até lá! 😊',
  msg_avaliacao:
    'Olá, {nome}! 😊\n\nEsperamos que sua consulta tenha sido excelente! Sua opinião é muito importante para nós e ajuda outros pacientes a nos encontrar.\n\nPoderia nos avaliar no Google? Leva menos de 1 minuto:\n👉 {link}\n\nMuito obrigado pela confiança! 🙏',
  msg_reagendamento:
    'Olá, {nome}! 📅\n\nIdentificamos que sua consulta do dia *{data}* às *{horario}* precisa ser reagendada.\n\nQual o melhor horário para você? Estamos à disposição para encontrar uma data conveniente.\n\nAguardamos seu retorno! 😊',
  horario_funcionamento: 'Seg a Sex: 08h - 18h',
  zapi_instance: '',
  zapi_token: '',
  zapi_client_token: '',
};

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [config, setConfig]     = useState<Config>(configInicial);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso]   = useState(false);
  const [erro, setErro]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [clinicaId, setClinicaId] = useState('');
  const [testando, setTestando] = useState(false);
  const [testeMsg, setTesteMsg] = useState('');

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    setSalvando(true); setErro(''); setSucesso(false);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push('/login'); return; }
      const { error } = await supabase
        .from('clinica_config')
        .upsert(
          { ...config, user_id: user.id, clinica_id: clinicaId, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      if (error) setErro('Erro: ' + error.message);
      else { setSucesso(true); setTimeout(() => setSucesso(false), 3000); }
    } catch (e) {
      setErro('Erro inesperado: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
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

      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinica_id: cu.clinica_id,
          user_id: user.id,
          telefone: config.telefone,
          mensagem: '✅ Teste OrganizaPro: integração Z-API funcionando corretamente!',
        }),
      });

      const data = await res.json();
      if (data.sucesso) {
        const aviso = data.log_error ? ` (aviso: log não gravado — ${data.log_error})` : '';
        setTesteMsg('sucesso:Mensagem enviada com sucesso!' + aviso);
      } else {
        setTesteMsg('erro:' + JSON.stringify(data));
      }
    } catch (e) {
      setTesteMsg('erro:Erro de conexão: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTestando(false);
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
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      Carregando...
    </div>
  );

  return (
    <AdminShell title="Configuracoes" subtitle="Personalize as informações do seu negócio">
      <div style={{ width: '100%', maxWidth: 960 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Configuracoes</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0' }}>Personalize as informações do seu negócio</p>
          </div>
          <button onClick={salvar} disabled={salvando} style={{ padding: '12px 22px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        {/* Feedback */}
        {sucesso && (
          <div style={{ background: '#14532d', border: '1px solid #16a34a', borderRadius: 10, padding: '14px 20px', marginBottom: 20, color: '#4ade80', fontSize: 13, fontWeight: 600 }}>
            ✅ Configuracoes salvas com sucesso!
          </div>
        )}
        {erro && (
          <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: 10, padding: '14px 20px', marginBottom: 20, color: '#f87171', fontSize: 13 }}>
            {erro}
          </div>
        )}

        {/* Card — Informações da Clínica */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 20, marginTop: 0 }}>Informações do Negócio</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {[
              { k: 'nome_clinica', l: 'Nome do Negócio', t: 'text',  p: 'Ex: Meu Negócio'         },
              { k: 'telefone',     l: 'WhatsApp',        t: 'text',  p: '11999999999'              },
              { k: 'email',        l: 'Email',           t: 'email', p: 'contato@seunegocio.com'   },
              { k: 'endereco',     l: 'Endereco',        t: 'text',  p: 'Rua das Flores, 123' },
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
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 20, marginTop: 0 }}>Google Meu Negócio e Horários</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {[
              { k: 'logo_url',              l: 'URL da Logo',                             p: 'https://...'                              },
              { k: 'link_google',           l: 'Link do Perfil da Empresa no Google',     p: 'Cole aqui o link do seu perfil no Google' },
              { k: 'horario_funcionamento', l: 'Horario de Funcionamento',                p: 'Seg a Sex: 08h-18h'                       },
            ].map(f => (
              <div key={f.k}>
                <label style={lbl}>{f.l}</label>
                <input type="text" placeholder={f.p} value={config[f.k as keyof Config]} onChange={e => setConfig(p => ({ ...p, [f.k]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
        </div>

        {/* Card — Mensagens Automáticas */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 8, marginTop: 0 }}>Mensagens Automaticas</h2>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
            Variaveis disponíveis:{' '}
            <code style={{ color: '#a78bfa' }}>{'{nome}'}</code>{' '}
            <code style={{ color: '#a78bfa' }}>{'{data}'}</code>{' '}
            <code style={{ color: '#a78bfa' }}>{'{horario}'}</code>{' '}
            <code style={{ color: '#a78bfa' }}>{'{link}'}</code>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { k: 'msg_lembrete',       l: 'Lembrete de Consulta'     },
              { k: 'msg_confirmacao',    l: 'Confirmacao de Presenca'   },
              { k: 'msg_avaliacao',      l: 'Solicitacao de Avaliacao'  },
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
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Integracao WhatsApp (Z-API)</h2>
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
              onClick={testarWhatsapp}
              disabled={testando || !config.zapi_instance || !config.zapi_token || !config.zapi_client_token}
              style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #4f46e5', background: 'rgba(79,70,229,0.12)', color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (testando || !config.zapi_instance || !config.zapi_token || !config.zapi_client_token) ? 0.5 : 1 }}
            >
              {testando ? '⏳ Enviando...' : '🧪 Enviar mensagem de teste'}
            </button>
            {testeMsg && (
              <span style={{ fontSize: 13, fontWeight: 600, color: testeMsg.startsWith('sucesso:') ? '#4ade80' : '#f87171' }}>
                {testeMsg.startsWith('sucesso:') ? '✅ ' : '❌ '}
                {testeMsg.split(':').slice(1).join(':')}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#475569', marginTop: 10, marginBottom: 0 }}>
            Salve as configuracoes antes de testar. O teste envia uma mensagem para o WhatsApp cadastrado no campo acima.
          </p>
        </div>

        {/* Botão salvar rodapé */}
        <div style={{ textAlign: 'center', paddingBottom: 32 }}>
          <button onClick={salvar} disabled={salvando} style={{ padding: '12px 40px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>
            {salvando ? 'Salvando...' : 'Salvar todas as alteracoes'}
          </button>
        </div>

      </div>
    </AdminShell>
  );
}
