export const color = {
  ink: "#0d1016",
  ink2: "#10141c",
  ink3: "#090c11",
  surface: "rgba(255,255,255,0.035)",
  surfaceHover: "rgba(255,255,255,0.055)",
  line: "rgba(255,255,255,0.09)",
  lineStrong: "rgba(138,190,203,0.24)",
  text: "#f8fafc",
  textBody: "#d6dee7",
  textMuted: "#9aa8b9",
  textFaint: "#687589",
  accent: "#79bdcd",
  accentSoft: "rgba(55,134,154,0.09)",
  accentBorder: "rgba(103,187,207,0.25)",
  gradA: "#347f95",
  gradB: "#1c4d5d",
  live: "#5fba8d",
  star: "#fbbf24",
};

export const gradient = `linear-gradient(145deg, ${color.gradA}, ${color.gradB})`;
export const radius = { sm: 10, md: 18, lg: 26, xl: 32, pill: 999 };
export const shadow = {
  card: "0 1px 0 rgba(255,255,255,.04)",
  cardHover: "0 24px 60px -24px rgba(0,0,0,.72)",
  hero: "0 42px 100px rgba(0,0,0,.54), inset 0 1px rgba(255,255,255,.06)",
  ctaGlow: "inset 0 1px rgba(255,255,255,.12), 0 12px 30px rgba(11,41,50,.42)",
  ctaGlowHover: "inset 0 1px rgba(255,255,255,.16), 0 18px 42px rgba(11,41,50,.56)",
};
export const layout = { maxWidth: 1180, maxWidthNarrow: 760, section: "96px 24px" };
export const font = { family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };
export const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const };
