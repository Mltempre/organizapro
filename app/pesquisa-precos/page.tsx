"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import PageLoader from "../components/PageLoader";
import EmptyState from "../components/EmptyState";
import Feedback, { MSG_ERRO_PADRAO } from "../components/Feedback";
import { TIPOS_FONTE_PRECO, UNIDADES_PESQUISA, type EstadoComparacao } from "../../lib/pesquisa-precos";

type Item = { id: string; nome: string; especificacao: string | null; unidade_canonica: string; servico_id: string | null };
type Catalogo = { id: string; nome: string };
type Fonte = { id: string; nome: string; tipo: string; referencia: string | null };
type Historico = {
  id: string; item_id: string; fonte_id: string; preco_centavos: number; moeda: string;
  quantidade: number; unidade_observada: string; observado_em: string;
  evidencia_referencia: string | null; comparavel: boolean; preco_normalizado_centavos: number | null;
  motivo_nao_comparavel: string | null; corrige_observacao_id: string | null;
  fonte: Fonte | null;
};
type Comparavel = {
  id: string; fonteId: string; fonteNome: string; precoCentavos: number; quantidade: number;
  unidadeObservada: string; unidadeCanonica: string; moeda: string; observadoEm: string;
  precoNormalizadoCentavos: number; antigo: boolean;
};
type Comparacao = { estado: EstadoComparacao; comparaveis: Comparavel[]; naoComparaveis: { id: string; motivo: string }[]; fontesDistintas: number };

const card = { background: "#151923", border: "1px solid #252b3a", borderRadius: 14, padding: 20 };
const input = { width: "100%", background: "#0f1117", border: "1px solid #303748", borderRadius: 9, color: "#e2e8f0", padding: "11px 12px", fontSize: 14 };
const label = { display: "grid", gap: 6, color: "#94a3b8", fontSize: 12, fontWeight: 600 };

function agoraLocal(): string {
  const data = new Date();
  return new Date(data.getTime() - data.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function reaisParaCentavos(valor: string): number | null {
  const numero = Number(valor.trim().replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return Math.round(numero * 100);
}

function moeda(centavos: number, codigo = "BRL"): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: codigo });
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const ESTADOS: Record<EstadoComparacao, string> = {
  sem_observacoes: "Sem observações registradas",
  sem_observacoes_comparaveis: "Sem observações comparáveis",
  dados_antigos: "Somente dados antigos — atualize as fontes antes de decidir",
  fonte_insuficiente: "Fonte insuficiente — registre ao menos dois fornecedores atuais",
  comparacao_disponivel: "Comparação disponível com fontes rastreáveis",
};

export default function PesquisaPrecosPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [catalogo, setCatalogo] = useState<Catalogo[]>([]);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [itemSelecionado, setItemSelecionado] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);

  const [novoItem, setNovoItem] = useState({ nome: "", especificacao: "", unidade: "un", servicoId: "" });
  const [novaFonte, setNovaFonte] = useState({ nome: "", tipo: "manual", referencia: "" });
  const [observacao, setObservacao] = useState({ fonteId: "", preco: "", quantidade: "1", unidade: "un", observadoEm: agoraLocal(), evidencia: "", corrigeId: "" });

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const itemAtual = itens.find((item) => item.id === itemSelecionado) ?? null;

  const carregarHistorico = useCallback(async (accessToken: string, itemId: string) => {
    if (!itemId) { setHistorico([]); setComparacao(null); return; }
    const resposta = await fetch(`/api/pesquisa-precos/observacoes?item_id=${encodeURIComponent(itemId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await resposta.json();
    if (!resposta.ok) throw new Error(json.error || "Falha ao carregar histórico");
    setHistorico(Array.isArray(json.historico) ? json.historico : []);
    setComparacao(json.comparacao ?? null);
  }, []);

  const carregarBase = useCallback(async (itemPreferido?: string) => {
    try {
      setCarregando(true); setErro("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push("/login"); return; }
      const accessToken = session.access_token;
      setToken(accessToken);
      const [itensRes, fontesRes] = await Promise.all([
        fetch("/api/pesquisa-precos/itens", { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch("/api/pesquisa-precos/fontes", { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      const itensJson = await itensRes.json();
      const fontesJson = await fontesRes.json();
      if (!itensRes.ok || !fontesRes.ok) throw new Error(itensJson.error || fontesJson.error || "Falha ao carregar");
      const recebidos = Array.isArray(itensJson.itens) ? itensJson.itens as Item[] : [];
      setItens(recebidos);
      setCatalogo(Array.isArray(itensJson.catalogo) ? itensJson.catalogo : []);
      setFontes(Array.isArray(fontesJson.fontes) ? fontesJson.fontes : []);
      const proximoItem = itemPreferido && recebidos.some((i) => i.id === itemPreferido)
        ? itemPreferido
        : recebidos[0]?.id ?? "";
      setItemSelecionado(proximoItem);
      const selecionado = recebidos.find((item) => item.id === proximoItem);
      if (selecionado) {
        setObservacao((atual) => atual.corrigeId ? atual : { ...atual, unidade: selecionado.unidade_canonica });
      }
      await carregarHistorico(accessToken, proximoItem);
    } catch (e) {
      console.error(e);
      setErro(e instanceof Error ? e.message : MSG_ERRO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [carregarHistorico, router]);

  useEffect(() => { void carregarBase(); }, [carregarBase]);

  async function enviar(url: string, body: Record<string, unknown>) {
    const resposta = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await resposta.json();
    if (!resposta.ok || !json.sucesso) throw new Error(json.error || MSG_ERRO_PADRAO);
    return json;
  }

  async function criarItem(evento: FormEvent) {
    evento.preventDefault();
    if (salvandoRef.current) return;
    salvandoRef.current = true; setSalvando(true); setErro("");
    try {
      const json = await enviar("/api/pesquisa-precos/itens", {
        nome: novoItem.nome, especificacao: novoItem.especificacao || undefined,
        unidade_canonica: novoItem.unidade, servico_id: novoItem.servicoId || undefined,
      });
      setNovoItem({ nome: "", especificacao: "", unidade: "un", servicoId: "" });
      setSucesso("Item de pesquisa criado.");
      await carregarBase(json.item.id);
    } catch (e) { setErro(e instanceof Error ? e.message : MSG_ERRO_PADRAO); }
    finally { salvandoRef.current = false; setSalvando(false); }
  }

  async function criarFonte(evento: FormEvent) {
    evento.preventDefault();
    if (salvandoRef.current) return;
    salvandoRef.current = true; setSalvando(true); setErro("");
    try {
      const json = await enviar("/api/pesquisa-precos/fontes", novaFonte);
      setNovaFonte({ nome: "", tipo: "manual", referencia: "" });
      setObservacao((atual) => ({ ...atual, fonteId: json.fonte.id }));
      setSucesso("Fonte cadastrada.");
      await carregarBase(itemSelecionado);
    } catch (e) { setErro(e instanceof Error ? e.message : MSG_ERRO_PADRAO); }
    finally { salvandoRef.current = false; setSalvando(false); }
  }

  async function registrarObservacao(evento: FormEvent) {
    evento.preventDefault();
    if (salvandoRef.current || !itemAtual) return;
    const precoCentavos = reaisParaCentavos(observacao.preco);
    const quantidade = Number(observacao.quantidade.replace(",", "."));
    if (!precoCentavos) { setErro("Informe um preço maior que zero."); return; }
    if (!Number.isFinite(quantidade) || quantidade <= 0) { setErro("Informe uma quantidade maior que zero."); return; }
    salvandoRef.current = true; setSalvando(true); setErro("");
    try {
      await enviar("/api/pesquisa-precos/observacoes", {
        item_id: itemAtual.id, fonte_id: observacao.fonteId, preco_centavos: precoCentavos,
        moeda: "BRL", quantidade, unidade_observada: observacao.unidade,
        observado_em: new Date(observacao.observadoEm).toISOString(),
        evidencia_referencia: observacao.evidencia || undefined,
        corrige_observacao_id: observacao.corrigeId || undefined,
        chave_idempotencia: crypto.randomUUID(),
      });
      setObservacao({ fonteId: observacao.fonteId, preco: "", quantidade: "1", unidade: itemAtual.unidade_canonica, observadoEm: agoraLocal(), evidencia: "", corrigeId: "" });
      setSucesso("Preço observado registrado no histórico.");
      await carregarHistorico(token, itemAtual.id);
    } catch (e) { setErro(e instanceof Error ? e.message : MSG_ERRO_PADRAO); }
    finally { salvandoRef.current = false; setSalvando(false); }
  }

  async function selecionarItem(id: string) {
    setItemSelecionado(id); setErro("");
    const item = itens.find((i) => i.id === id);
    if (item) setObservacao((atual) => ({ ...atual, unidade: item.unidade_canonica, corrigeId: "" }));
    try { await carregarHistorico(token, id); }
    catch (e) { setErro(e instanceof Error ? e.message : MSG_ERRO_PADRAO); }
  }

  function corrigir(registro: Historico) {
    setObservacao({
      fonteId: registro.fonte_id,
      preco: (registro.preco_centavos / 100).toFixed(2).replace(".", ","),
      quantidade: String(registro.quantidade),
      unidade: registro.unidade_observada,
      observadoEm: agoraLocal(),
      evidencia: registro.evidencia_referencia ?? "",
      corrigeId: registro.id,
    });
    document.getElementById("nova-observacao")?.scrollIntoView({ behavior: "smooth" });
  }

  if (carregando) return <PageLoader title="Carregando pesquisa de preços..." subtitle="Consultando somente fontes registradas pelo seu negócio" />;

  return (
    <main className="pp-root">
      <style>{`
        .pp-root{min-height:100vh;background:#0f1117;color:#e2e8f0;padding:28px;font-family:Inter,sans-serif}
        .pp-wrap{max-width:1180px;margin:0 auto}.pp-grid{display:grid;grid-template-columns:340px 1fr;gap:18px}
        .pp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pp-span{grid-column:1/-1}
        .pp-btn{border:0;border-radius:9px;background:#1f4e5f;color:white;padding:11px 16px;font-weight:700;cursor:pointer}
        .pp-btn:disabled{opacity:.55;cursor:not-allowed}.pp-secondary{background:transparent;border:1px solid #384155;color:#94a3b8}
        .pp-table{width:100%;border-collapse:collapse}.pp-table th,.pp-table td{text-align:left;padding:11px 10px;border-bottom:1px solid #252b3a;font-size:12px;vertical-align:top}
        .pp-table th{color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
        @media(max-width:800px){.pp-root{padding:16px}.pp-grid,.pp-form-grid{grid-template-columns:1fr}.pp-span{grid-column:auto}.pp-table{display:block;overflow-x:auto;white-space:nowrap}}
      `}</style>
      <div className="pp-wrap">
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: "#4a9bb0", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>INTELIGÊNCIA DE COMPRAS</div>
          <h1 style={{ margin: "6px 0", fontSize: 28 }}>Pesquisa de Preços</h1>
          <p style={{ color: "#64748b", margin: 0, maxWidth: 760 }}>Registre observações rastreáveis e compare somente unidades compatíveis. O sistema não pesquisa a internet nem altera seus preços de venda.</p>
        </header>
        {erro && <Feedback type="erro" message={erro} onClose={() => setErro("")} />}
        {sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso("")} autoCloseMs={4000} />}

        <div className="pp-grid">
          <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <section style={card}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Itens pesquisados</h2>
              {itens.length > 0 ? <select style={input} value={itemSelecionado} onChange={(e) => void selecionarItem(e.target.value)}>
                {itens.map((item) => <option key={item.id} value={item.id}>{item.nome} · por {item.unidade_canonica}</option>)}
              </select> : <p style={{ color: "#64748b", fontSize: 13 }}>Cadastre o primeiro item abaixo.</p>}
            </section>

            <details style={card} open={itens.length === 0}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Novo item</summary>
              <form onSubmit={criarItem} style={{ display: "grid", gap: 11, marginTop: 16 }}>
                <label style={label}>Nome<input style={input} required maxLength={160} value={novoItem.nome} onChange={(e) => setNovoItem({ ...novoItem, nome: e.target.value })} /></label>
                <label style={label}>Especificação<textarea style={input} maxLength={1000} rows={3} value={novoItem.especificacao} onChange={(e) => setNovoItem({ ...novoItem, especificacao: e.target.value })} /></label>
                <label style={label}>Unidade de comparação<select style={input} value={novoItem.unidade} onChange={(e) => setNovoItem({ ...novoItem, unidade: e.target.value })}>{UNIDADES_PESQUISA.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label style={label}>Vínculo opcional com serviço<select style={input} value={novoItem.servicoId} onChange={(e) => setNovoItem({ ...novoItem, servicoId: e.target.value })}><option value="">Sem vínculo</option>{catalogo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
                <button className="pp-btn" disabled={salvando}>Criar item</button>
              </form>
            </details>

            <details style={card} open={fontes.length === 0}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Nova fonte</summary>
              <form onSubmit={criarFonte} style={{ display: "grid", gap: 11, marginTop: 16 }}>
                <label style={label}>Fornecedor/estabelecimento<input style={input} required maxLength={160} value={novaFonte.nome} onChange={(e) => setNovaFonte({ ...novaFonte, nome: e.target.value })} /></label>
                <label style={label}>Tipo<select style={input} value={novaFonte.tipo} onChange={(e) => setNovaFonte({ ...novaFonte, tipo: e.target.value })}>{TIPOS_FONTE_PRECO.map((tipo) => <option key={tipo} value={tipo}>{tipo.replaceAll("_", " ")}</option>)}</select></label>
                <label style={label}>Referência/evidência<input style={input} maxLength={2000} placeholder="URL, número da cotação ou documento" value={novaFonte.referencia} onChange={(e) => setNovaFonte({ ...novaFonte, referencia: e.target.value })} /></label>
                <button className="pp-btn" disabled={salvando}>Cadastrar fonte</button>
              </form>
            </details>
          </aside>

          <div style={{ display: "grid", gap: 18, alignContent: "start", minWidth: 0 }}>
            {itemAtual && fontes.length > 0 ? <section id="nova-observacao" style={card}>
              <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>{observacao.corrigeId ? "Registrar correção" : "Registrar preço observado"}</h2>
              <p style={{ color: "#64748b", fontSize: 12, marginTop: 0 }}>Uma correção cria uma nova linha e preserva o registro anterior.</p>
              <form className="pp-form-grid" onSubmit={registrarObservacao}>
                <label style={label}>Fonte<select style={input} required value={observacao.fonteId} onChange={(e) => setObservacao({ ...observacao, fonteId: e.target.value })}><option value="">Selecione</option>{fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
                <label style={label}>Preço observado (R$)<input style={input} required inputMode="decimal" placeholder="0,00" value={observacao.preco} onChange={(e) => setObservacao({ ...observacao, preco: e.target.value })} /></label>
                <label style={label}>Quantidade<input style={input} required inputMode="decimal" value={observacao.quantidade} onChange={(e) => setObservacao({ ...observacao, quantidade: e.target.value })} /></label>
                <label style={label}>Unidade observada<select style={input} value={observacao.unidade} onChange={(e) => setObservacao({ ...observacao, unidade: e.target.value })}>{UNIDADES_PESQUISA.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label style={label}>Data e hora<input style={input} required type="datetime-local" value={observacao.observadoEm} onChange={(e) => setObservacao({ ...observacao, observadoEm: e.target.value })} /></label>
                <label style={label}>Evidência complementar<input style={input} maxLength={2000} placeholder="URL ou referência" value={observacao.evidencia} onChange={(e) => setObservacao({ ...observacao, evidencia: e.target.value })} /></label>
                <div className="pp-span" style={{ display: "flex", gap: 10 }}>
                  <button className="pp-btn" disabled={salvando}>{salvando ? "Salvando..." : "Registrar observação"}</button>
                  {observacao.corrigeId && <button type="button" className="pp-btn pp-secondary" onClick={() => setObservacao({ ...observacao, corrigeId: "", preco: "" })}>Cancelar correção</button>}
                </div>
              </form>
            </section> : itens.length === 0 ? <section style={card}><EmptyState icon="🔎" title="Nenhum item pesquisado" description="Crie um item para começar. Nenhum preço será preenchido automaticamente." compact /></section> : <section style={card}><EmptyState icon="🏪" title="Nenhuma fonte cadastrada" description="Cadastre um fornecedor ou estabelecimento rastreável antes de registrar preços." compact /></section>}

            {itemAtual && <section style={card}>
              <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Comparação por {itemAtual.unidade_canonica}</h2>
              <p style={{ color: comparacao?.estado === "comparacao_disponivel" ? "#4ade80" : "#fbbf24", fontSize: 13 }}>{comparacao ? ESTADOS[comparacao.estado] : "Sem observações"}</p>
              {comparacao?.comparaveis.length ? <div style={{ overflowX: "auto" }}><table className="pp-table"><thead><tr><th>Fonte</th><th>Preço original</th><th>Normalizado</th><th>Data</th><th>Estado</th></tr></thead><tbody>{comparacao.comparaveis.map((linha) => <tr key={linha.id}><td>{linha.fonteNome}</td><td>{moeda(linha.precoCentavos, linha.moeda)} / {linha.quantidade} {linha.unidadeObservada}</td><td style={{ color: "#4ade80", fontWeight: 700 }}>{moeda(linha.precoNormalizadoCentavos, linha.moeda)} / {linha.unidadeCanonica}</td><td>{dataHora(linha.observadoEm)}</td><td>{linha.antigo ? "Dado antigo" : "Atual"}</td></tr>)}</tbody></table></div> : <EmptyState icon="⚖️" title="Sem comparação disponível" description="Observações incompatíveis permanecem no histórico e não entram no ranking." compact />}
            </section>}

            {itemAtual && <section style={card}>
              <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Histórico imutável</h2>
              {historico.length ? <div style={{ overflowX: "auto" }}><table className="pp-table"><thead><tr><th>Fonte</th><th>Observação</th><th>Comparabilidade</th><th>Evidência</th><th></th></tr></thead><tbody>{historico.map((linha) => <tr key={linha.id}><td>{linha.fonte?.nome ?? "Fonte indisponível"}</td><td><strong>{moeda(linha.preco_centavos, linha.moeda)}</strong><br />{linha.quantidade} {linha.unidade_observada} · {dataHora(linha.observado_em)}{linha.corrige_observacao_id && <><br /><span style={{ color: "#fbbf24" }}>Correção de registro anterior</span></>}</td><td>{linha.comparavel ? <span style={{ color: "#4ade80" }}>Comparável</span> : <span style={{ color: "#fbbf24" }}>Não comparável: {linha.motivo_nao_comparavel?.replaceAll("_", " ")}</span>}</td><td style={{ maxWidth: 220, overflowWrap: "anywhere" }}>{linha.evidencia_referencia || linha.fonte?.referencia || "Registro manual por usuário autenticado"}</td><td><button type="button" className="pp-btn pp-secondary" onClick={() => corrigir(linha)}>Corrigir</button></td></tr>)}</tbody></table></div> : <EmptyState icon="🧾" title="Sem observações" description="O histórico aparecerá após o primeiro registro real." compact />}
            </section>}
          </div>
        </div>
      </div>
    </main>
  );
}
