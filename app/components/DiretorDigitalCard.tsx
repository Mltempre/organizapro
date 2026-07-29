"use client";
// ── IA Comercial V1 · Diretor Digital ────────────────────────────────────
// Ver docs/ia-comercial-v1-arquitetura.md (arquitetura homologada). Este
// componente só apresenta o que lib/ia-comercial.ts já calculou — nenhuma
// regra de negócio vive aqui, nenhuma chamada a IA generativa, nenhuma
// automação de envio (todo botão só navega, igual ao Radar/Próxima Melhor
// Ação já fazem).
import type { RecomendacaoConsultiva } from "../../lib/ia-comercial";

const stCategoria: Record<RecomendacaoConsultiva["categoria"], { emoji: string; label: string }> = {
  retorno_cliente:          { emoji: "🔄", label: "Retorno de cliente" },
  cancelamento_confirmacao: { emoji: "📵", label: "Cancelamento / confirmação" },
  agenda_ociosa:            { emoji: "🗓️", label: "Agenda ociosa" },
  reputacao:                { emoji: "⭐", label: "Reputação" },
};

const stPrioridade: Record<"alta" | "media" | "baixa", { bg: string; border: string; color: string; label: string }> = {
  alta:  { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", color: "#f87171", label: "Alta prioridade" },
  media: { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  color: "#fbbf24", label: "Média prioridade" },
  baixa: { bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.3)",  color: "#4ade80", label: "Baixa prioridade" },
};

type Props = {
  narrativa: string;
  recomendacoes: RecomendacaoConsultiva[];
  onNavigate: (destino: string) => void;
};

export default function DiretorDigitalCard({ narrativa, recomendacoes, onNavigate }: Props) {
  return (
    <div className="dc" style={{
      background: "#12151f", border: "1px solid rgba(56,189,248,0.22)",
      borderRadius: 16, padding: "22px 24px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(56,189,248,0.16)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>
          🧭
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
            Diretor Digital
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            IA Comercial · orientação consultiva baseada no seu histórico real
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 16px" }}>
        {narrativa}
      </p>

      {recomendacoes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recomendacoes.map(rec => {
            const cat = stCategoria[rec.categoria];
            const pr = stPrioridade[rec.prioridade];
            return (
              <div key={rec.id} style={{
                background: "rgba(255,255,255,0.03)", border: `1px solid ${pr.border}`,
                borderRadius: 12, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700 }}>
                    {cat.emoji} {cat.label}
                  </span>
                  <span style={{
                    padding: "3px 9px", borderRadius: 999, flexShrink: 0,
                    background: pr.bg, border: `1px solid ${pr.border}`,
                    color: pr.color, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    {pr.label}
                  </span>
                </div>

                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
                  {rec.identificado}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                    <strong style={{ color: "#cbd5e1" }}>Por que importa: </strong>{rec.motivo}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                    <strong style={{ color: "#cbd5e1" }}>O que fazer agora: </strong>{rec.acao}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#64748b", lineHeight: 1.5, fontStyle: "italic" }}>
                    Evidência: {rec.evidencia}
                  </p>
                </div>

                {rec.destino && (
                  <button
                    onClick={() => onNavigate(rec.destino!)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: pr.color, color: "#0a0d14", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    {rec.destinoLabel || "Ver"} →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
