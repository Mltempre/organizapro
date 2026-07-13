import Reveal, { RevealItem } from "./Reveal";
import { PROCESSO } from "../_lib/content";
import { color, eyebrow, radius } from "../_lib/theme";

export default function Processo() {
  return (
    <section style={{ padding: "112px 24px", background: color.ink2 }}>
      <Reveal>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: color.accentSoft, border: `1px solid ${color.accentBorder}`, color: color.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 16 }}>Como funciona</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 800, color: color.text, margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>Nosso processo de atendimento</h2>
          </div>
          <div className="processo-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 40, position: "relative" }}>
            <div className="processo-line" style={{ position: "absolute", top: 21, left: "18%", right: "18%", height: 1, background: color.line }}/>
            {PROCESSO.map((p, i) => (
              <RevealItem key={i} index={i} step={0.08}>
                <div style={{ position: "relative" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: color.accent, background: color.ink2, width: 42, height: 42, borderRadius: "50%", border: `1.5px solid ${color.accent}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative", zIndex: 1 }}>
                    {p.numero}
                  </div>
                  <h3 style={{ fontSize: 16.5, fontWeight: 700, color: color.text, margin: "0 0 8px" }}>{p.titulo}</h3>
                  <p style={{ fontSize: 14, color: color.textMuted, lineHeight: 1.7, margin: 0, maxWidth: 260 }}>{p.desc}</p>
                </div>
              </RevealItem>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
