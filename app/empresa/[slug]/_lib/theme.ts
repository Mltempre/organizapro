import type { Tema } from "./families";

// Tokens estruturais — compartilhados por todas as famílias visuais (ver
// _lib/families.ts). Só a paleta muda por família; espaçamento, raio-base de
// referência e sombra continuam um único sistema.
export const radius = { sm: 10, md: 18, lg: 26, xl: 32, pill: 999 };
export const shadow = {
  card: "0 1px 0 rgba(255,255,255,.04)",
  cardHover: "0 24px 60px -24px rgba(0,0,0,.72)",
  hero: "0 42px 100px rgba(0,0,0,.54), inset 0 1px rgba(255,255,255,.06)",
  ctaGlow: "inset 0 1px rgba(255,255,255,.12), 0 12px 30px rgba(11,41,50,.42)",
  ctaGlowHover: "inset 0 1px rgba(255,255,255,.16), 0 18px 42px rgba(11,41,50,.56)",
};
export const layout = { maxWidth: 1180, maxWidthNarrow: 760, section: "96px 24px" };
export const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const };

// Gradiente e sombra de destaque derivados do tema resolvido — nunca mais um
// gradiente azul-roxo fixo de tecnologia; a cor vem sempre da família.
export function gradienteDe(tema: Tema) {
  return `linear-gradient(145deg, ${tema.primary}, ${tema.primaryDeep})`;
}
export function brilhoCta(tema: Tema) {
  return `inset 0 1px rgba(255,255,255,.12), 0 14px 32px -8px ${tema.primaryDeep}99`;
}
