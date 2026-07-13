// Sistema de design do Site Premium — DERIVADO da Landing Oficial do
// OrganizaPro (app/page.tsx), não copiado dela. Mesma família visual: fundo
// escuro, gradiente petróleo, cards "vidro", pills de eyebrow, CTA com o
// mesmo gradiente (nunca verde de WhatsApp — a própria Landing já toma essa
// decisão: o botão que abre o WhatsApp usa o gradiente da marca, não verde).
// Trocar o visual inteiro do site é, na prática, trocar este arquivo.

export const color = {
  ink: "#0f1117",
  ink2: "#0c0e14",
  ink3: "#0a0b10",
  surface: "rgba(255,255,255,0.03)",
  surfaceHover: "rgba(255,255,255,0.05)",
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.14)",
  text: "#f8fafc",
  textBody: "#e2e8f0",
  textMuted: "#94a3b8",
  textFaint: "#64748b",
  accent: "#4a9bb0",
  accentSoft: "rgba(74,155,176,0.12)",
  accentBorder: "rgba(74,155,176,0.30)",
  gradA: "#1F4E5F",
  gradB: "#0d3547",
  live: "#4ade80",
  star: "#fbbf24",
};

export const gradient = `linear-gradient(135deg, ${color.gradA}, ${color.gradB})`;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };

export const shadow = {
  card: "0 1px 2px rgba(0,0,0,0.2)",
  cardHover: "0 20px 44px -16px rgba(0,0,0,0.45)",
  hero: "0 40px 100px rgba(0,0,0,0.5), 0 0 90px rgba(74,155,176,0.18)",
  ctaGlow: "0 4px 20px rgba(31,78,95,0.4)",
  ctaGlowHover: "0 8px 30px rgba(31,78,95,0.55)",
};

export const layout = { maxWidth: 1180, maxWidthNarrow: 760, section: "128px 24px" };

export const font = {
  family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export const eyebrow = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};
