'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback from '../components/Feedback';
import type { carregarRelatorioAtribuicao } from '../../lib/atribuicao-dados';
import { TIPOS_VINCULO_ATRIBUICAO, type TipoVinculoAtribuicao } from '../../lib/atribuicao-relatorio';
import { CONEXOES_ADS_V1 } from '../../lib/ads-contratos';

type Dados = Awaited<ReturnType<typeof carregarRelatorioAtribuicao>>;
const dinheiro = (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const labels: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads', campanha_utm: 'Campanha marcada / plataforma incerta', busca_organica: 'Busca orgânica', referencia: 'Referência', direto: 'Origem não identificada', cliente: 'Cliente', oportunidade: 'Oportunidade', orcamento: 'Orçamento', pedido: 'Pedido', agendamento: 'Agendamento', cobranca: 'Cobrança' };

export default function AtribuicaoPage() {
  const router = useRouter();
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [origemId, setOrigemId] = useState('');
  const [tipo, setTipo] = useState<TipoVinculoAtribuicao>('oportunidade');
  const [entidadeId, setEntidadeId] = useState('');
  const [evidencia, setEvidencia] = useState('');

  const sessao = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) { router.push('/login'); throw new Error('Sessão expirada'); }
    const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
    const r = await fetch('/api/minha-clinica', { headers });
    const j = await r.json();
    if (!r.ok || !j.clinica_id) throw new Error('Não foi possível identificar seu negócio');
    return { headers, clinicaId: j.clinica_id as string };
  }, [router]);
  const carregar = useCallback(async () => {
    setCarregando(true); setErro(''); setDados(null);
    try {
      const { headers, clinicaId } = await sessao();
      const r = await fetch(`/api/atribuicao?clinica_id=${encodeURIComponent(clinicaId)}`, { headers, cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Atribuição indisponível');
      setDados(j);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar a atribuição'); }
    finally { setCarregando(false); }
  }, [sessao]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function registrar(evento: React.FormEvent) {
    evento.preventDefault(); setSalvando(true); setErro(''); setSucesso('');
    try {
      const { headers, clinicaId } = await sessao();
      const r = await fetch('/api/atribuicao/vinculos', { method: 'POST', headers,
        body: JSON.stringify({ clinica_id: clinicaId, origemId, entidadeTipo: tipo, entidadeId, evidencia }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Não foi possível registrar o vínculo');
      setSucesso('Evidência registrada. O vínculo não altera a venda nem confirma causalidade do anúncio.');
      setEvidencia(''); await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao registrar'); }
    finally { setSalvando(false); }
  }
  const origemLabel = (id: string) => {
    const o = dados?.origens.find(item => item.id === id);
    return o ? `${o.source || 'Origem sem plataforma'} / ${o.campanha || 'sem campanha'} (${id.slice(0, 8)})` : 'Origem indisponível';
  };
  const r = dados?.relatorio;
  return <AdminShell title="Ads e Atribuição" subtitle="Origem → contato → oportunidade → venda. Google Ads e Meta Ads: não confundir com Google Presença.">
    <style>{`.atr-section{margin:20px 0;padding:16px;border:1px solid #64748b;border-radius:10px}.atr-table{width:100%;border-collapse:collapse}.atr-table th,.atr-table td{text-align:left;padding:9px;border-bottom:1px solid #64748b}.atr-form{display:grid;gap:12px;max-width:720px}.atr-form label{display:grid;gap:5px}.atr-form select,.atr-form textarea{padding:9px;color:#0f172a;background:#fff}.atr-section button{padding:9px 14px;border:1px solid #64748b;border-radius:6px;cursor:pointer}`}</style>
    <p>Identificadores e UTMs são marcações capturadas, não confirmação da plataforma. Receita atribuída indica vínculo rastreável, não causalidade. CAC/ROAS: — (gastos não integrados).</p>
    <p>{CONEXOES_ADS_V1.map(c => `${labels[c.plataforma]}: integração oficial não conectada`).join(' · ')}</p>
    {carregando && <PageLoader title="Conferindo origens e resultados..." />}
    {erro && <Feedback type="erro" message={erro} />}
    {sucesso && <Feedback type="sucesso" message={sucesso} />}
    {!carregando && <button onClick={carregar} disabled={salvando}>Atualizar dados</button>}
    {!carregando && dados && r && <>
      <section className="atr-section" aria-label="Receita atribuída">
        <p>Receita com vínculo: <strong>{dinheiro(r.receitaAtribuidaCentavos)}</strong> · Receita sem atribuição: <strong>{dinheiro(r.receitaNaoAtribuidaCentavos)}</strong></p>
        <p>{r.capturasSemVinculo} capturas sem contato vinculado. Visita não é lead; conversão abaixo significa pagamento registrado no sistema.</p>
        {r.linhas.length === 0 ? <EmptyState icon="📊" title="Nenhuma origem capturada" description="Sem evidência, pagamentos permanecem sem atribuição." /> : <div style={{ overflowX: 'auto' }}><table className="atr-table">
          <thead><tr><th>Plataforma</th><th>Campanha / anúncio</th><th>Capturas</th><th>Leads</th><th>Clientes</th><th>Oportunidades</th><th>Orçamentos</th><th>Pedidos</th><th>Agenda</th><th>Conversões</th><th>Receita</th></tr></thead>
          <tbody>{r.linhas.map(l => <tr key={l.chave}><td>{labels[l.plataforma]}{l.fonte ? ` · ${l.fonte}` : ""}</td><td>{l.campanha || 'Não identificada'} / {l.anuncio || 'Não identificado'}</td><td>{l.capturas}</td><td>{l.leads}</td><td>{l.clientes}</td><td>{l.oportunidades}</td><td>{l.orcamentos}</td><td>{l.pedidos}</td><td>{l.agendamentos}</td><td>{l.conversoes}</td><td>{dinheiro(l.receitaCentavos)}</td></tr>)}</tbody>
        </table></div>}
      </section>
      <section className="atr-section"><h2>Pagamentos e evidência</h2>
        {r.pagamentos.length === 0 && <p>Nenhum pagamento comprovado nos dados carregados.</p>}
        <ul>{r.pagamentos.map(p => <li key={`${p.tipo}:${p.id}`}>
          {p.nome} · {labels[p.tipo]} {p.id} · {p.valorCentavos === null ? 'Valor inválido' : dinheiro(p.valorCentavos)} · {p.origemId ? origemLabel(p.origemId) : 'Não atribuído'}<br />
          {p.motivo}. Trilha: {p.trilha.map(t => `${t.etapa} ${t.id}`).join(' → ')}
        </li>)}</ul>
      </section>
      <section className="atr-section"><h2>Clientes e etapas comerciais</h2>
        <p>Vínculo de cliente não atribui automaticamente todos os seus pagamentos. Etapas sem evidência e conflitos permanecem explícitos.</p>
        <details><summary>Ver {r.trilhas.length} registros, incluindo não atribuídos</summary><ul>{r.trilhas.map(t => <li key={`${t.tipo}:${t.id}`}>{labels[t.tipo]} · {t.nome} · {t.id} — {t.estado === 'vinculado' ? origemLabel(t.origens[0]) : t.estado === 'incerto' ? 'Incerto: origens conflitantes' : 'Não atribuído'}</li>)}</ul></details>
      </section>
      {dados.origens.length > 0 && <section className="atr-section"><h2>Registrar vínculo com evidência</h2>
        <p>Use somente uma referência verificável. O sistema preserva autoria e evidência; uma origem existente não será sobrescrita.</p>
        <form className="atr-form" onSubmit={registrar}>
          <label>Origem capturada<select required value={origemId} onChange={e => setOrigemId(e.target.value)}><option value="">Selecione</option>{dados.origens.map(o => <option key={o.id} value={o.id}>{origemLabel(o.id)} · {o.capturadoEm}</option>)}</select></label>
          <label>Etapa<select value={tipo} onChange={e => { setTipo(e.target.value as TipoVinculoAtribuicao); setEntidadeId(''); }}>{TIPOS_VINCULO_ATRIBUICAO.map(t => <option key={t} value={t}>{labels[t]}</option>)}</select></label>
          <label>Registro do seu negócio<select required value={entidadeId} onChange={e => setEntidadeId(e.target.value)}><option value="">Selecione</option>{r.trilhas.filter(t => t.tipo === tipo).map(t => <option key={t.id} value={t.id}>{t.nome} · {t.id}</option>)}</select></label>
          <label>Evidência / referência<textarea required minLength={10} maxLength={500} value={evidencia} onChange={e => setEvidencia(e.target.value)} placeholder="Referência verificável que relaciona esta origem ao registro" /></label>
          <button disabled={salvando}>{salvando ? 'Registrando...' : 'Registrar evidência'}</button>
        </form>
        <details><summary>Evidências registradas ({dados.vinculos.length})</summary><ul>{dados.vinculos.map(v => <li key={`${v.entidadeTipo}:${v.entidadeId}:${v.origemId}`}>{labels[v.entidadeTipo]} {v.entidadeId} → {origemLabel(v.origemId)} · {v.metodo === 'codigo_site' ? 'Código retornado no site' : 'Declaração do operador'} · {v.evidencia}</li>)}</ul></details>
      </section>}
    </>}
  </AdminShell>;
}
