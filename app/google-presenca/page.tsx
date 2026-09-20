"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Status = { conectado: boolean; conexao?: { conta: string | null; local: string | null; conectadoEm: string } | null; error?: string };

export default function GooglePresencaPage() {
  const [clinicaId, setClinicaId] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const resultado = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("status") : null;

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErro("Sessão expirada."); setCarregando(false); return; }
      const clinicaResponse = await fetch("/api/minha-clinica", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const clinica = await clinicaResponse.json();
      if (!clinicaResponse.ok || !clinica.clinica_id) { setErro("Negócio não vinculado ao usuário."); setCarregando(false); return; }
      setClinicaId(clinica.clinica_id);
      const response = await fetch(`/api/google-business-profile?clinica_id=${encodeURIComponent(clinica.clinica_id)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await response.json() as Status;
      if (!response.ok) setErro(data.error ?? "Não foi possível consultar a conexão."); else setStatus(data);
      setCarregando(false);
    }
    void carregar();
  }, []);

  async function conectar() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !clinicaId) { setErro("Sessão ou negócio não disponível."); return; }
    window.location.href = `/api/google-business-profile/oauth/start?clinica_id=${encodeURIComponent(clinicaId)}`;
  }

  return <main style={{ minHeight: "100vh", background: "#f4f7f6", color: "#17231f", padding: "32px 20px" }}><div style={{ maxWidth: 800, margin: "0 auto" }}>
    <p style={{ margin: 0, color: "#176b52", fontWeight: 800, letterSpacing: ".08em", fontSize: 12 }}>GOOGLE PRESENÇA REAL</p>
    <h1 style={{ margin: "10px 0 8px", fontSize: "clamp(28px, 5vw, 42px)" }}>Conectar Perfil da Empresa</h1>
    <p style={{ color: "#53645d", lineHeight: 1.6 }}>Conexão oficial para ler a conta e o primeiro local autorizado no Google Business Profile.</p>
    <section style={{ background: "#fff", border: "1px solid #d9e2dd", borderRadius: 8, padding: 22, marginTop: 22 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><ShieldCheck size={22} color="#176b52" /><div><strong>O que esta V1 faz</strong><p style={{ color: "#53645d", lineHeight: 1.6 }}>Solicita autorização Google, lê contas e locais disponíveis e registra a conexão com segurança. Não altera o perfil, não publica conteúdo e não substitui a Presença Digital interna.</p></div></div>
      {resultado === "connected" && <p style={{ color: "#176b52", display: "flex", gap: 7, alignItems: "center" }}><CheckCircle2 size={18} /> Google conectado e leitura inicial concluída.</p>}
      {resultado && resultado !== "connected" && <p style={{ color: "#9a6700", display: "flex", gap: 7, alignItems: "center" }}><XCircle size={18} /> Não foi possível concluir a conexão Google.</p>}
      {carregando && <p style={{ color: "#53645d" }}>Consultando conexão...</p>}
      {erro && <p role="alert" style={{ color: "#a12b25" }}>{erro}</p>}
      {!carregando && status?.conectado && <div style={{ background: "#edf8f2", padding: 14, borderRadius: 6, color: "#245c45" }}><strong>{status.conexao?.local ?? "Local autorizado"}</strong><br /><span style={{ fontSize: 14 }}>Conta: {status.conexao?.conta ?? "não informada"}</span></div>}
      {!carregando && !status?.conectado && <button type="button" onClick={conectar} style={{ marginTop: 12, display: "inline-flex", gap: 8, alignItems: "center", border: 0, borderRadius: 6, padding: "11px 16px", background: "#176b52", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Conectar com Google <ExternalLink size={16} /></button>}
    </section>
  </div></main>;
}