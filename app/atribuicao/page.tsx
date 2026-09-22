'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AdminShell from '../components/AdminShell';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import Feedback, { MSG_ERRO_PADRAO } from '../components/Feedback';
import { agregarAtribuicao, type LinhaRelatorioAtribuicao, type OrigemCaptacaoResumo } from '../../lib/atribuicao-relatorio';

// ── Atribuição V1 (P1.3) · Google/Meta Ads ≠ Google Presença ────────────
// Esta tela é sobre ORIGEM DE CAMPANHA (UTM/gclid/fbclid → lead → receita
// comprovada) — Google Business Profile/avaliações/reputação continuam
// em /google-presenca, um domínio completamente diferente, nunca
// confundido aqui. Nenhum motor novo: lib/atribuicao-origem.ts (captura/
// classificação) e lib/origem-persistencia.ts (persistência) já existem
// e já rodam em produção via app/empresa/[slug] e o webhook do chatbot —
// esta tela só lê o que já foi capturado (via /api/atribuicao) e
// consolida com receita real já comprovada (mesma cobrança paga que o
// Bloco Dinheiro usa, via /api/cobrancas). Nenhum gasto de mídia é
// fabricado: sem integração real com a API de Ads do Google/Meta
// (bloqueado por falta de OAuth/credenciais nesta versão), CAC/ROAS
// ficam sempre "—", nunca um número inventado.

type CobrancaRow = { id: string; paciente_id: string | null; status: string; valor_pago: number | null };

const LABELS: Record<string, { label: string; icon: string }> = {
  google_ads: { label: 'Google Ads', icon: '🔴' },
  meta_ads: { label: 'Meta Ads', icon: '🔵' },
  campanha_utm: { label: 'Campanha (UTM manual)', icon: '🏷️' },
  busca_organica: { label: 'Busca orgânica', icon: '🔍' },
  referencia: { label: 'Referência (outro site)', icon: '🔗' },
  direto: { label: 'Direto', icon: '➡️' },
};

function formatarValor(centavos: number) { return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function AtribuicaoPage() {
  const router = useRouter();
  const [linhas, setLinhas] = useState<LinhaRelatorioAtribuicao[] | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true); setErro('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.push('/login'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push('/login'); return; }
      const auth = { Authorization: `Bearer ${session.access_token}` };

      const cuRes = await fetch('/api/minha-clinica', { headers: auth });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      if (!cid) { setLinhas(null); setErro('Negócio não vinculado ao usuário.'); setCarregando(false); return; }

      const [atribuicaoRes, cobrancasRes] = await Promise.all([
        fetch(`/api/atribuicao?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { indisponivel: true, origens: [] }).catch(() => ({ indisponivel: true, origens: [] })),
        fetch(`/api/cobrancas?clinica_id=${cid}`, { headers: auth }).then(r => r.ok ? r.json() : { cobrancas: [] }).catch(() => ({ cobrancas: [] })),
      ]);

      setIndisponivel(!!atribuicaoRes.indisponivel);
      const origens: OrigemCaptacaoResumo[] = atribuicaoRes.origens ?? [];
      const cobrancas: CobrancaRow[] = cobrancasRes.cobrancas ?? [];

      // Receita comprovada = soma real de cobranças pagas por paciente,
      // convertida para centavos (mesmo fato que o Bloco Dinheiro trata
      // como "recebido" — nunca orçamento apresentado, nunca estimativa).
      const receitaPorPaciente: Record<string, number> = {};
      for (const c of cobrancas) {
        if (c.status !== 'pago' || !c.paciente_id || !c.valor_pago) continue;
        receitaPorPaciente[c.paciente_id] = (receitaPorPaciente[c.paciente_id] ?? 0) + Math.round(c.valor_pago * 100);
      }

      setLinhas(agregarAtribuicao(origens, receitaPorPaciente));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AuthSessionMissingError') { router.push('/login'); return; }
      console.error(err);
      setErro(MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <AdminShell title="Atribuição" subtitle="De onde vêm seus clientes reais — Google Ads, Meta Ads e campanhas (não confundir com Google Presença/avaliações)">
      {carregando && <PageLoader title="Consolidando origens reais..." />}
      {!carregando && erro && <Feedback type="erro" message={erro} onClose={() => setErro('')} />}

      {!carregando && !erro && indisponivel && (
        <EmptyState icon="🚧" title="Rastreamento de origem ainda não ativado." description="A captura de origem (UTM, Google Ads, Meta Ads) já está pronta no código e rodando no seu site — falta apenas a etapa de banco de dados ser ativada. Fale com o suporte para ativar." />
      )}

      {!carregando && !erro && !indisponivel && linhas && linhas.length === 0 && (
        <EmptyState icon="📊" title="Nenhuma captura de origem registrada ainda." description="Assim que alguém chegar ao seu site por um anúncio ou campanha com UTM, a origem aparecerá aqui." />
      )}

      {!carregando && !erro && !indisponivel && linhas && linhas.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            &quot;Vinculado&quot; conta só atribuição <strong>comprovada</strong> (o cliente confirmou o código de rastreio ao chamar no WhatsApp) — esta versão nunca infere origem por suposição.
            CAC/ROAS aparecem como <strong>—</strong> porque ainda não há integração real com o gasto de mídia do Google Ads/Meta Ads (nenhum número é fabricado).
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {linhas.map(l => {
              const info = LABELS[l.classificacao];
              return (
                <div key={l.classificacao} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#1e2130', border: '1px solid #2d3148', borderRadius: 10, padding: '14px 18px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 180, fontSize: 13, color: '#f1f5f9', fontWeight: 700 }}>{info.icon} {info.label}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{l.totalCapturas} captura{l.totalCapturas !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{l.totalVinculados} vinculada{l.totalVinculados !== 1 ? 's' : ''} (comprovado)</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: l.receitaComprovadaCentavos > 0 ? '#4ade80' : '#64748b' }}>{formatarValor(l.receitaComprovadaCentavos)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>CAC: {l.cac !== null ? formatarValor(l.cac) : '—'} · ROAS: {l.roas !== null ? l.roas.toFixed(2) : '—'}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </AdminShell>
  );
}
