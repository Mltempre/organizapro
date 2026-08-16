"use client";
// ── Central de Oportunidades ──────────────────────────────────────────────
// Extraído de app/dashboard/page.tsx (Fase 2 do roadmap de Modo Demonstração
// — docs/modo-demonstracao-v1-arquitetura.md, seção 9). Puramente
// apresentação: recebe o resultado já calculado de gerarCentralOportunidades
// (lib/recomendacoes.ts) e um callback de navegação — nunca consulta o
// Supabase nem recalcula prioridade. Intelligence 2.2: diferente do Radar
// (um cartão por cliente), mostra TODAS as ações disponíveis agrupadas por
// urgência — o quadro completo.
import type { CentralOportunidades } from "../../lib/recomendacoes";
import { stTom, stTierOportunidade } from "./estilos-prioridade";

type Props = {
  central: CentralOportunidades;
  onNavigate: (destino: string) => void;
};

export default function CentralDeOportunidadesCard({ central, onNavigate }: Props) {
  const semOportunidades = central.alta.length + central.media.length + central.baixa.length === 0;

  return (
    <div className="dc" style={{
      background: "#12151f", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, padding: "22px 24px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(74,222,128,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>
          💰
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
            Central de Oportunidades
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            Ações que podem melhorar seu negócio hoje
          </div>
        </div>
      </div>

      {semOportunidades ? (
        <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
          Nenhuma oportunidade identificada agora com os dados atuais do seu negócio. Conforme sua agenda e sua base de clientes crescem, novas ações aparecem aqui automaticamente.
        </p>
      ) : (["alta", "media", "baixa"] as const).map(tier => {
        const itens = central[tier];
        if (itens.length === 0) return null;
        const meta = stTierOportunidade[tier];
        const cor = stTom[meta.tom];
        return (
          <div key={tier} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>{meta.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: cor.color }}>
                {meta.label}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
              {itens.map(op => (
                <div key={op.id} style={{
                  background: "rgba(255,255,255,0.03)", border: `1px solid ${cor.border}`,
                  borderRadius: 12, padding: "16px 18px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
                      {op.titulo}
                    </div>
                    <span style={{
                      flexShrink: 0, minWidth: 22, height: 22, padding: "0 6px",
                      borderRadius: 999, background: cor.bg, border: `1px solid ${cor.border}`,
                      color: cor.color, fontSize: 11, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {op.quantidade}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 8px" }}>
                    {op.explicacao}
                  </p>
                  <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4, margin: "0 0 10px", fontStyle: "italic" }}>
                    Por quê: {op.motivo}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    <span style={{
                      padding: "3px 9px", borderRadius: 999,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "#cbd5e1", fontSize: 10.5, fontWeight: 600,
                    }}>
                      💡 {op.impacto}
                    </span>
                    <span style={{
                      padding: "3px 9px", borderRadius: 999,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "#cbd5e1", fontSize: 10.5, fontWeight: 600,
                    }}>
                      ⏱ {op.tempoEstimado}
                    </span>
                  </div>
                  {op.destino ? (
                    <button
                      onClick={() => onNavigate(op.destino!)}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: cor.color, color: "#0a0d14", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      Resolver agora →
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: cor.color }}>
                      ✓ {op.acao}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
