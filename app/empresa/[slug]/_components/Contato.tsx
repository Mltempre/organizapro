import type { ReactNode } from "react";
import Reveal from "./Reveal";
import { IcWa, IcPhone, IcMail, IcPin, IcClock } from "./icons";
import { gerarTituloContato } from "../_lib/helpers";
import { color, gradient, radius, eyebrow, shadow } from "../_lib/theme";
import type { Empresa } from "../_lib/types";

export default function Contato({ empresa, waLink, whatsappNumber }: { empresa: Empresa; waLink: string; whatsappNumber?: string }) {
  const temDado = empresa.endereco || empresa.telefone || empresa.email || whatsappNumber;
  if (!temDado) return null;
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");

  const linhas = [
    empresa.endereco && { icone: <IcPin/>, label: "Endereço", valor: empresa.endereco + (empresa.cidade ? ` — ${empresa.cidade}, ${empresa.estado}` : ""), href: undefined },
    empresa.telefone && { icone: <IcPhone/>, label: "Telefone", valor: empresa.telefone, href: "tel:" + empresa.telefone },
    empresa.email && { icone: <IcMail/>, label: "E-mail", valor: empresa.email, href: "mailto:" + empresa.email },
    empresa.horario_funcionamento && { icone: <IcClock/>, label: "Horário", valor: empresa.horario_funcionamento, href: undefined },
  ].filter(Boolean) as { icone: ReactNode; label: string; valor: string; href?: string }[];

  return (
    <section id="contato" style={{ padding: "112px 24px", background: color.ink2 }}>
      <Reveal>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ marginBottom: 48, maxWidth: 560 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: color.accentSoft, border: `1px solid ${color.accentBorder}`, color: color.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 18 }}>Contato</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 800, color: color.text, margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{gerarTituloContato(local)}</h2>
          </div>
          <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, alignItems: "stretch" }}>
            <div style={{ background: color.surface, borderRadius: radius.md, border: `1px solid ${color.line}`, padding: "8px 26px" }}>
              {linhas.map((l, i) => {
                const conteudo = (
                  <>
                    <span style={{ color: color.accent, flexShrink: 0 }}>{l.icone}</span>
                    <div>
                      <div style={{ fontSize: 11, color: color.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{l.label}</div>
                      <div style={{ fontSize: 15.5, color: color.text, fontWeight: 600 }}>{l.valor}</div>
                    </div>
                  </>
                );
                const rowStyle = { display: "flex" as const, alignItems: "center" as const, gap: 16, padding: "20px 0", borderTop: i > 0 ? `1px solid ${color.line}` : "none", textDecoration: "none", color: "inherit" };
                return l.href
                  ? <a key={i} href={l.href} style={rowStyle}>{conteudo}</a>
                  : <div key={i} style={rowStyle}>{conteudo}</div>;
              })}
              {whatsappNumber && (
                <div style={{ padding: "20px 0 24px" }}>
                  <a href={waLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: gradient, borderRadius: radius.sm, padding: "15px 20px", textDecoration: "none", color: "#fff", fontWeight: 700, fontSize: 14.5, boxShadow: shadow.ctaGlow }}>
                    <IcWa/> Enviar mensagem no WhatsApp
                  </a>
                </div>
              )}
            </div>
            <div style={{ background: color.ink, border: `1px solid ${color.line}`, borderRadius: radius.md, minHeight: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 28, position: "relative", overflow: "hidden" }}>
              <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "20px 20px" }}/>
              <span style={{ position: "relative", color: color.accent }}><IcPin/></span>
              <p style={{ position: "relative", fontSize: 13.5, color: color.textMuted, textAlign: "center", margin: 0, lineHeight: 1.6 }}>{empresa.endereco || "Localização não cadastrada"}</p>
              {empresa.google_maps_url && (
                <a href={empresa.google_maps_url} target="_blank" rel="noreferrer" style={{ position: "relative", padding: "9px 20px", borderRadius: radius.sm, background: gradient, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                  Ver no mapa
                </a>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
