"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle2, ExternalLink, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { montarPromptRespostaAvaliacao } from "../../lib/google-business-profile-shared";
import type { EstadoConexaoGoogle } from "../../lib/google-business-profile-resources";
import AdminShell from "../components/AdminShell";

type Status = { conectado: boolean; estado?: EstadoConexaoGoogle; codigo?: string; conexao?: { conta: string | null; local: string | null; conectadoEm: string } | null; error?: string };
type Avaliacao = {
  reviewId: string; name: string; nota: number; comentario: string | null; autor: string | null; criadoEm: string;
  estado: "sem_resposta" | "resposta_preparada" | "respondida"; respostaGoogle: string | null; rascunhoLocal: string | null;
};

export default function GooglePresencaPage() {
  const [clinicaId, setClinicaId] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [erro, setErro] = useState("");
  // true quando o status da conexão não pôde ser consultado (ex.: tabela
  // de conexão ainda não existe em produção) — nunca deve ser confundido
  // com "não conectado ainda" (status.conectado === false), que permite
  // iniciar a conexão normalmente.
  const [indisponivel, setIndisponivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [avaliacoesIndisponiveis, setAvaliacoesIndisponiveis] = useState<string | null>(null);
  const [carregandoAvaliacoes, setCarregandoAvaliacoes] = useState(false);
  const [rascunhosEmEdicao, setRascunhosEmEdicao] = useState<Record<string, string>>({});
  const [gerandoRascunho, setGerandoRascunho] = useState<string | null>(null);
  const [publicando, setPublicando] = useState<string | null>(null);
  const idempotencyRefs = useRef<Record<string, { key: string; texto: string; incerta: boolean }>>({});
  const resultado = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("status") : null;

  const carregarAvaliacoes = useCallback(async (cid: string, token: string) => {
    setCarregandoAvaliacoes(true);
    try {
      const response = await fetch(`/api/google-business-profile/avaliacoes?clinica_id=${encodeURIComponent(cid)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok || data.indisponivel || data.estado === "desconectado") {
        setAvaliacoesIndisponiveis(data.error || data.motivo || "Avaliações indisponíveis no momento."); setAvaliacoes([]);
        if (data.estado === "renovacao_necessaria") { setStatus({ conectado: false, estado: data.estado }); setIndisponivel(true); }
      }
      else { setAvaliacoesIndisponiveis(null); setAvaliacoes(data.avaliacoes ?? []); }
    } catch {
      setAvaliacoesIndisponiveis("Não foi possível carregar as avaliações.");
    } finally {
      setCarregandoAvaliacoes(false);
    }
  }, []);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErro("Sessão expirada."); setCarregando(false); return; }
      setAccessToken(session.access_token);
      const clinicaResponse = await fetch("/api/minha-clinica", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const clinica = await clinicaResponse.json();
      if (!clinicaResponse.ok || !clinica.clinica_id) { setErro("Negócio não vinculado ao usuário."); setCarregando(false); return; }
      setClinicaId(clinica.clinica_id);
      setNomeEmpresa(clinica.nome || "");
      const response = await fetch(`/api/google-business-profile?clinica_id=${encodeURIComponent(clinica.clinica_id)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await response.json() as Status;
      setStatus({ ...data, conectado: data.conectado === true });
      if (!response.ok) { setErro(data.error ?? "Não foi possível consultar a conexão."); setIndisponivel(true); }
      else {
        setStatus(data);
        if (data.conectado) void carregarAvaliacoes(clinica.clinica_id, session.access_token);
      }
      setCarregando(false);
    }
    void carregar().catch(() => { setErro("Não foi possível consultar a conexão. Tente novamente."); setIndisponivel(true); setCarregando(false); });
  }, [carregarAvaliacoes]);

  async function conectar() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !clinicaId) { setErro("Sessão ou negócio não disponível."); return; }
      const res = await fetch("/api/google-business-profile/oauth/start", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ clinica_id: clinicaId }) });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Não foi possível iniciar a conexão."); return; }
      const url = new URL(data.url);
      if (url.origin !== "https://accounts.google.com") throw new Error();
      window.location.href = url.toString();
    } catch { setErro("Não foi possível iniciar a conexão. Tente novamente."); }
  }

  async function desconectar() {
    if (!clinicaId || !accessToken) return;
    if (!window.confirm("Desconectar o Google Business Profile desta empresa?")) return;
    const response = await fetch(`/api/google-business-profile?clinica_id=${encodeURIComponent(clinicaId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.ok) { setStatus({ conectado: false, estado: "desconectado" }); setIndisponivel(false); setAvaliacoes([]); }
    else setErro("Não foi possível desconectar.");
  }

  function idempotencyKeyPara(chave: string, texto: string): string {
    const atual = idempotencyRefs.current[chave];
    if (atual && atual.texto !== texto && atual.incerta) throw new Error("Operação anterior sem confirmação. Reenvie o mesmo texto para consultar seu resultado.");
    if (!atual || atual.texto !== texto) idempotencyRefs.current[chave] = { key: crypto.randomUUID(), texto, incerta: true };
    return idempotencyRefs.current[chave].key;
  }

  async function gerarRascunho(av: Avaliacao) {
    setGerandoRascunho(av.reviewId);
    setErro("");
    try {
      const prompt = montarPromptRespostaAvaliacao({ nomeEmpresa: nomeEmpresa || "nossa empresa", nota: av.nota, comentario: av.comentario });
      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ prompt, max_tokens: 200 }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Não foi possível gerar o rascunho."); return; }
      setRascunhosEmEdicao((prev) => ({ ...prev, [av.reviewId]: data.content || "" }));
    } finally {
      setGerandoRascunho(null);
    }
  }

  async function salvarRascunho(reviewId: string) {
    try {
    const texto = rascunhosEmEdicao[reviewId];
    if (!texto?.trim()) return;
    const res = await fetch(`/api/google-business-profile/avaliacoes/${encodeURIComponent(reviewId)}/rascunho`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ clinica_id: clinicaId, texto, idempotency_key: idempotencyKeyPara(`rascunho-${reviewId}`, texto.trim()) }),
    });
    const data = await res.json();
    if (res.ok || !data.manterChave) delete idempotencyRefs.current[`rascunho-${reviewId}`];
    if (!res.ok) { setErro(data.error || "Não foi possível salvar o rascunho."); return; }
    void carregarAvaliacoes(clinicaId, accessToken);
    } catch { setErro("Rascunho sem confirmação. Tente novamente com o mesmo texto antes de editar."); }
  }

  async function aprovarEPublicar(av: Avaliacao) {
    const texto = rascunhosEmEdicao[av.reviewId] ?? av.rascunhoLocal;
    if (!texto?.trim()) { setErro("Escreva ou gere uma resposta antes de publicar."); return; }
    if (!window.confirm("Publicar esta resposta no Google agora? Esta ação é real e não pode ser desfeita pelo OrganizaPro.")) return;
    setPublicando(av.reviewId);
    setErro("");
    try {
      const res = await fetch(`/api/google-business-profile/avaliacoes/${encodeURIComponent(av.reviewId)}/publicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clinica_id: clinicaId, texto, review_name: av.name, idempotency_key: idempotencyKeyPara(`publicar-${av.reviewId}`, texto.trim()) }),
      });
      const data = await res.json();
      if (res.ok || !data.manterChave) delete idempotencyRefs.current[`publicar-${av.reviewId}`];
      if (!res.ok) { setErro(data.error || "Não foi possível publicar no Google."); return; }
      void carregarAvaliacoes(clinicaId, accessToken);
    } catch { setErro("Publicação sem confirmação. Não crie outra tentativa: reenvie o mesmo texto para consultar o resultado.");
    } finally {
      setPublicando(null);
    }
  }

  return <AdminShell title="Google Presença" subtitle="Conexão oficial com o Google Business Profile">
  <div style={{ minHeight: "100%", background: "#f4f7f6", color: "#17231f", margin: "-28px -32px", padding: "32px 20px" }}><div style={{ maxWidth: 800, margin: "0 auto" }}>
    <p style={{ margin: 0, color: "#176b52", fontWeight: 800, letterSpacing: ".08em", fontSize: 12 }}>GOOGLE PRESENÇA REAL</p>
    <p style={{ color: "#53645d", lineHeight: 1.6, marginTop: 8 }}>Conexão oficial para ler a conta e o primeiro local autorizado no Google Business Profile.</p>
    <section style={{ background: "#fff", border: "1px solid #d9e2dd", borderRadius: 8, padding: 22, marginTop: 22 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><ShieldCheck size={22} color="#176b52" /><div><strong>O que esta V1 faz</strong><p style={{ color: "#53645d", lineHeight: 1.6 }}>Solicita autorização Google, lê contas e locais disponíveis e registra a conexão com segurança. Lê avaliações reais, prepara uma resposta sugerida e só publica no Google depois de você aprovar explicitamente — nunca responde automaticamente.</p></div></div>
      {resultado === "connected" && <p style={{ color: "#176b52", display: "flex", gap: 7, alignItems: "center" }}><CheckCircle2 size={18} /> Google conectado e leitura inicial concluída.</p>}
      {resultado && resultado !== "connected" && <p style={{ color: "#9a6700", display: "flex", gap: 7, alignItems: "center" }}><XCircle size={18} /> Não foi possível concluir a conexão Google.</p>}
      {carregando && <p style={{ color: "#53645d" }}>Consultando conexão...</p>}
      {erro && <p role="alert" style={{ color: "#a12b25" }}>{erro}</p>}
      {(status?.estado === "renovacao_necessaria" || status?.codigo === "SEM_LOCAL") && <button type="button" onClick={conectar}>Reconectar com Google</button>}
      {!carregando && status?.conectado && (
        <div style={{ background: "#edf8f2", padding: 14, borderRadius: 6, color: "#245c45", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div><strong>{status.conexao?.local ?? "Local autorizado"}</strong><br /><span style={{ fontSize: 14 }}>Conta: {status.conexao?.conta ?? "não informada"}</span></div>
          <button type="button" onClick={desconectar} style={{ border: "1px solid #a12b25", background: "transparent", color: "#a12b25", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>Desconectar</button>
        </div>
      )}
      {/* Nunca oferece "Conectar com Google" quando o status é desconhecido
          por falha real (indisponivel) — evita o usuário completar um
          OAuth real do Google fadado a falhar no fim. */}
      {!carregando && !indisponivel && !status?.conectado && <button type="button" onClick={conectar} style={{ marginTop: 12, display: "inline-flex", gap: 8, alignItems: "center", border: 0, borderRadius: 6, padding: "11px 16px", background: "#176b52", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Conectar com Google <ExternalLink size={16} /></button>}
    </section>

    {!carregando && status?.conectado && (
      <section style={{ background: "#fff", border: "1px solid #d9e2dd", borderRadius: 8, padding: 22, marginTop: 22 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Avaliações reais do Google</h2>
        {carregandoAvaliacoes && <p style={{ color: "#53645d" }}>Buscando avaliações...</p>}
        {avaliacoesIndisponiveis && <p style={{ color: "#9a6700" }}>{avaliacoesIndisponiveis}</p>}
        {!carregandoAvaliacoes && !avaliacoesIndisponiveis && avaliacoes.length === 0 && <p style={{ color: "#53645d" }}>Nenhuma avaliação encontrada.</p>}
        {avaliacoes.map((av) => (
          <div key={av.reviewId} style={{ border: "1px solid #e5ebe8", borderRadius: 6, padding: 14, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <strong>{"★".repeat(av.nota)}{"☆".repeat(5 - av.nota)} {av.autor ?? "Cliente"}</strong>
              <span style={{ fontSize: 12, color: "#53645d", textTransform: "uppercase" }}>
                {av.estado === "respondida" ? "✅ Respondida" : av.estado === "resposta_preparada" ? "📝 Resposta preparada" : "Sem resposta"}
              </span>
            </div>
            {av.comentario && <p style={{ color: "#3d4a45", marginTop: 8 }}>{av.comentario}</p>}
            {av.estado === "respondida" && av.respostaGoogle && <p style={{ background: "#f4f7f6", padding: 10, borderRadius: 6, marginTop: 8, fontSize: 14 }}><strong>Sua resposta:</strong> {av.respostaGoogle}</p>}
            {av.estado !== "respondida" && (
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={rascunhosEmEdicao[av.reviewId] ?? av.rascunhoLocal ?? ""}
                  onChange={(e) => setRascunhosEmEdicao((prev) => ({ ...prev, [av.reviewId]: e.target.value }))}
                  placeholder="Gere um rascunho ou escreva a resposta manualmente"
                  rows={3}
                  style={{ width: "100%", border: "1px solid #d9e2dd", borderRadius: 6, padding: 8, fontFamily: "inherit" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button type="button" disabled={gerandoRascunho === av.reviewId} onClick={() => gerarRascunho(av)} style={{ border: "1px solid #176b52", background: "transparent", color: "#176b52", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>{gerandoRascunho === av.reviewId ? "Gerando..." : "Gerar rascunho"}</button>
                  <button type="button" onClick={() => salvarRascunho(av.reviewId)} style={{ border: "1px solid #d9e2dd", background: "transparent", color: "#3d4a45", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>Salvar rascunho</button>
                  <button type="button" disabled={publicando === av.reviewId} onClick={() => aprovarEPublicar(av)} style={{ border: 0, background: "#176b52", color: "#fff", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{publicando === av.reviewId ? "Publicando..." : "Aprovar e publicar no Google"}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    )}
  </div></div>
  </AdminShell>;
}
