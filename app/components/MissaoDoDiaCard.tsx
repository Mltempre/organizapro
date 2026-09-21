"use client";
// ── 🧭 Diretor Digital — Bloco B da Casa (Dashboard/Casa Premium V1) ─────
// Consolida em UM único bloco o que antes eram dois blocos empilhados
// mostrando o mesmo conjunto de sinais: a narrativa do IA Comercial (lib/
// ia-comercial.ts, gerarNarrativaDiretor) e a Missão do Dia (Núcleo
// Inteligente V1.1, lib/nucleo-inteligente.ts, gerarMissaoDoDia — top-3
// Sinais Canônicos, mesma priorização/desempate do Radar). Nenhuma regra
// de negócio vive aqui, nenhuma automação — todo botão só navega, igual
// às demais telas. Ver docs/nucleo-inteligente-v1-arquitetura.md, seção 4.5.
import type { SinalCanonico } from "../../lib/nucleo-inteligente";

type Props = {
  narrativa?: string;
  sinais: SinalCanonico[];
  onNavigate: (destino: string) => void;
  /** Correção Visual Final V1: a Home passa "Prioridade do Dia" + 1 único
   * sinal (`sinais` já vem cortado pelo caller) — texto padrão continua
   * servindo qualquer reaproveitamento futuro com a lista completa. */
  titulo?: string;
  subtitulo?: string;
};

export default function MissaoDoDiaCard({ narrativa, sinais, onNavigate, titulo, subtitulo }: Props) {
  return (
    <div className="dc" style={{
      background: "#12151f", border: "1px solid rgba(56,189,248,0.22)",
      borderRadius: 16, padding: "20px 22px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(56,189,248,0.16)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0,
        }}>
          🧭
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
            {titulo ?? "Diretor Digital"}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {subtitulo ?? "3 prioridades para hoje, com base no seu histórico real"}
          </div>
        </div>
      </div>

      {narrativa && (
        <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 14px" }}>
          {narrativa}
        </p>
      )}

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
              <div style={{ flex: 1, minWidth: 0 }}>
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
