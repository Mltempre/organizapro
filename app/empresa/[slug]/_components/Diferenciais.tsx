import Reveal, { RevealItem } from "./Reveal";
import { Icon } from "./icons";
import { DIFERENCIAIS } from "../_lib/content";
import { color, radius, eyebrow } from "../_lib/theme";

export default function Diferenciais() {
  return (
    <section style={{ padding: "112px 24px", background: color.ink, position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", width: 620, height: 620, borderRadius: "50%", background: "radial-gradient(circle, rgba(74,155,176,0.14) 0%, transparent 70%)", top: "-22%", right: "-8%" }}/>
      <Reveal>
        <div style={{ maxWidth: 1180, margin: "0 auto", position: "relative" }}>
          <div style={{ marginBottom: 56, maxWidth: 560 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: color.accentSoft, border: `1px solid ${color.accentBorder}`, color: color.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 18 }}>Por que nos escolher</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 800, color: color.text, margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>Diferenciais</h2>
          </div>
          <div className="dif-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {DIFERENCIAIS.map((d, i) => (
              <RevealItem key={i} index={i} step={0.05}>
                <div className="dif-card" style={{ background: color.surface, border: `1px solid ${color.line}`, borderRadius: radius.md, padding: 26, height: "100%", transition: "background 0.25s, border-color 0.25s, transform 0.25s" }}>
                  <div style={{ width: 38, height: 38, borderRadius: radius.sm, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                    <Icon name={d.icone} size={17} color={color.accent}/>
                  </div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 700, color: color.text, margin: "0 0 8px" }}>{d.titulo}</h3>
                  <p style={{ fontSize: 13.5, color: color.textMuted, lineHeight: 1.65, margin: 0 }}>{d.desc}</p>
                </div>
              </RevealItem>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
