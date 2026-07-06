"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [novaSenha,    setNovaSenha]    = useState("");
  const [confirmar,    setConfirmar]    = useState("");
  const [erro,         setErro]         = useState("");
  const [carregando,   setCarregando]   = useState(false);
  const [sessaoOk,     setSessaoOk]     = useState(false);
  const [sucesso,      setSucesso]      = useState(false);
  const router = useRouter();

  // Supabase lê automaticamente o access_token do hash da URL e
  // dispara PASSWORD_RECOVERY — aguardamos esse evento para habilitar o formulário.
  // Aceitar SIGNED_IN ou qualquer sessão existente permitiria que qualquer usuário
  // autenticado acessasse este formulário sem ter clicado no link de recuperação.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessaoOk(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const atualizar = async () => {
    setErro("");
    if (novaSenha.length < 6) {
      setErro("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErro("As senhas não coincidem. Verifique e tente novamente.");
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setCarregando(false);
    if (error) {
      setErro("Não foi possível atualizar a senha. O link pode ter expirado — solicite um novo.");
    } else {
      setSucesso(true);
      setTimeout(() => router.push("/login"), 3000);
    }
  };

  // ── Estilos ──────────────────────────────────────────────────────────────
  const outer: React.CSSProperties = {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "#060918", padding: 24,
  };
  const card: React.CSSProperties = {
    width: "100%", maxWidth: 420, background: "#101827", padding: 40,
    borderRadius: 24, boxShadow: "0 30px 90px rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.06)",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8",
    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const inp: React.CSSProperties = {
    display: "block", width: "100%", padding: "12px 14px",
    background: "#0f1117", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, color: "#e2e8f0", fontSize: 14,
    outline: "none", boxSizing: "border-box",
  };

  // ── Sucesso ───────────────────────────────────────────────────────────────
  if (sucesso) return (
    <div style={outer}>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
          Senha atualizada com sucesso!
        </h2>
        <p style={{ fontSize: 14, color: "#8b97b2", lineHeight: 1.7, margin: "0 0 28px" }}>
          Sua nova senha já está ativa. Você será redirecionado para o login em instantes.
        </p>
        <Link href="/login" style={{ fontSize: 14, color: "#4a9bb0", textDecoration: "none", fontWeight: 600 }}>
          Ir para o login agora →
        </Link>
      </div>
    </div>
  );

  // ── Aguardando token de recuperação ──────────────────────────────────────
  if (!sessaoOk) return (
    <div style={outer}>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.5 }}>🔑</div>
        <p style={{ fontSize: 14, color: "#64748b" }}>Verificando link de recuperação...</p>
        <div style={{ marginTop: 24 }}>
          <Link href="/login" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );

  // ── Formulário de nova senha ──────────────────────────────────────────────
  return (
    <div style={outer}>
      <div style={card}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔑</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#ffffff" }}>Criar nova senha</h1>
          <p style={{ fontSize: 14, color: "#8b97b2", marginTop: 8 }}>
            Escolha uma senha segura com no mínimo 6 caracteres.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={lbl}>Nova senha</label>
            <input
              type="password" value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>Confirmar senha</label>
            <input
              type="password" value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              onKeyDown={e => e.key === "Enter" && atualizar()}
              placeholder="Repita a nova senha"
              style={inp}
            />
          </div>
        </div>

        {/* Indicador de força da senha */}
        {novaSenha.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 4 }}>
            {[6, 8, 12].map((min, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 99,
                background: novaSenha.length >= min ? (i === 0 ? "#f87171" : i === 1 ? "#fbbf24" : "#4a9bb0") : "rgba(255,255,255,0.08)",
                transition: "background 0.2s",
              }} />
            ))}
            <span style={{ fontSize: 11, color: "#64748b", minWidth: 60, textAlign: "right" }}>
              {novaSenha.length < 6 ? "Muito curta" : novaSenha.length < 8 ? "Fraca" : novaSenha.length < 12 ? "Média" : "Forte"}
            </span>
          </div>
        )}

        {erro && (
          <div style={{ color: "#f87171", fontSize: 13, marginTop: 14, textAlign: "center" }}>
            {erro}
          </div>
        )}

        <button
          onClick={atualizar}
          disabled={carregando}
          style={{
            width: "100%", padding: "14px 18px", fontSize: 15, borderRadius: 10,
            border: "none", background: "linear-gradient(135deg,#1F4E5F,#0d3547)",
            color: "#fff", fontWeight: 700, cursor: carregando ? "not-allowed" : "pointer",
            marginTop: 22, opacity: carregando ? 0.7 : 1,
          }}
        >
          {carregando ? "Atualizando..." : "Atualizar senha"}
        </button>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/login" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
