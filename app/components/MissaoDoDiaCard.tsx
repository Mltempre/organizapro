"use client";
// ── 🎯 Missão do Dia — Núcleo Inteligente V1.1 ───────────────────────────
// Ver docs/nucleo-inteligente-v1-arquitetura.md, seção 4.5. Camada de
// orquestração, não um especialista: só apresenta os Sinais Canônicos que
// lib/nucleo-inteligente.ts já organizou. Nenhuma regra de negócio vive
// aqui, nenhuma automação — todo botão só navega, igual às demais telas.
import type { SinalCanonico } from "../../lib/nucleo-inteligente";

type Props = {
  sinais: SinalCanonico[];
  onNavigate: (destino: string) => void;
};

export default function MissaoDoDiaCard({ sinais, onNavigate }: Props) {
  return (
    <div className="dc" style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: "18px 20px", marginBottom: 20,
    }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", marginBottom: 2 }}>
        🎯 Sua missão de hoje
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
        Três prioridades para avançar seu negócio.
      </div>

      {sinais.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
          Nenhuma prioridade identificada agora — continue acompanhando seu negócio.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sinais.map((sinal, i) => (
            <div key={sinal.id} style={{
              display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "10px 14px",
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                background: "rgba(74,155,176,0.16)", color: "#4a9bb0",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800,
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 3 }}>
                  {sinal.titulo}
                </div>
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 2 }}>
                  {sinal.motivo}
                </div>
                <div style={{ fontSize: 10.5, color: "#64748b", fontStyle: "italic" }}>
                  Evidência: {sinal.evidencia}
                </div>
              </div>
              {sinal.destino && (
                <button
                  onClick={() => onNavigate(sinal.destino!)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(74,155,176,0.35)", background: "rgba(74,155,176,0.1)", color: "#4a9bb0", fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {sinal.destinoLabel || "Ver"} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
