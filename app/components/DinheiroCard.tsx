"use client";
// ── Dinheiro / Caixa — Bloco F da Casa (Dashboard/Casa Premium V1) ────────
// Puramente apresentação: recebe IndicadoresCobranca já calculados por
// lib/motor-cobranca.ts (calcularIndicadoresCobranca — o MESMO motor real
// já homologado em app/cobrancas/page.tsx, nenhum cálculo novo aqui) e um
// callback de navegação. Mostra só o que a fonte financeira atual (public.
// cobrancas) consegue provar — nenhum sistema financeiro novo, nenhum
// número inventado. "oportunidade ≠ venda", "orçamento apresentado ≠
// receita": este card nunca lê orçamentos/oportunidades, só pagamento e
// cobrança reais.
import type { IndicadoresCobranca } from "../../lib/motor-cobranca";

type Props = {
  indicadores: IndicadoresCobranca | null;
  onNavigate: (destino: string) => void;
};

function formatarValor(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DinheiroCard({ indicadores, onNavigate }: Props) {
  return (
    <div className="dc" style={{
      background: "#12151f", border: "1px solid rgba(74,222,128,0.2)",
      borderRadius: 16, padding: "22px 24px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: indicadores ? 16 : 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(74,222,128,0.14)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>
          💵
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
            Dinheiro
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Só o que suas cobranças reais comprovam — nenhuma estimativa.
          </div>
        </div>
      </div>

      {!indicadores ? (
        <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
          Nenhuma cobrança registrada ainda. Cadastre suas cobranças para acompanhar entradas, atrasos e recuperações aqui.
          {" "}
          <span style={{ color: "#4ade80", cursor: "pointer", fontWeight: 600 }} onClick={() => onNavigate("/cobrancas")}>
            Ir para Cobranças →
          </span>
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          {[
            { label: "Recebido no mês",   valor: indicadores.valorRecebidoMes,  destaque: false },
            { label: "Em aberto",         valor: indicadores.valorEmAberto,     destaque: false },
            { label: "Em atraso",         valor: indicadores.valorEmAtraso,     destaque: (indicadores.valorEmAtraso ?? 0) > 0 },
            { label: "Recuperado no mês", valor: indicadores.valorRecuperadoMes, destaque: false },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => onNavigate("/cobrancas")}
              style={{
                textAlign: "left", cursor: "pointer",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${item.destaque ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12, padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 800, color: item.destaque ? "#f87171" : "#f1f5f9", lineHeight: 1.1, marginBottom: 6 }}>
                {formatarValor(item.valor)}
              </div>
              <div style={{ fontSize: 11.5, color: "#94a3b8" }}>{item.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
