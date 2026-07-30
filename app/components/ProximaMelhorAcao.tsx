"use client";
// ── Próxima Melhor Ação ───────────────────────────────────────────────────
// Extraído de app/dashboard/page.tsx (Fase 2 do roadmap de Modo Demonstração
// — docs/modo-demonstracao-v1-arquitetura.md, seção 9). Puramente
// apresentação: recebe a lista já ordenada de AcaoPrioritaria (gerada por
// gerarProximasAcoes, que continua em app/dashboard/page.tsx) e um callback
// de navegação — nunca consulta o Supabase nem recalcula prioridade/
// desempate. O primeiro item da lista já ordenada vira o card em destaque;
// o resto (no máximo 4) fica abaixo como "Outras oportunidades".
import { stTom, stTierOportunidade } from "./estilos-prioridade";

export type AcaoPrioritaria = {
  id:            string;
  titulo:        string;
  prioridade:    "alta" | "media" | "baixa";
  destino?:      string;
  destinoLabel?: string;
  contexto?:     string; // nome do cliente, quando a ação é de um cliente específico
  motivo?:       string; // por que essa ação existe
  tempoEstimado: string; // "2 minutos" | "3 minutos" | "5 minutos" — por tipo de botão, nunca calculado
  whatsapp?:     string; // link wa.me pronto, só quando há telefone do cliente
};

type Props = {
  acoes: AcaoPrioritaria[];
  onNavigate: (destino: string) => void;
};

export default function ProximaMelhorAcao({ acoes, onNavigate }: Props) {
  return (
    <div className="dc" style={{
      background: "#12151f", border: "1px solid rgba(245,158,11,0.22)",
      borderRadius: 16, padding: "22px 24px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(245,158,11,0.16)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>
          🚀
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
          Próxima Melhor Ação
        </div>
      </div>

      {acoes.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
          Tudo sob controle por enquanto. Novas recomendações aparecerão conforme o OrganizaPro identificar oportunidades.
        </p>
      ) : (() => {
        const [destaque, ...outras] = acoes;
        const meta = stTierOportunidade[destaque.prioridade];
        const cor = stTom[meta.tom];
        return (
          <>
            <div style={{
              background: "rgba(255,255,255,0.04)", border: `1px solid ${cor.border}`,
              borderRadius: 12, padding: "18px 20px", marginBottom: outras.length > 0 ? 18 : 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  {destaque.contexto && (
                    <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, marginBottom: 2 }}>
                      {destaque.contexto}
                    </div>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>
                    {destaque.titulo}
                  </div>
                </div>
                <span style={{
                  padding: "3px 9px", borderRadius: 999, flexShrink: 0,
                  background: cor.bg, border: `1px solid ${cor.border}`,
                  color: cor.color, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
                }}>
                  {meta.emoji} {meta.label}
                </span>
              </div>

              {destaque.motivo && (
                <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5 }}>
                  {destaque.motivo}
                </p>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                <span style={{
                  padding: "2px 8px", borderRadius: 999,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#94a3b8", fontSize: 10.5, fontWeight: 600,
                }}>
                  ⏱ {destaque.tempoEstimado}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {destaque.whatsapp && (
                  <a
                    href={destaque.whatsapp}
                    target="_blank" rel="noopener noreferrer"
                    style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: cor.color, color: "#0a0d14", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}
                  >
                    💬 Abrir WhatsApp
                  </a>
                )}
                {destaque.destino && (
                  <button
                    onClick={() => onNavigate(destaque.destino!)}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(74,155,176,0.35)", background: "rgba(74,155,176,0.1)", color: "#4a9bb0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                  >
                    {destaque.destinoLabel || "Ver"} →
                  </button>
                )}
              </div>
            </div>

            {outras.length > 0 && (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
                  Outras oportunidades
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {outras.map(acao => {
                    const m = stTierOportunidade[acao.prioridade];
                    const c = stTom[m.tom];
                    return (
                      <div key={acao.id} style={{
                        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                        background: "rgba(255,255,255,0.03)", border: `1px solid ${c.border}`,
                        borderRadius: 12, padding: "12px 16px",
                      }}>
                        <span style={{ fontSize: 15 }}>{m.emoji}</span>
                        <span style={{ fontSize: 13.5, color: "#f1f5f9", fontWeight: 600, flex: 1, minWidth: 160 }}>
                          {acao.titulo}
                        </span>
                        {acao.destino && (
                          <button
                            onClick={() => onNavigate(acao.destino!)}
                            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: c.color, color: "#0a0d14", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            {acao.destinoLabel || "Ver"} →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
