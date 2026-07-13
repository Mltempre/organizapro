import Reveal from "./Reveal";
import { gerarTituloSobre } from "../_lib/helpers";
import { color, radius, gradient, eyebrow } from "../_lib/theme";
import type { Empresa } from "../_lib/types";

export default function Sobre({ empresa, nome, sobre }: { empresa: Empresa; nome: string; sobre: string[] }) {
  return (
    <section id="sobre" style={{ padding: "112px 24px", background: color.ink }}>
      <Reveal>
        <div className="sobre-grid" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 0.8fr", gap: 72, alignItems: "center" }}>
          <div>
            <span style={{ ...eyebrow, display: "inline-block", background: color.accentSoft, border: `1px solid ${color.accentBorder}`, color: color.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 20 }}>Sobre</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 800, color: color.text, margin: "0 0 28px", lineHeight: 1.2, letterSpacing: "-0.01em", maxWidth: 460 }}>
              {gerarTituloSobre(empresa)}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {sobre.map((bloco, i) => (
                <p key={i} style={{ fontSize: 16, color: color.textMuted, lineHeight: 1.8, margin: 0, maxWidth: 460, paddingLeft: 18, borderLeft: `2px solid ${i === 0 ? color.accent : color.line}` }}>{bloco}</p>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: radius.lg, overflow: "hidden", border: `1px solid ${color.line}` }}>
            {empresa.logo_url ? (
              <div style={{ width: "100%", height: "100%", background: color.ink2, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
                <img src={empresa.logo_url} alt={nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>
              </div>
            ) : (
              <div style={{ width: "100%", height: "100%", position: "relative", background: color.ink2 }}>
                <div style={{ position: "absolute", width: "70%", height: "70%", top: "-10%", right: "-14%", borderRadius: "50%", background: `radial-gradient(circle, rgba(74,155,176,0.16), transparent 70%)` }}/>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 88, height: 88, borderRadius: radius.lg, background: gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800, color: "#fff" }}>
                    {(nome || "?").trim().charAt(0).toUpperCase()}
                  </div>
                </div>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}/>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
