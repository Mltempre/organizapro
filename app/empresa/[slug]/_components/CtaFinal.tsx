import Reveal from "./Reveal";
import { IcWa, IcPhone } from "./icons";
import { gerarTituloCtaFinal } from "../_lib/helpers";
import { color, gradient, radius, shadow } from "../_lib/theme";
import type { Empresa } from "../_lib/types";

export default function CtaFinal({ empresa, waLink, whatsappNumber }: { empresa: Empresa; waLink: string; whatsappNumber?: string }) {
  if (!whatsappNumber && !empresa.telefone) return null;
  return (
    <section style={{ background: `radial-gradient(ellipse at center, rgba(74,155,176,0.12), ${color.ink} 65%)`, padding: "116px 24px", textAlign: "center" }}>
      <Reveal>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontSize: 40, marginBottom: 18 }}>💬</div>
          <h2 style={{ fontSize: "clamp(28px,4.2vw,44px)", fontWeight: 900, color: color.text, margin: "0 0 18px", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            {gerarTituloCtaFinal(empresa)}
          </h2>
          <p style={{ fontSize: 16, color: color.textMuted, margin: "0 0 40px", lineHeight: 1.65 }}>
            Fale com a gente agora e receba uma resposta rápida e direta.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {whatsappNumber && (
              <a href={waLink} target="_blank" rel="noreferrer" className="btn-hero-glow" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "17px 36px", borderRadius: radius.sm, background: gradient, color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 16, boxShadow: shadow.ctaGlow }}>
                <IcWa/> Falar no WhatsApp
              </a>
            )}
            {empresa.telefone && (
              <a href={"tel:" + empresa.telefone} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "17px 30px", borderRadius: radius.sm, border: `1.5px solid ${color.line}`, color: color.text, textDecoration: "none", fontWeight: 600, fontSize: 15 }}>
                <IcPhone/> {empresa.telefone}
              </a>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
