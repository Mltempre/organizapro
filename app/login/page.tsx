"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Modo = "login" | "esqueci" | "esqueci-enviado";

export default function LoginPage() {
  const [email,              setEmail]              = useState("");
  const [senha,              setSenha]              = useState("");
  const [emailRecuperacao,   setEmailRecuperacao]   = useState("");
  const [erro,               setErro]               = useState("");
  const [carregando,         setCarregando]         = useState(false);
  const [modo,               setModo]               = useState<Modo>("login");
  const router = useRouter();

  const trocarModo = (m: Modo) => { setErro(""); setModo(m); };

  // ── Login ────────────────────────────────────────────────────────────────
  const entrar = async () => {
    if (!email.trim() || !senha) { setErro("Preencha e-mail e senha."); return; }
    setCarregando(true);
    setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) setErro("E-mail ou senha incorretos.");
    else router.push("/dashboard");
    setCarregando(false);
  };

  // ── Recuperação ──────────────────────────────────────────────────────────
  const enviarRecuperacao = async () => {
    if (!emailRecuperacao.trim()) { setErro("Informe seu e-mail."); return; }
    setCarregando(true);
    setErro("");
    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperacao.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setCarregando(false);
    if (error) {
      setErro("Não foi possível enviar o e-mail. Verifique o endereço informado.");
    } else {
      trocarModo("esqueci-enviado");
    }
  };

  // ── Estilos compartilhados ───────────────────────────────────────────────
  const outer: React.CSSProperties = {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "#060918", padding: 24,
  };
  const card: React.CSSProperties = {
    width: "100%", maxWidth: 420, background: "#101827", padding: 40,
    borderRadius: 24, boxShadow: "0 30px 90px rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.06)",
  };
  const btnPrimary: React.CSSProperties = {
    width: "100%", padding: "14px 18px", fontSize: 15, borderRadius: 10,
    border: "none", background: "linear-gradient(135deg,#1F4E5F,#0d3547)",
    color: "#fff", fontWeight: 700, cursor: "pointer",
  };
  const linkBtn: React.CSSProperties = {
    background: "none", border: "none", color: "#4a9bb0",
    fontSize: 13, cursor: "pointer", padding: 0, textDecoration: "underline",
  };

  // ── Render: login ────────────────────────────────────────────────────────
  if (modo === "login") return (
    <div style={outer}>
      <div style={card}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#ffffff" }}>OrganizaPro</h1>
          <p style={{ fontSize: 14, color: "#8b97b2", marginTop: 8, marginBottom: 20 }}>
            Entre e acesse seu painel de organização de clientes e compromissos.
          </p>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="E-mail" className="input-field"
            style={{ display: "block", width: "100%", marginBottom: 12 }}
          />
          <input
            type="password" value={senha} onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === "Enter" && entrar()}
            placeholder="Senha" className="input-field"
            style={{ display: "block", width: "100%" }}
          />
        </div>

        {erro && (
          <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{erro}</div>
        )}

        <button onClick={entrar} disabled={carregando} style={{ ...btnPrimary, opacity: carregando ? 0.7 : 1 }}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button onClick={() => trocarModo("esqueci")} style={linkBtn}>
            Esqueci minha senha
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#94a3b8" }}>OrganizaPro • 2026</div>
      </div>
    </div>
  );

  // ── Render: esqueci (formulário) ─────────────────────────────────────────
  if (modo === "esqueci") return (
    <div style={outer}>
      <div style={card}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#ffffff" }}>Recuperar senha</h1>
          <p style={{ fontSize: 14, color: "#8b97b2", marginTop: 8 }}>
            Informe seu e-mail de acesso e enviaremos um link para criar uma nova senha.
          </p>
        </div>

        <input
          type="email" value={emailRecuperacao} onChange={e => setEmailRecuperacao(e.target.value)}
          onKeyDown={e => e.key === "Enter" && enviarRecuperacao()}
          placeholder="Seu e-mail de acesso" className="input-field"
          style={{ display: "block", width: "100%", marginBottom: 8 }}
        />

        {erro && (
          <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{erro}</div>
        )}

        <button onClick={enviarRecuperacao} disabled={carregando}
          style={{ ...btnPrimary, marginTop: 8, opacity: carregando ? 0.7 : 1 }}>
          {carregando ? "Enviando..." : "Enviar link de recuperação"}
        </button>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button onClick={() => trocarModo("login")} style={{ ...linkBtn, color: "#64748b" }}>
            ← Voltar para o login
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render: esqueci-enviado (confirmação) ────────────────────────────────
  return (
    <div style={outer}>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>✉️</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
          E-mail enviado!
        </h2>
        <p style={{ fontSize: 14, color: "#8b97b2", lineHeight: 1.7, margin: "0 0 8px" }}>
          Enviamos um link de recuperação para
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#4a9bb0", margin: "0 0 24px", wordBreak: "break-all" }}>
          {emailRecuperacao}
        </p>
        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65, margin: "0 0 28px" }}>
          Verifique sua caixa de entrada (e a pasta de spam). O link expira em 1 hora.
        </p>
        <button onClick={() => trocarModo("login")} style={{ ...linkBtn, color: "#4a9bb0", fontSize: 14 }}>
          ← Voltar para o login
        </button>
      </div>
    </div>
  );
}
