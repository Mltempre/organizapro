"use client";
// ── Faixa Executiva — Bloco C da Casa (Dashboard/Casa Premium V1) ────────
// Puramente apresentação: recebe números já calculados alhures (Radar,
// Orçamentos, Cobranças, Agenda, Avaliações) e um callback de navegação —
// nunca consulta o Supabase, nunca calcula nada. "poucos indicadores
// executivos": Correção Visual Final V1 absorveu aqui o antigo bloco
// IndicadoresExecutivos (que ficava mais abaixo, repetindo a mesma ideia
// de "números do dia" numa segunda faixa) — uma única faixa, nunca duas.
// value === null (nunca fabricar) mostra "—", não "0".
import { stTom } from "./estilos-prioridade";

type Indicador = {
  label: string;
  valor: number | null;
  destino: string;
  tom: keyof typeof stTom;
};

type Props = {
  oportunidades: number;
  orcamentosParados: number;
  cobrancasAbertas: number | null;
  compromissosHoje: number;
  avaliacoesPendentes: number;
  onNavigate: (destino: string) => void;
};

export default function FaixaExecutiva({ oportunidades, orcamentosParados, cobrancasAbertas, compromissosHoje, avaliacoesPendentes, onNavigate }: Props) {
  const indicadores: Indicador[] = [
    { label: "Oportunidades",      valor: oportunidades,        destino: "/copiloto",      tom: oportunidades > 0 ? "atencao" : "neutro" },
    { label: "Orçamentos parados", valor: orcamentosParados,    destino: "/orcamentos",    tom: orcamentosParados > 0 ? "atencao" : "neutro" },
    { label: "A receber",          valor: cobrancasAbertas,     destino: "/cobrancas",     tom: (cobrancasAbertas ?? 0) > 0 ? "atencao" : "neutro" },
    { label: "Agenda hoje",        valor: compromissosHoje,     destino: "/agendamentos",  tom: "neutro" },
    { label: "Avaliações aguardando", valor: avaliacoesPendentes, destino: "/reputacao",   tom: avaliacoesPendentes > 0 ? "atencao" : "neutro" },
  ];

  return (
    <div className="dc faixa-executiva-grid" style={{ marginBottom: 20 }}>
      {indicadores.map((ind) => {
        const cor = stTom[ind.tom];
        return (
          <button
            key={ind.label}
            className="indicador-tile"
            onClick={() => onNavigate(ind.destino)}
            style={{
              textAlign: "left", cursor: "pointer",
              background: "rgba(255,255,255,0.03)", border: `1px solid ${cor.border}`,
              borderRadius: 12, padding: "16px", transition: "border-color 0.15s",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 900, color: ind.valor && ind.valor > 0 ? cor.color : "#f1f5f9", lineHeight: 1, marginBottom: 6 }}>
              {ind.valor === null ? "—" : ind.valor}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{ind.label}</div>
          </button>
        );
      })}
    </div>
  );
}
