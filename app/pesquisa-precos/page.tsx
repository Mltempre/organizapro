"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";
import PageLoader from "../components/PageLoader";
import EmptyState from "../components/EmptyState";
import Feedback, { MSG_ERRO_PADRAO } from "../components/Feedback";
import { TIPOS_FONTE_PRECO, UNIDADES_PESQUISA, type EstadoComparacao } from "../../lib/pesquisa-precos";
import { composicaoEntraNaConta, type EscopoServico, type ReferenciaPreco, type ResumoReferencias, type TipoConsultaPreco } from "../../lib/pesquisa-precos-web";

// Resultado de /api/pesquisa-precos/busca-web (referências reais, validadas no servidor).
type ResultadoBusca = {
  consulta: { termo: string; tipo: TipoConsultaPreco; localidade: string | null; pesquisadoEm: string; especificacao?: string | null; escopo?: EscopoServico | null };
  itemCatalogo: { id: string; nome: string } | null;
  seuPrecoOrigem?: "informado" | "catalogo" | null;
  fatores?: string[];
  referencias: ReferenciaPreco[];
  descartadas: { motivo: string; quantidade: number }[];
  fontesConsultadas: number;
  resumo: ResumoReferencias;
  provedor: { nome: string; modelo: string };
};

// Chave estável e curta para a idempotência do registro (mesma referência = mesma chave).
function chaveReferencia(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return `web:${h.toString(36)}:${texto.length}`;
}

const ROTULO_TIPO_FONTE: Record<string, string> = {
  manual: "Manual", documento: "Documento", cotacao: "Cotação", url_verificada: "URL verificada",
  importacao: "Importação", api_autorizada: "API autorizada",
};

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

// "450" · "450,00" · "1.234,56" · "R$ 1.234,56" → número em reais (null se inválido).
function precoParaNumero(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) && n > 0 ? n : null;
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
  // Falha ao carregar itens/fontes nunca vira "nenhum item" + formulário habilitado.
  const [cargaFalhou, setCargaFalhou] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);

  const [novoItem, setNovoItem] = useState({ nome: "", especificacao: "", unidade: "un", servicoId: "" });
  const [novaFonte, setNovaFonte] = useState({ nome: "", tipo: "manual", referencia: "" });
  const [observacao, setObservacao] = useState({ fonteId: "", preco: "", quantidade: "1", unidade: "un", observadoEm: agoraLocal(), evidencia: "", corrigeId: "" });

  // Busca real na web (produto ou serviço/mão de obra)
  const [busca, setBusca] = useState<{ termo: string; tipo: TipoConsultaPreco; localidade: string; servicoId: string; especificacao: string; seuPreco: string; escopo: EscopoServico }>({ termo: "", tipo: "produto", localidade: "", servicoId: "", especificacao: "", seuPreco: "", escopo: "mao_de_obra" });
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [erroBusca, setErroBusca] = useState("");
  const [registradas, setRegistradas] = useState<Set<string>>(new Set());
  const [imagensFalhas, setImagensFalhas] = useState<Set<string>>(new Set());
  const buscandoRef = useRef(false);

  // Vindo do Catálogo ("Pesquisar preço"): consulta já preparada com o item.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const termo = q.get("termo")?.slice(0, 160) ?? "";
    const servicoId = q.get("servico_id") ?? "";
    const tipo = q.get("tipo") === "servico" ? "servico" : "produto";
    if (termo || servicoId) setBusca((b) => ({ ...b, termo, servicoId, tipo }));
  }, []);

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
      setCarregando(true); setErro(""); setCargaFalhou(false);
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
      setCargaFalhou(true);
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

  async function buscarNaWeb(evento: FormEvent) {
    evento.preventDefault();
    if (buscandoRef.current) return;
    buscandoRef.current = true; setBuscando(true); setErroBusca(""); setResultado(null); setRegistradas(new Set());
    try {
      const resposta = await fetch("/api/pesquisa-precos/busca-web", {
        method: "POST", headers,
        body: JSON.stringify({ termo: busca.termo, tipo: busca.tipo, localidade: busca.localidade || undefined, servico_id: busca.servicoId || undefined,
          ...(busca.tipo === "servico" ? { escopo: busca.escopo, especificacao: busca.especificacao.trim() || undefined, seu_preco_reais: precoParaNumero(busca.seuPreco) ?? undefined } : {}) }),
      });
      const json = await resposta.json().catch(() => ({}));
      if (!resposta.ok || !json.sucesso) throw new Error(json.error || MSG_ERRO_PADRAO);
      setResultado(json as ResultadoBusca);
    } catch (e) { setErroBusca(e instanceof Error ? e.message : MSG_ERRO_PADRAO); }
    finally { buscandoRef.current = false; setBuscando(false); }
  }

  // Registrar uma referência encontrada usa SÓ as rotas existentes
  // (item → fonte → observação imutável), com a URL como evidência.
  async function registrarReferencia(ref: ReferenciaPreco) {
    if (!resultado || salvandoRef.current) return;
    salvandoRef.current = true; setSalvando(true); setErro("");
    try {
      const nome = resultado.consulta.termo;
      let item = itens.find((i) => i.nome.trim().toLowerCase() === nome.trim().toLowerCase() && i.unidade_canonica === "un");
      if (!item) {
        const json = await enviar("/api/pesquisa-precos/itens", { nome, unidade_canonica: "un", servico_id: resultado.itemCatalogo?.id || undefined,
          especificacao: `${resultado.consulta.tipo === "servico" ? "Serviço/mão de obra" : "Produto"}${resultado.consulta.localidade ? ` · ${resultado.consulta.localidade}` : ""}` });
        item = json.item as Item;
      }
      let fonte = fontes.find((f) => f.nome === ref.fonte && f.tipo === "api_autorizada");
      if (!fonte) {
        const json = await enviar("/api/pesquisa-precos/fontes", { nome: ref.fonte, tipo: "api_autorizada", referencia: `https://${ref.fonte}` });
        fonte = json.fonte as Fonte;
      }
      await enviar("/api/pesquisa-precos/observacoes", {
        item_id: item.id, fonte_id: fonte.id, preco_centavos: ref.precoCentavos, moeda: "BRL", quantidade: 1, unidade_observada: "un",
        observado_em: resultado.consulta.pesquisadoEm, evidencia_referencia: ref.url,
        chave_idempotencia: chaveReferencia(`${resultado.consulta.pesquisadoEm}|${ref.url}|${ref.precoCentavos}`),
      });
      setRegistradas((s) => new Set(s).add(ref.url + ref.precoCentavos));
      setSucesso("Referência registrada no histórico, com a página como evidência.");
      await carregarBase(item.id);
    } catch (e) { setErro(e instanceof Error ? e.message : MSG_ERRO_PADRAO); }
    finally { salvandoRef.current = false; setSalvando(false); }
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

  if (carregando) return (
    <AdminShell title="Pesquisa de Preços" subtitle="Referências de mercado para produtos e mão de obra">
      <PageLoader title="Carregando pesquisa de preços..." subtitle="Consultando o histórico registrado pelo seu negócio" />
    </AdminShell>
  );

  const R = (c: number | null) => (c === null ? "—" : moeda(c));
  const resumo = resultado?.resumo ?? null;

  return (
    <AdminShell title="Pesquisa de Preços" subtitle="Referências de mercado para produtos e mão de obra">
    <div className="pp-root">
      <style>{`
        .pp-root{color:#e2e8f0}
        .pp-wrap{max-width:1180px;margin:0 auto}.pp-grid{display:grid;grid-template-columns:340px 1fr;gap:18px}
        .pp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pp-span{grid-column:1/-1}
        .pp-btn{border:0;border-radius:9px;background:#1f4e5f;color:white;padding:11px 16px;font-weight:700;cursor:pointer}
        .pp-btn:disabled{opacity:.55;cursor:not-allowed}.pp-secondary{background:transparent;border:1px solid #384155;color:#94a3b8}
        .pp-table{width:100%;border-collapse:collapse}.pp-table th,.pp-table td{text-align:left;padding:11px 10px;border-bottom:1px solid #252b3a;font-size:12px;vertical-align:top}
        .pp-table th{color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
        .pp-resumo{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}
        .pp-kpi{background:#0f1117;border:1px solid #252b3a;border-radius:10px;padding:10px 12px}.pp-kpi b{display:block;font-size:17px;color:#f1f5f9;margin-top:4px}
        @media(max-width:800px){.pp-grid,.pp-form-grid{grid-template-columns:1fr}.pp-span{grid-column:auto}.pp-table{display:block;overflow-x:auto;white-space:nowrap}}
      `}</style>
      <div className="pp-wrap">
        <p style={{ color: "#64748b", margin: "0 0 18px", maxWidth: 820, fontSize: 13 }}>
          Busque referências reais na web para um produto ou para a mão de obra de um serviço, compare com o seu preço e, se quiser, registre as referências no histórico. Nada altera seus preços de venda.
        </p>
        {erro && <Feedback type="erro" message={erro} onClose={() => setErro("")} />}
        {sucesso && <Feedback type="sucesso" message={sucesso} onClose={() => setSucesso("")} autoCloseMs={4000} />}

        {/* ── BUSCA REAL NA WEB ── */}
        {!cargaFalhou && <section data-testid="busca-web" style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Buscar referências na web</h2>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 14px" }}>
            Busca real na internet feita por IA (OpenAI, com as páginas consultadas). Cada referência traz a página de origem — confira o preço na fonte antes de decidir.
          </p>
          <form className="pp-form-grid" onSubmit={buscarNaWeb}>
            <label style={label} className="pp-span">O que pesquisar<input style={input} required minLength={2} maxLength={160} placeholder="Ex.: Pneu 90/90-18 · Troca de pneu de moto · Instalação de box de banheiro" value={busca.termo} onChange={(e) => setBusca({ ...busca, termo: e.target.value })} /></label>
            <label style={label}>Tipo<select style={input} value={busca.tipo} onChange={(e) => setBusca({ ...busca, tipo: e.target.value === "servico" ? "servico" : "produto" })}>
              <option value="produto">Produto</option><option value="servico">Serviço / mão de obra</option></select></label>
            <label style={label}>{busca.tipo === "servico" ? "Cidade (necessária para serviço)" : "Cidade (opcional)"}<input style={input} maxLength={80} placeholder="Ex.: Londrina, PR" value={busca.localidade} onChange={(e) => setBusca({ ...busca, localidade: e.target.value })} /></label>
            {busca.tipo === "servico" && <>
              <label style={label} className="pp-span">O que o preço deve incluir<select style={input} value={busca.escopo} onChange={(e) => setBusca({ ...busca, escopo: e.target.value === "mao_de_obra_e_material" ? "mao_de_obra_e_material" : e.target.value === "indefinido" ? "indefinido" : "mao_de_obra" })}>
                <option value="mao_de_obra">Somente mão de obra (sem material)</option><option value="mao_de_obra_e_material">Mão de obra + material</option><option value="indefinido">Ainda não sei / qualquer serviço</option></select></label>
              <label style={label} className="pp-span">Especificação do serviço (opcional)<input style={input} maxLength={300} placeholder="Ex.: somente mão de obra · box frontal, vidro 8 mm, 1,40 x 1,90 m" value={busca.especificacao} onChange={(e) => setBusca({ ...busca, especificacao: e.target.value })} /></label>
              <label style={label}>Seu preço para este serviço (opcional, R$)<input style={input} inputMode="decimal" maxLength={14} placeholder="Ex.: 450,00 — só para comparar" value={busca.seuPreco} onChange={(e) => setBusca({ ...busca, seuPreco: e.target.value })} /></label>
            </>}
            <label style={label} className="pp-span">Comparar com item do Catálogo<select style={input} value={busca.servicoId} onChange={(e) => setBusca({ ...busca, servicoId: e.target.value })}><option value="">Sem comparação</option>{catalogo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <div className="pp-span"><button className="pp-btn" disabled={buscando || !token}>{buscando ? "Buscando na web..." : "Buscar referências"}</button></div>
          </form>
          {erroBusca && <div style={{ marginTop: 12 }}><Feedback type="erro" message={erroBusca} onClose={() => setErroBusca("")} /></div>}

          {resultado && resumo && <div data-testid="resultado-busca" style={{ marginTop: 16 }}>
            <div className="pp-resumo">
              <div className="pp-kpi"><span style={{ fontSize: 11, color: "#94a3b8" }}>Seu preço{resultado.seuPrecoOrigem === "informado" ? " (informado)" : resultado.seuPrecoOrigem === "catalogo" ? " (Catálogo)" : ""}</span><b>{resumo.seuPrecoCentavos !== null ? R(resumo.seuPrecoCentavos) : resultado.itemCatalogo ? "Sem preço no catálogo" : "—"}</b></div>
              <div className="pp-kpi"><span style={{ fontSize: 11, color: "#94a3b8" }}>Referências consideradas</span><b>{resumo.consideradas} <small style={{ fontSize: 11, color: "#64748b" }}>de {resultado.referencias.length} · {resumo.fontesDistintas} fonte(s)</small></b></div>
              <div className="pp-kpi"><span style={{ fontSize: 11, color: "#94a3b8" }}>Faixa observada</span><b>{resumo.minimoCentavos !== null ? `${R(resumo.minimoCentavos)} – ${R(resumo.maximoCentavos)}` : "—"}</b></div>
              <div className="pp-kpi"><span style={{ fontSize: 11, color: "#94a3b8" }}>Mediana observada</span><b>{R(resumo.medianaCentavos)}</b></div>
            </div>
            <p data-testid="motivo-resumo" style={{ fontSize: 12, color: resumo.confiavel ? "#4ade80" : "#fbbf24", margin: "0 0 6px" }}>{resumo.motivo}</p>
            {resultado.consulta.tipo === "servico" && resumo.medianaCentavos !== null && <div data-testid="resposta-simples" style={{ fontSize: 13, color: "#e2e8f0", background: "#0f1117", border: "1px solid #252b3a", borderRadius: 10, padding: "10px 12px", margin: "0 0 10px", lineHeight: 1.6 }}>
              <div><b>Quanto estão cobrando:</b> de {R(resumo.minimoCentavos)} a {R(resumo.maximoCentavos)} (valor do meio: {R(resumo.medianaCentavos)}).</div>
              <div><b>O que está incluído:</b> {(resultado.consulta.escopo ?? "mao_de_obra") === "mao_de_obra" ? "somente a mão de obra, sem material" : (resultado.consulta.escopo ?? "mao_de_obra") === "mao_de_obra_e_material" ? "mão de obra com material" : "serviço, com ou sem material (os preços podem não ser totalmente comparáveis)"}.</div>
              <div><b>Seu preço:</b> {resumo.seuPrecoCentavos === null ? "não informado — digite o seu preço para comparar" : resumo.posicaoSeuPreco === null ? `${R(resumo.seuPrecoCentavos)} — sem comparação confiável` : `${R(resumo.seuPrecoCentavos)}, ${resumo.posicaoSeuPreco === "abaixo" ? "abaixo" : resumo.posicaoSeuPreco === "acima" ? "acima" : "dentro"} do que estão cobrando`}.</div>
            </div>}
            {resumo.posicaoSeuPreco && <p style={{ fontSize: 12, color: "#cbd5e1", margin: "0 0 10px" }}>
              Seu preço está {resumo.posicaoSeuPreco === "abaixo" ? "abaixo da faixa encontrada" : resumo.posicaoSeuPreco === "acima" ? "acima da faixa encontrada" : "dentro da faixa encontrada"} — uma referência para sua decisão, não uma recomendação automática.
            </p>}
            {resultado.consulta.tipo === "servico" && !!resultado.fatores?.length && <div data-testid="fatores-servico" style={{ fontSize: 12, color: "#cbd5e1", margin: "0 0 10px" }}>
              O preço deste serviço pode variar conforme: {resultado.fatores.join(" · ")}.
            </div>}
            <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 10px" }}>
              Pesquisado em {dataHora(resultado.consulta.pesquisadoEm)} · {resultado.fontesConsultadas} páginas consultadas por {resultado.provedor.nome}
              {resultado.descartadas.length > 0 && ` · ${resultado.descartadas.reduce((s, d) => s + d.quantidade, 0)} resposta(s) descartada(s) sem preço ou fonte válida`}
            </p>
            {resultado.referencias.length === 0 ? <EmptyState icon="🔎" title="Nenhuma referência com preço e fonte verificáveis" description="Tente um nome mais específico (modelo, medida, marca) ou registre cotações manualmente abaixo." compact /> :
            <div style={{ overflowX: "auto" }}><table className="pp-table"><thead><tr><th>Referência</th><th>Preço</th><th>Fonte</th><th>Comparabilidade</th><th></th></tr></thead><tbody>
              {resultado.referencias.map((r) => {
                const servico = resultado.consulta.tipo === "servico";
                const foraDaConta = r.comparabilidade === "baixa" || (servico && (r.mesmaLocalidade !== true || !composicaoEntraNaConta(r.composicao, resultado.consulta.escopo ?? "mao_de_obra")));
                const motivoFora = r.comparabilidade === "baixa" ? "Fora da conta"
                  : servico && !composicaoEntraNaConta(r.composicao, resultado.consulta.escopo ?? "mao_de_obra") && r.mesmaLocalidade === true ? (r.composicao === "indefinida" ? "Não informa se inclui material — fora da conta" : r.composicao === "produto" ? "Venda de produto — fora da conta" : (resultado.consulta.escopo ?? "mao_de_obra") === "mao_de_obra_e_material" ? "Só mão de obra — fora da conta" : "Inclui produto/material — fora da conta")
                  : "Outra região — fora da conta";
                const chave = r.url + r.precoCentavos;
                return <tr key={chave} style={{ opacity: foraDaConta ? 0.6 : 1 }}>
                  <td style={{ maxWidth: 380 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      {/* Produto: imagem declarada pela página da loja (sem busca extra). Sem imagem,
                          ou se a loja bloquear/expirar o arquivo, fica o placeholder — nunca outra imagem. */}
                      {resultado.consulta.tipo === "produto" && (r.imagemUrl && !imagensFalhas.has(r.imagemUrl)
                        // eslint-disable-next-line @next/next/no-img-element -- imagem externa da loja; next/image exigiria liberar cada domínio de loja
                        ? <img src={r.imagemUrl} alt={`Imagem do produto em ${r.fonte}`} title={`Imagem publicada por ${r.fonte}`} data-testid="imagem-referencia"
                            loading="lazy" decoding="async" referrerPolicy="no-referrer" width={56} height={56}
                            onError={() => setImagensFalhas(s => new Set(s).add(r.imagemUrl!))}
                            style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, background: "#fff", flexShrink: 0 }} />
                        : <div aria-hidden="true" data-testid="sem-imagem-referencia" title="Sem imagem confiável desta fonte"
                            style={{ width: 56, height: 56, borderRadius: 8, border: "1px dashed #2d3148", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, opacity: 0.45, flexShrink: 0 }}>📦</div>)}
                      <div style={{ minWidth: 0 }}>{r.titulo}{r.localidade && <><br /><span style={{ color: "#64748b" }}>📍 {r.localidade}</span></>}{r.diferenca && <><br /><span style={{ color: "#fbbf24" }}>Diferença: {r.diferenca}</span></>}{servico && r.composicao && <><br /><span data-testid="composicao-referencia" style={{ color: r.composicao === "mao_de_obra" ? "#4ade80" : "#fbbf24" }}>{r.composicao === "mao_de_obra" ? "Somente mão de obra" : r.composicao === "indefinida" ? "Não informa se inclui material" : r.composicao === "produto" ? "Venda de produto" : "Inclui produto/material"}</span></>}</div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: "#f1f5f9" }}>{R(r.precoCentavos)}</td>
                  <td><a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "#4a9bb0" }}>{r.fonte}</a><br /><span style={{ color: "#64748b" }}>{r.confirmacao === "pagina_consultada" ? "página consultada" : "site consultado — confira a página"}</span></td>
                  <td>{r.comparabilidade === "alta" ? "Alta" : r.comparabilidade === "media" ? "Média" : "Baixa"}{foraDaConta && <><br /><span style={{ color: "#fbbf24" }}>{motivoFora}</span></>}</td>
                  <td><button type="button" className="pp-btn pp-secondary" disabled={salvando || registradas.has(chave)} onClick={() => void registrarReferencia(r)}>{registradas.has(chave) ? "Registrada" : "Registrar no histórico"}</button></td>
                </tr>;
              })}
            </tbody></table></div>}
          </div>}
        </section>}

        {cargaFalhou ? <section style={card}>
          <p style={{ margin: "0 0 12px", color: "#94a3b8" }}>Seus itens e fontes não puderam ser carregados agora. Nada foi alterado — tente novamente em instantes.</p>
          <button type="button" className="pp-btn" onClick={() => void carregarBase(itemSelecionado)}>Tentar novamente</button>
        </section> :
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
                <label style={label}>Tipo<select style={input} value={novaFonte.tipo} onChange={(e) => setNovaFonte({ ...novaFonte, tipo: e.target.value })}>{TIPOS_FONTE_PRECO.map((tipo) => <option key={tipo} value={tipo}>{ROTULO_TIPO_FONTE[tipo] ?? tipo}</option>)}</select></label>
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
        </div>}
      </div>
    </div>
    </AdminShell>
  );
}
