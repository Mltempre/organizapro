import { IcWa, Icon } from "./icons";
import { gerarIndicadoresConfianca } from "../_lib/helpers";
import { CONFIANCA_FALLBACK } from "../_lib/content";
import { color, gradient, radius, shadow } from "../_lib/theme";
import type { Empresa } from "../_lib/types";

export default function Hero({ empresa, esp, local, titulo, subtitulo, waLink, whatsappNumber }: {
  empresa: Empresa; esp: string; local: string; titulo: string; subtitulo: string; waLink: string; whatsappNumber?: string;
}) {
  const indicadores = gerarIndicadoresConfianca(empresa, local);
  const temIndicadores = indicadores.length > 0;

  return (
    <section id="hero" style={{ background: `radial-gradient(ellipse at top, rgba(31,78,95,0.35), ${color.ink} 65%)`, padding: "148px 24px 96px" }}>
      <div className="hero-grid" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 56, alignItems: "center" }}>
        {/* ── coluna texto ── */}
        <div>
          {(esp || local) && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: color.accentSoft, border: `1px solid ${color.accentBorder}`, borderRadius: radius.pill, padding: "6px 16px", marginBottom: 26 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color.accent, display: "inline-block" }}/>
              <span style={{ fontSize: 13, fontWeight: 700, color: color.accent }}>{esp}{esp && local ? " · " : ""}{local}</span>
            </div>
          )}
          <h1 className="hero-title" style={{
            fontSize: "clamp(34px,4.4vw,52px)", fontWeight: 900, color: color.text, lineHeight: 1.12,
            margin: "0 0 20px", letterSpacing: "-0.02em", maxWidth: 540,
          }}>
            {titulo}
          </h1>
          <p style={{ fontSize: "clamp(16px,1.4vw,18px)", color: color.textMuted, margin: "0 0 36px", maxWidth: 440, lineHeight: 1.7 }}>
            {subtitulo}
          </p>
          <div className="hero-ctas" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 30 }}>
            {whatsappNumber && (
              <a href={waLink} target="_blank" rel="noreferrer" className="btn-hero-glow" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "17px 32px", borderRadius: radius.sm, background: gradient, color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 15.5, boxShadow: shadow.ctaGlow }}>
                <IcWa size={17}/> Falar pelo WhatsApp
              </a>
            )}
            <a href="#servicos" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "17px 26px", borderRadius: radius.sm, border: `1.5px solid ${color.line}`, color: color.textBody, textDecoration: "none", fontSize: 14.5, fontWeight: 600, transition: "border-color 0.2s, background 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = color.accentBorder; (e.currentTarget as HTMLAnchorElement).style.background = color.accentSoft; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = color.line; (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}>
              Conhecer os serviços
            </a>
          </div>

          {/* indicadores de confiança — dado real quando existe, honesto quando não */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "9px 24px", paddingTop: 22, borderTop: `1px solid ${color.line}` }}>
            {(temIndicadores ? indicadores : CONFIANCA_FALLBACK.map(t => ({ icone: "check", texto: t }))).map((it, i) => (
              <span key={i} style={{ fontSize: 13, fontWeight: 600, color: color.textMuted, display: "flex", alignItems: "center", gap: 7 }}>
                <Icon name={it.icone} size={14} color={it.icone === "star" ? color.star : color.accent}/>{it.texto}
              </span>
            ))}
          </div>
        </div>

        {/* ── coluna visual ── */}
        {empresa.hero_url ? (
          <div className="hero-visual" style={{ position: "relative", aspectRatio: "4 / 4.4", borderRadius: radius.lg, overflow: "hidden", boxShadow: shadow.hero, border: `1px solid ${color.line}` }}>
            <img src={empresa.hero_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          </div>
        ) : (
          // Sem foto cadastrada ainda: em vez de um placeholder vazio ou uma
          // caixa de gradiente decorativa, mostramos um painel institucional —
          // a mesma linguagem do painel "ao vivo" do Diretor Digital na
          // Landing Oficial, elevada a selo de marca. Nunca inventa número
          // ou estatística: cada linha só existe se o dado for real.
          <div className="hero-visual hero-visual-panel" style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span className="live-dot-hero" style={{ width: 8, height: 8, borderRadius: "50%", background: color.live, display: "inline-block" }}/>
              <span style={{ fontSize: 12, fontWeight: 700, color: color.live, letterSpacing: "0.04em", textTransform: "uppercase" }}>Perfil verificado</span>
            </div>
            <div style={{ position: "relative", background: color.surface, border: `1px solid ${color.lineStrong}`, borderRadius: radius.lg, padding: "40px 32px", boxShadow: shadow.hero, overflow: "hidden" }}>
              <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${color.lineStrong} 1px, transparent 1px)`, backgroundSize: "18px 18px", maskImage: "radial-gradient(circle at 30% 20%, black, transparent 70%)", WebkitMaskImage: "radial-gradient(circle at 30% 20%, black, transparent 70%)" }}/>
              <div aria-hidden style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle, ${color.accent}22, transparent 70%)`, top: -60, right: -60 }}/>

              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 28 }}>
                <div style={{ width: 68, height: 68, borderRadius: radius.lg, background: gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 16, boxShadow: shadow.ctaGlow }}>
                  {(empresa.nome || "?").trim().charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: color.text }}>{empresa.nome}</div>
                {esp && <div style={{ fontSize: 13, color: color.textFaint, marginTop: 3 }}>{esp}</div>}
              </div>

              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 0 }}>
                {(temIndicadores ? indicadores : CONFIANCA_FALLBACK.map(t => ({ icone: "check", texto: t }))).map((it, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: `1px solid ${color.line}` }}>
                    <Icon name={it.icone} size={15} color={it.icone === "star" ? color.star : color.accent}/>
                    <span style={{ fontSize: 13.5, color: color.textBody }}>{it.texto}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
