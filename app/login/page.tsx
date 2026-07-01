"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  const entrar = async () => {
    setCarregando(true);
    setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro("Email ou senha incorretos.");
    } else {
      router.push("/dashboard");
    }
    setCarregando(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060918", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#101827", padding: 40, borderRadius: 24, boxShadow: "0 30px 90px rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#ffffff" }}>OrganizaPro</h1>
          <p style={{ fontSize: 14, color: "#8b97b2", marginTop: 8, marginBottom: 20 }}>Entre e acesse seu painel de organização de clientes e compromissos.</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="input-field" style={{ display: "block", width: "100%", marginBottom: 12 }} />
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="Senha" className="input-field" style={{ display: "block", width: "100%" }} />
        </div>

        {erro && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{erro}</div>}

        <button
          onClick={entrar}
          disabled={carregando}
          style={{ width: "100%", padding: "14px 18px", fontSize: 15, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1F4E5F,#0d3547)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: carregando ? 0.7 : 1 }}
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>

        <div style={{ textAlign: "center", marginTop: 22, fontSize: 12, color: "#94a3b8" }}>OrganizaPro • 2026</div>
      </div>
    </div>
  );
}
