"use client";
// ── Indicadores Executivos ────────────────────────────────────────────────
// Extraído de app/dashboard/page.tsx (Fase 2 do roadmap de Modo Demonstração
// — docs/modo-demonstracao-v1-arquitetura.md, seção 9). Puramente
// apresentação: recebe os números já calculados e um callback de navegação,
// nunca consulta o Supabase nem decide a fonte do dado. Cada indicador leva
// a uma ação (regra de UX do Diretor, 2026-07-27) — nunca some quando o
// valor é zero, só mostra "0".
type Props = {
  compromissosHoje: number;
  horariosVagosHoje: number;
  pendentes: number;
  atrasados: number;
  avaliacoesPendentes: number;
  onNavigate: (destino: string) => void;
};

export default function IndicadoresExecutivos({
  compromissosHoje, horariosVagosHoje, pendentes, atrasados, avaliacoesPendentes, onNavigate,
}: Props) {
  return (
    <div className="dc indicadores-grid" style={{ marginBottom: 20 }}>
      {[
        { label: "Clientes hoje",         valor: compromissosHoje,          destino: "/agendamentos" },
        { label: "Horários vagos",        valor: horariosVagosHoje,         destino: "/agendamentos" },
        { label: "Pendências",            valor: pendentes + atrasados,     destino: "/agendamentos" },
        { label: "Avaliações aguardando", valor: avaliacoesPendentes,       destino: "/reputacao"    },
      ].map(ind => (
        <button
          key={ind.label}
          className="indicador-tile"
          onClick={() => onNavigate(ind.destino)}
          style={{
            textAlign: "left", cursor: "pointer",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "16px", transition: "border-color 0.15s",
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 900, color: "#f1f5f9", lineHeight: 1, marginBottom: 6 }}>
            {ind.valor}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{ind.label}</div>
        </button>
      ))}
    </div>
  );
}
