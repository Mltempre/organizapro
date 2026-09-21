"use client";
// ── OrganizaPro trabalhando — Bloco G da Casa (Dashboard/Casa Premium V1) ──
// Puramente apresentação: recebe ItemAtividade[] já calculado por
// lib/organizapro-trabalhando.ts (calcularAtividadeRecente, a partir de
// eventos_dominio reais) — nenhuma consulta, nenhum cálculo de ROI/receita
// aqui. Nunca afirma "você ganhou R$X" sem cadeia de atribuição comprovada
// — só contagem real de ações realizadas pelo sistema nos últimos dias.
import type { ItemAtividade } from "../../lib/organizapro-trabalhando";

type Props = {
  itens: ItemAtividade[];
  indisponivel: boolean;
  dias: number;
};

export default function OrganizaProTrabalhandoCard({ itens, indisponivel, dias }: Props) {
  return (
    <div className="dc" style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14, padding: "20px", marginBottom: 20,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
        ⚙️ OrganizaPro trabalhando
      </div>

      {indisponivel ? (
        <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
          Não foi possível carregar a atividade recente agora.
        </p>
      ) : itens.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
          Nenhuma ação automática registrada nos últimos {dias} dias. Conforme você usa follow-up, cobrança e avaliações do Google, a atividade real aparece aqui.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {itens.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                minWidth: 28, height: 24, padding: "0 6px", borderRadius: 999,
                background: "rgba(74,155,176,0.14)", color: "#4a9bb0",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, flexShrink: 0,
              }}>
                {item.quantidade}
              </span>
              <span style={{ fontSize: 13, color: "#cbd5e1" }}>{item.label}</span>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 4 }}>
            Últimos {dias} dias.
          </div>
        </div>
      )}
    </div>
  );
}
