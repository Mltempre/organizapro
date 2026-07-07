"use client";
import { useEffect } from "react";

export type FeedbackType = "sucesso" | "aviso" | "erro";

const ESTILOS: Record<FeedbackType, { bg: string; border: string; color: string; icon: string }> = {
  sucesso: { bg: "#14532d", border: "#16a34a", color: "#4ade80", icon: "✅" },
  aviso:   { bg: "#78350f", border: "#d97706", color: "#fbbf24", icon: "⚠️" },
  erro:    { bg: "#450a0a", border: "#7f1d1d", color: "#fca5a5", icon: "❌" },
};

/** Mensagem amigável e não-técnica para exibir ao usuário quando uma operação falha. */
export const MSG_ERRO_PADRAO = "Não foi possível concluir esta operação. Tente novamente em alguns instantes.";

export default function Feedback({
  type, message, onClose, autoCloseMs,
}: {
  type: FeedbackType;
  message: string;
  onClose?: () => void;
  autoCloseMs?: number;
}) {
  useEffect(() => {
    if (!autoCloseMs || !onClose) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [autoCloseMs, onClose, message]);

  const s = ESTILOS[type];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10,
      padding: "14px 20px", marginBottom: 20,
      color: s.color, fontSize: 13, fontWeight: 600,
      animation: "fb-fade-in 0.25s ease",
    }}>
      <style>{`@keyframes fb-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <span style={{ flexShrink: 0, fontSize: 14 }}>{s.icon}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{ background: "none", border: "none", color: s.color, opacity: 0.6, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}
        >
          ×
        </button>
      )}
    </div>
  );
}
