"use client";
import { useState } from "react";

interface WelcomeModalProps {
  clinicaId: string;
}

const CHECKLIST = [
  { label: "Conta criada",              done: true  },
  { label: "Configuração inicial",      done: false },
  { label: "Publicação do Site Premium", done: false },
  { label: "Treinamento",               done: false },
  { label: "Sistema pronto para uso",   done: false },
];

const chaveVisto = (clinicaId: string) => `op_welcome_modal_visto_${clinicaId}`;

// Tela de boas-vindas exibida uma única vez por empresa, no primeiro acesso.
// Checklist é puramente ilustrativo (sem lógica/persistência de progresso
// real) — por decisão explícita do escopo desta missão.
export default function WelcomeModal({ clinicaId }: WelcomeModalProps) {
  const [aberto, setAberto] = useState(() => {
    if (typeof window === "undefined" || !clinicaId) return false;
    return localStorage.getItem(chaveVisto(clinicaId)) !== "1";
  });

  function fechar() {
    if (clinicaId) localStorage.setItem(chaveVisto(clinicaId), "1");
    setAberto(false);
  }

  if (!aberto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bem-vindo ao OrganizaPro"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(6,8,13,0.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <style>{`
        @keyframes wm-in { from { opacity:0; transform: translateY(16px) scale(0.98); } to { opacity:1; transform: translateY(0) scale(1); } }
        .wm-card { animation: wm-in 0.32s ease both; }
        @keyframes wm-pulse { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
        .wm-pulse { animation: wm-pulse 1.4s ease-in-out infinite; }
      `}</style>

      <div
        className="wm-card"
        style={{
          width: "100%", maxWidth: 480,
          background: "linear-gradient(180deg, #161a24, #0f1117)",
          border: "1px solid rgba(74,155,176,0.25)",
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(74,155,176,0.12)",
          overflow: "hidden",
        }}
      >
        {/* Cabeçalho */}
        <div style={{
          padding: "32px 32px 24px",
          background: "linear-gradient(135deg, rgba(31,78,95,0.35), rgba(13,53,71,0.35))",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", margin: "0 0 10px" }}>
            Bem-vindo ao OrganizaPro!
          </h2>
          <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
            Sua empresa agora faz parte da plataforma.
            <br />
            Vamos configurar tudo para que você aproveite ao máximo os recursos do OrganizaPro.
          </p>
        </div>

        {/* Checklist visual */}
        <div style={{ padding: "24px 32px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4a9bb0", marginBottom: 14 }}>
            Sua jornada no OrganizaPro
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {CHECKLIST.map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  className={item.done ? undefined : "wm-pulse"}
                  style={{ fontSize: 16, width: 22, flexShrink: 0, textAlign: "center" }}
                >
                  {item.done ? "✅" : "⏳"}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 600,
                  color: item.done ? "#e2e8f0" : "#94a3b8",
                }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ padding: "20px 32px 32px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px", lineHeight: 1.6 }}>
            Estamos felizes em fazer parte do crescimento da sua empresa.
          </p>
          <button
            onClick={fechar}
            style={{
              width: "100%", padding: "14px 24px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#1F4E5F,#0d3547)", color: "#fff",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(31,78,95,0.4)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
          >
            Começar agora →
          </button>
        </div>
      </div>
    </div>
  );
}
