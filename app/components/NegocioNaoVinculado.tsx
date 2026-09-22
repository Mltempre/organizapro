"use client";
// ── NegocioNaoVinculado — P1.1: Fechar a Casa do OrganizaPro ─────────────
// Substitui, num único componente compartilhado, o dead-end que cada
// página resolvia sozinha ("Negócio não vinculado ao usuário." sem ação
// nenhuma, ou pior, uma tela em branco) — a causa raiz nunca foi
// individual de cada tela, é a ausência de provisionamento self-service
// (auditoria 7dd307d). Montado UMA vez em AdminShellFrame.tsx (chrome
// persistente), nunca copiado/colado por página — corrigir aqui corrige
// as ~27 páginas que dependem de /api/minha-clinica de uma vez.
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function NegocioNaoVinculado({ onProvisionado }: { onProvisionado: (clinicaId: string) => void }) {
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const criar = async () => {
    if (!nome.trim() || enviando) return;
    setEnviando(true); setErro("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setErro("Sessão expirada — recarregue a página e entre novamente."); return; }
      const res = await fetch("/api/minha-clinica/provisionar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setErro(json.error || "Não foi possível criar seu negócio. Tente novamente."); return; }
      onProvisionado(json.clinica_id);
    } catch {
      setErro("Não foi possível criar seu negócio. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", margin: "0 0 10px" }}>
        Vamos criar o seu negócio no OrganizaPro
      </h2>
      <p style={{ fontSize: 13.5, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 24px" }}>
        Sua conta ainda não está vinculada a nenhum negócio. Informe o nome dele para começar —
        você poderá completar endereço, telefone e demais dados depois, em Configurações.
      </p>
      <input
        type="text" value={nome} onChange={e => setNome(e.target.value)}
        onKeyDown={e => e.key === "Enter" && criar()}
        placeholder="Nome do seu negócio"
        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #2d3148", background: "#1e2130", color: "#f1f5f9", fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
      />
      {erro && <div style={{ color: "#f87171", fontSize: 12.5, marginBottom: 12 }}>{erro}</div>}
      <button
        onClick={criar} disabled={enviando || !nome.trim()}
        style={{ width: "100%", padding: "12px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1F4E5F,#0d3547)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: enviando ? "default" : "pointer", opacity: enviando || !nome.trim() ? 0.6 : 1 }}
      >
        {enviando ? "Criando..." : "Criar meu negócio e continuar"}
      </button>
    </div>
  );
}
