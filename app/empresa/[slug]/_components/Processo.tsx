import Reveal from "./Reveal";
import { PROCESSO } from "../_lib/content";

export default function Processo() {
  return (
    <section style={{ padding: "96px 24px", background: "#FAF7F2" }}>
      <Reveal>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#B8863D", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 12px" }}>Como funciona</p>
            <h2 style={{ fontSize: "clamp(30px,3.8vw,44px)", fontWeight: 800, color: "#14110D", margin: 0, lineHeight: 1.2 }}>Nosso processo de atendimento</h2>
          </div>
          <div className="processo-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 40, position: "relative" }}>
            <div className="processo-line" style={{ position: "absolute", top: 22, left: "18%", right: "18%", height: 1, background: "#E0D3B8" }}/>
            {PROCESSO.map((p, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#B8863D", background: "#FAF7F2", width: 44, height: 44, borderRadius: "50%", border: "1.5px solid #B8863D", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative", zIndex: 1 }}>
                  {p.numero}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#14110D", margin: "0 0 8px" }}>{p.titulo}</h3>
                <p style={{ fontSize: 14.5, color: "#6B6459", lineHeight: 1.7, margin: 0, maxWidth: 260 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
