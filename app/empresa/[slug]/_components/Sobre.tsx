import Reveal from "./Reveal";
import type { Empresa } from "../_lib/types";

export default function Sobre({ empresa, nome, sobre }: { empresa: Empresa; nome: string; sobre: string[] }) {
  return (
    <section id="sobre" style={{ padding: "104px 24px", background: "#ffffff" }}>
      <Reveal>
        <div className="sobre-grid" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 0.85fr", gap: 72, alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#B8863D", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>Sobre</p>
            <h2 style={{ fontSize: "clamp(28px,3.4vw,40px)", fontWeight: 700, color: "#14110D", margin: "0 0 30px", lineHeight: 1.22, maxWidth: 480 }}>
              Uma empresa pensada para atender você bem
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {sobre.map((bloco, i) => (
                <p key={i} style={{ fontSize: 16.5, color: "#6B6459", lineHeight: 1.85, margin: 0, maxWidth: 480, paddingLeft: 18, borderLeft: i === 0 ? "2px solid #B8863D" : "2px solid #E8E1D4" }}>{bloco}</p>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 20, overflow: "hidden" }}>
            {empresa.logo_url ? (
              <div style={{ width: "100%", height: "100%", background: "#FAF7F2", border: "1px solid #E8E1D4", display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
                <img src={empresa.logo_url} alt={nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>
              </div>
            ) : (
              <div style={{ width: "100%", height: "100%", position: "relative", background: "linear-gradient(165deg,#FAF7F2 0%,#E8E1D4 100%)" }}>
                <div style={{ position: "absolute", width: "65%", height: "65%", top: "10%", right: "-10%", borderRadius: "50%", background: "radial-gradient(circle,rgba(184,134,61,0.12),transparent 70%)" }}/>
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="none" viewBox="0 0 100 100">
                  <line x1="0" y1="20" x2="100" y2="60" stroke="rgba(184,134,61,0.12)" strokeWidth="0.5"/>
                  <line x1="0" y1="40" x2="100" y2="80" stroke="rgba(184,134,61,0.07)" strokeWidth="0.5"/>
                </svg>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(184,134,61,0.09) 1px, transparent 1px)", backgroundSize: "22px 22px" }}/>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
