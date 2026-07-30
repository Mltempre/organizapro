// ── Estilos compartilhados de prioridade/urgência ────────────────────────
// Extraído de app/dashboard/page.tsx (Fase 2 do roadmap de Modo Demonstração
// — docs/modo-demonstracao-v1-arquitetura.md, seção 9) para que Próxima
// Melhor Ação, Radar de Oportunidades e Central de Oportunidades usem uma
// única fonte de verdade para cor/emoji por prioridade, em vez de cada
// componente extraído duplicar a mesma paleta. Nenhuma mudança de valor —
// cópia exata do que já existia inline em app/dashboard/page.tsx.
export const stTom: Record<"critico" | "positivo" | "neutro" | "atencao", { bg: string; border: string; color: string }> = {
  critico:  { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)",  color: "#f87171" },
  atencao:  { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",   color: "#fbbf24" },
  positivo: { bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.3)",   color: "#4ade80" },
  neutro:   { bg: "rgba(74,155,176,0.12)",  border: "rgba(74,155,176,0.3)",   color: "#4a9bb0" },
};

// Central de Oportunidades e "Próxima Melhor Ação" (mesma paleta) — os
// emojis 🔴🟡🟢 usados para agrupar visualmente os cartões por urgência.
// Paleta unificada em todo o Dashboard (2026-07-27): "baixa" deixou de usar
// azul (🔵/neutro) para usar verde (🟢/positivo) — um único vocabulário de
// cor em toda a tela, em vez de dois esquemas parecidos.
export const stTierOportunidade: Record<"alta" | "media" | "baixa", { emoji: string; label: string; tom: keyof typeof stTom }> = {
  alta:  { emoji: "🔴", label: "Alta prioridade",  tom: "critico"  },
  media: { emoji: "🟡", label: "Média prioridade", tom: "atencao"  },
  baixa: { emoji: "🟢", label: "Baixa prioridade", tom: "positivo" },
};
