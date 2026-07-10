import Reveal from "./Reveal";
import { Icon } from "./icons";
import { DIFERENCIAIS } from "../_lib/content";

export default function Diferenciais() {
  return (
    <section style={{ padding: "112px 24px", background: "#14110D", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle,rgba(184,134,61,0.10) 0%,transparent 70%)", top: "-20%", right: "-10%" }}/>
      <Reveal>
        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
          <div style={{ marginBottom: 72, maxWidth: 560 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#D4A85E", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 16px" }}>Por que nos escolher</p>
            <h2 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: "clamp(30px,4vw,46px)", fontWeight: 550, color: "#ffffff", margin: 0, lineHeight: 1.2 }}>Diferenciais</h2>
          </div>
          <div className="dif-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", columnGap: 64, rowGap: 0 }}>
            {DIFERENCIAIS.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 24, padding: "30px 0", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
                <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 28, fontWeight: 500, color: "#B8863D", flexShrink: 0, width: 40 }}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Icon name={d.icone} size={17} color="#D4A85E"/>
                    <h3 style={{ fontSize: 16.5, fontWeight: 700, color: "#ffffff", margin: 0 }}>{d.titulo}</h3>
                  </div>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: 0 }}>{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
