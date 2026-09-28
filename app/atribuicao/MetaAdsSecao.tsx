"use client";

// ── Meta Ads V1 — seção de conexão/leitura dentro de /atribuicao ───────────
// Reusa o shell e a superfície "Ads e Atribuição" (nenhuma nav nova).
// Estados honestos, sem dados fictícios:
//   • aguardando configuração do servidor → vazio acionável sem botão;
//   • não conectado → botão "Conectar conta Meta" (OAuth real);
//   • conectado → campanhas + gasto/impressões/alcance/cliques lidos da Meta
//     + colunas de atribuição só por correspondência EXATA de campaign_id;
//   • falha de leitura → aviso explícito, tabela suprimida (nunca zeros);
//   • permissão recusada pela Meta → dependência de App Review declarada.
import { useCallback, useEffect, useState } from "react";
import {
  juntarAtribuicaoMeta,
  formatarGastoMeta,
  formatarNumeroMeta,
  totalGastoMeta,
  type LinhaAtribuicaoMeta,
  type MetricaCampanha,
} from "../../lib/meta-ads-metricas";

type ResumoMeta = {
  estado: string;
  detalhe: string;
  conexao: { contaNome: string | null; conectadoEm: string | null } | null;
  metricas: { periodo: string; moeda: string | null; campanhas: MetricaCampanha[] } | null;
  erroMetricas: boolean;
};

type Props = {
  sessao: () => Promise<{ headers: Record<string, string>; clinicaId: string }>;
  linhas: LinhaAtribuicaoMeta[];
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  DELETED: "Removida",
  IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com pendências",
};

const AVISOS_URL: Record<string, string> = {
  connected: "Conta de anúncios Meta conectada com sucesso.",
  denied: "Autorização cancelada na Meta. Nada foi gravado.",
  sem_conta: "Nenhuma conta de anúncios ativa foi encontrada na conta autorizada. Nada foi gravado.",
  persistencia: "Não foi possível gravar a conexão. Tente novamente.",
  configuracao: "A integração Meta Ads ainda não está configurada no servidor.",
  oauth: "A conexão expirou ou não pôde ser validada. Inicie a conexão novamente.",
  erro: "Não foi possível concluir a conexão com a Meta.",
};

export default function MetaAdsSecao({ sessao, linhas }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [resumo, setResumo] = useState<ResumoMeta | null>(null);
  const [conectando, setConectando] = useState(false);
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const { headers, clinicaId } = await sessao();
      const r = await fetch(`/api/meta-ads?clinica_id=${encodeURIComponent(clinicaId)}`, { headers, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Não foi possível ler o estado da integração Meta");
      setResumo(j as ResumoMeta);
    } catch (e) {
      setResumo(null);
      setErro(e instanceof Error ? e.message : "Não foi possível ler o estado da integração Meta");
    } finally {
      setCarregando(false);
    }
  }, [sessao]);

  useEffect(() => {
    // Retorno do OAuth (?meta_status=) — texto honesto fixo por enum, nunca
    // eco do que a Meta devolveu. "connected" já recarrega o estado real.
    if (typeof window !== "undefined") {
      const status = new URLSearchParams(window.location.search).get("meta_status");
      if (status && AVISOS_URL[status]) setAviso(AVISOS_URL[status]);
      if (status === "connected") { void carregar(); return; }
    }
    void carregar();
  }, [carregar]);

  async function conectar() {
    setConectando(true);
    setErro("");
    setAviso("");
    try {
      const { headers, clinicaId } = await sessao();
      const r = await fetch("/api/meta-ads/oauth/start", {
        method: "POST",
        headers,
        body: JSON.stringify({ clinica_id: clinicaId }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.url) throw new Error(j?.error || "Não foi possível iniciar a conexão");
      window.location.href = j.url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar a conexão");
      setConectando(false);
    }
  }

  const juntas = resumo?.metricas ? juntarAtribuicaoMeta(resumo.metricas.campanhas, linhas) : [];
  const totalGasto = resumo?.metricas ? totalGastoMeta(resumo.metricas.campanhas) : null;
  const dinheiro = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const periodoLabel = resumo?.metricas?.periodo === "last_30d" ? "últimos 30 dias" : resumo?.metricas?.periodo ?? "";
  const botaoConectar = (rotulo: string) => (
    <button type="button" data-testid="meta-conectar" onClick={conectar} disabled={conectando}>
      {conectando ? "Abrindo autorização…" : rotulo}
    </button>
  );

  return (
    <section className="atr-section" aria-label="Meta Ads">
      <h2>Meta Ads</h2>
      <p style={{ fontSize: 13 }}>
        Gasto vem da API oficial da Meta (leitura <code>ads_read</code>); leads e receita vêm das capturas e do
        relatório de atribuição deste painel. Correspondência entre os dois só por <strong>campaign_id exato</strong>.
      </p>
      {aviso && <p role="status">{aviso}</p>}
      {carregando && <p>Verificando a conexão com a Meta…</p>}
      {!carregando && erro && <p role="alert">{erro}</p>}
      {!carregando && !erro && resumo && resumo.estado === "nao_configurada" && resumo.detalhe === "configuracao_ausente" && (
        <p>
          ⚙️ <strong>Meta Ads aguardando configuração.</strong> A integração oficial ainda não foi habilitada no
          servidor — nada está conectado e nenhum número é exibido. Quando habilitada, você conecta sua conta de
          anúncios aqui.
        </p>
      )}
      {!carregando && !erro && resumo && resumo.estado === "nao_configurada" && resumo.detalhe === "sem_conexao" && (
        <>
          <p>🔌 Conta de anúncios não conectada. Conecte para ler campanhas, status, gasto, impressões, alcance e cliques.</p>
          {botaoConectar("Conectar conta Meta")}
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 10 }}>
            Escopo mínimo <code>ads_read</code> (somente leitura). Criar ou editar campanhas não faz parte deste V1 e
            depende de aprovação oficial da Meta (App Review). Conectar contas de clientes também depende de Advanced
            Access (App Review + Business Verification) — contas de quem tem papel no app conectam com o acesso padrão.
          </p>
        </>
      )}
      {!carregando && !erro && resumo && resumo.estado === "revogada" && (
        <>
          <p role="alert">🔌 A conexão não pôde ser validada (credencial inválida ou revogada). Nenhum dado foi lido.</p>
          {botaoConectar("Reconectar conta Meta")}
        </>
      )}
      {!carregando && !erro && resumo && resumo.estado === "pendente_homologacao" && (
        <>
          <p role="alert">
            ⏳ A Meta não liberou a leitura desta conta para o app (permissão <code>ads_read</code>). Para contas de
            clientes isso depende de App Review / Advanced Access. Nenhum número foi lido nem estimado.
          </p>
          {botaoConectar("Tentar reconectar")}
        </>
      )}
      {!carregando && !erro && resumo && resumo.estado === "conectada" && (
        <>
          <p>
            ✅ Conectada: <strong>{resumo.conexao?.contaNome ?? "conta de anúncios"}</strong> · leitura: {periodoLabel}
            {" · "}
            <button type="button" data-testid="meta-atualizar" onClick={() => void carregar()} disabled={carregando}>
              Atualizar métricas
            </button>{" "}
            {botaoConectar("Reconectar conta")}
          </p>
          {resumo.erroMetricas && (
            <p role="alert">
              ⚠️ Conexão ativa, mas a leitura das métricas falhou agora. Nada foi exibido como zero — tente atualizar.
            </p>
          )}
          {!resumo.erroMetricas && resumo.metricas && resumo.metricas.campanhas.length === 0 && (
            <p>Nenhuma campanha encontrada no período lido.</p>
          )}
          {!resumo.erroMetricas && resumo.metricas && resumo.metricas.campanhas.length > 0 && totalGasto && (
            <>
              <p>
                Gasto lido no período: <strong>{formatarGastoMeta(totalGasto.total, resumo.metricas.moeda)}</strong>
                {totalGasto.semDados > 0 ? ` (soma das campanhas com dados; ${totalGasto.semDados} sem dado no período)` : ""}
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="atr-table">
                  <thead>
                    <tr>
                      <th>Campanha</th><th>Status</th><th>Gasto</th><th>Impressões</th><th>Alcance</th>
                      <th>Cliques</th><th>CTR</th><th>Capturas</th><th>Leads</th><th>Oportunidades</th>
                      <th>Conversões</th><th>Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {juntas.map(({ metrica, atribuicao }) => (
                      <tr key={metrica.campaignId}>
                        <td>{metrica.nome || metrica.campaignId}</td>
                        <td>{(metrica.status && STATUS_LABEL[metrica.status]) || metrica.status || "—"}</td>
                        <td>{formatarGastoMeta(metrica.gasto, resumo.metricas!.moeda)}</td>
                        <td>{formatarNumeroMeta(metrica.impressoes)}</td>
                        <td>{formatarNumeroMeta(metrica.alcance)}</td>
                        <td>{formatarNumeroMeta(metrica.cliques)}</td>
                        <td>{metrica.ctr === null ? "—" : `${metrica.ctr.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</td>
                        <td>{atribuicao ? atribuicao.capturas : "—"}</td>
                        <td>{atribuicao ? atribuicao.leads : "—"}</td>
                        <td>{atribuicao ? atribuicao.oportunidades : "—"}</td>
                        <td>{atribuicao ? atribuicao.conversoes : "—"}</td>
                        <td>{atribuicao ? dinheiro(atribuicao.receitaCentavos) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
                Capturas/leads/oportunidades/conversões/receita aparecem apenas quando o campaign_id capturado no site
                é idêntico ao da Meta — sem correspondência exata o campo fica &quot;—&quot;: o sistema não infere
                relação nem causalidade.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

