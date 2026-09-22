"use client";
// ── Radar de Oportunidades — Bloco D da Casa ──────────────────────────────
// Extraído de app/dashboard/page.tsx (Fase 2 do roadmap de Modo Demonstração
// — docs/modo-demonstracao-v1-arquitetura.md, seção 9). Puramente
// apresentação: recebe a lista já calculada de OportunidadeCliente
// (lib/oportunidades-clientes.ts) e um callback de navegação — nunca
// consulta o Supabase nem recalcula prioridade/desempate. V1 se chamava
// "Agenda Autônoma de Receita" — mesma base, nenhum envio automático.
//
// `limite` (Correção Visual Final V1): a Home mostra só um RESUMO — "Radar
// resumido, não motor inteiro" — os primeiros N (por prioridade/desempate,
// mesma ordem já calculada) e um link "Ver todas" para `verTodasDestino`
// (hoje /copiloto — mesmo motor gerarOportunidadesClientes, uncapped, a
// profundidade real deste Radar; nunca /oportunidades, outro domínio)
// quando há mais. Sem `limite`, mostra a lista inteira (comportamento
// original, preservado para qualquer reaproveitamento futuro).
import type { OportunidadeCliente } from "../../lib/oportunidades-clientes";
import { stTom, stTierOportunidade } from "./estilos-prioridade";

type Props = {
  oportunidades: OportunidadeCliente[];
  resumo: string;
  onNavigate: (destino: string) => void;
  limite?: number;
  verTodasDestino?: string;
};

export default function RadarDeOportunidades({ oportunidades, resumo, onNavigate, limite, verTodasDestino }: Props) {
  const exibidas = limite ? oportunidades.slice(0, limite) : oportunidades;
  const restantes = oportunidades.length - exibidas.length;

  return (
    <div className="dc" style={{
      background: "#12151f", border: "1px solid rgba(124,58,237,0.22)",
      borderRadius: 16, padding: "22px 24px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(124,58,237,0.16)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>
          🎯
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
            Radar de Oportunidades
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            {oportunidades.length > 0
              ? resumo
              : "Nenhuma oportunidade urgente encontrada hoje. Continue acompanhando seus clientes e compromissos."}
          </div>
        </div>
      </div>

      {exibidas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12, marginTop: 16 }}>
          {exibidas.map(op => {
            const meta = stTierOportunidade[op.prioridade];
            const cor = stTom[meta.tom];
            const numeroWpp = op.telefone ? (op.telefone.length > 11 ? op.telefone : `55${op.telefone}`) : null;
            return (
              <div key={op.chave} style={{
                background: "rgba(255,255,255,0.03)", border: `1px solid ${cor.border}`,
                borderRadius: 12, padding: "16px 18px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
                    {op.nome}
                  </div>
                  <span style={{
                    padding: "3px 9px", borderRadius: 999, flexShrink: 0,
                    background: cor.bg, border: `1px solid ${cor.border}`,
                    color: cor.color, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    {meta.emoji} {meta.label}
                  </span>
                </div>

                <p style={{ margin: "0 0 6px", fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5 }}>
                  {op.motivoPrincipal}
                </p>

                {(op.tempoDecorrido || op.sinaisAdicionais > 0) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {op.tempoDecorrido && (
                      <span style={{
                        padding: "2px 8px", borderRadius: 999,
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#94a3b8", fontSize: 10.5, fontWeight: 600,
                      }}>
                        ⏱ {op.tempoDecorrido}
                      </span>
                    )}
                    {op.sinaisAdicionais > 0 && (
                      <span style={{
                        padding: "2px 8px", borderRadius: 999,
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#94a3b8", fontSize: 10.5, fontWeight: 600,
                      }}>
                        +{op.sinaisAdicionais} outro{op.sinaisAdicionais > 1 ? "s" : ""} sinal{op.sinaisAdicionais > 1 ? "is" : ""}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600, marginBottom: 12 }}>
                  ✓ {op.acaoSugerida}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => onNavigate("/clientes")}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(74,155,176,0.35)", background: "rgba(74,155,176,0.1)", color: "#4a9bb0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                  >
                    Abrir cliente
                  </button>
                  {numeroWpp ? (
                    <a
                      href={`https://wa.me/${numeroWpp}?text=${encodeURIComponent(`Olá, ${op.nome}! Tudo bem?`)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: cor.color, color: "#0a0d14", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}
                    >
                      💬 Entrar em contato
                    </a>
                  ) : (
                    <span style={{ fontSize: 11.5, color: "#64748b", fontStyle: "italic" }}>
                      Sem telefone cadastrado
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {restantes > 0 && verTodasDestino && (
        <button
          onClick={() => onNavigate(verTodasDestino)}
          style={{
            marginTop: 14, padding: "8px 16px", borderRadius: 8,
            border: "1px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.08)",
            color: "#a78bfa", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
          }}
        >
          Ver todas as {oportunidades.length} oportunidades →
        </button>
      )}
    </div>
  );
}
