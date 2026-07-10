import { IcWa } from "./icons";
import type { Empresa } from "../_lib/types";

export default function Hero({ empresa, esp, local, titulo, subtitulo, waLink, whatsappNumber }: {
  empresa: Empresa; esp: string; local: string; titulo: string; subtitulo: string; waLink: string; whatsappNumber?: string;
}) {
  return (
    <section id="hero" style={{ background: "#ffffff", position: "relative", overflow: "hidden" }}>
      {/* camada tipográfica de fundo — dá profundidade e tensão visual sem competir com o texto real */}
      <div aria-hidden style={{
        position: "absolute", top: "6%", left: "-2%", zIndex: 0, pointerEvents: "none",
        fontFamily: "'Fraunces',Georgia,serif", fontSize: "clamp(140px,22vw,340px)", fontWeight: 600,
        color: "#14110D", opacity: 0.035, lineHeight: 1, letterSpacing: "-0.04em", whiteSpace: "nowrap",
      }}>
        Confiança
      </div>

      <div className="hero-grid" style={{ maxWidth: 1220, margin: "0 auto", padding: "156px 24px 96px", position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 0.92fr", gap: 64, alignItems: "center" }}>
        {/* ── coluna texto ── */}
        <div>
          {(esp || local) && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#FAF7F2", border: "1px solid #E8E1D4", borderRadius: 50, padding: "7px 16px", marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#B8863D", display: "inline-block" }}/>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#B8863D", letterSpacing: "0.04em" }}>{esp}{esp && local ? " · " : ""}{local}</span>
            </div>
          )}
          <h1 className="hero-title" style={{
            fontSize: "clamp(36px,4.6vw,58px)", fontWeight: 550, color: "#14110D", lineHeight: 1.12,
            margin: "0 0 22px", letterSpacing: "-0.02em", maxWidth: 520,
          }}>
            {titulo}
          </h1>
          <p style={{ fontSize: "clamp(16px,1.5vw,18px)", color: "#6B6459", margin: "0 0 40px", maxWidth: 440, lineHeight: 1.7, fontWeight: 400 }}>
            {subtitulo}
          </p>
          <div className="hero-ctas" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 30 }}>
            {whatsappNumber && (
              <a href={waLink} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "17px 34px", borderRadius: 8, background: "#14110D", color: "#ffffff", textDecoration: "none", fontWeight: 600, fontSize: 15.5, boxShadow: "0 14px 32px rgba(20,17,13,0.22)", transition: "background 0.2s,box-shadow 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#B8863D"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 14px 32px rgba(184,134,61,0.35)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#14110D"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 14px 32px rgba(20,17,13,0.22)"; }}>
                <IcWa size={17}/> Falar pelo WhatsApp
              </a>
            )}
            <a href="#servicos" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "17px 28px", borderRadius: 8, border: "1.5px solid #E8E1D4", color: "#14110D", textDecoration: "none", fontSize: 15, fontWeight: 600, transition: "border-color 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#B8863D"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#E8E1D4"; }}>
              Conhecer os serviços
            </a>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px" }}>
            {["Atendimento profissional", "Resposta rápida", "Experiência personalizada"].map((t, i) => (
              <span key={i} style={{ fontSize: 12.5, fontWeight: 600, color: "#6B6459", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#B8863D", display: "inline-block" }}/>{t}
              </span>
            ))}
          </div>
        </div>

        {/* ── coluna visual: foto real, ou composição abstrata editorial ── */}
        <div className="hero-visual" style={{ position: "relative", aspectRatio: "4 / 5", borderRadius: 20, overflow: "hidden", boxShadow: "0 40px 80px -20px rgba(20,17,13,0.35), 0 0 0 1px rgba(20,17,13,0.04)" }}>
          {empresa.hero_url ? (
            <img src={empresa.hero_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          ) : (
            <div style={{ width: "100%", height: "100%", position: "relative", background: "#14110D" }}>
              <div style={{ position: "absolute", width: "72%", height: "72%", top: "-12%", right: "-16%", borderRadius: "50%", background: "radial-gradient(circle,rgba(184,134,61,0.60),transparent 68%)", filter: "blur(2px)" }}/>
              <div style={{ position: "absolute", width: "60%", height: "60%", bottom: "-15%", left: "-10%", borderRadius: "50%", background: "radial-gradient(circle,rgba(120,95,60,0.45),transparent 70%)", filter: "blur(6px)" }}/>
              <div style={{ position: "absolute", width: "45%", height: "45%", top: "30%", left: "20%", borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,0.06),transparent 72%)" }}/>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "20px 20px", mixBlendMode: "overlay" }}/>
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="none" viewBox="0 0 100 100">
                <line x1="0" y1="72" x2="100" y2="34" stroke="rgba(212,168,94,0.20)" strokeWidth="0.4"/>
                <line x1="0" y1="86" x2="100" y2="48" stroke="rgba(212,168,94,0.10)" strokeWidth="0.4"/>
              </svg>
              <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 90px rgba(0,0,0,0.35)" }}/>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
