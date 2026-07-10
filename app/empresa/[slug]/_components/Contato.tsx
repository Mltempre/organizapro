import type { ReactNode } from "react";
import Reveal from "./Reveal";
import { IcWa, IcPhone, IcMail, IcPin, IcClock } from "./icons";
import type { Empresa } from "../_lib/types";

export default function Contato({ empresa, waLink, whatsappNumber }: { empresa: Empresa; waLink: string; whatsappNumber?: string }) {
  const temDado = empresa.endereco || empresa.telefone || empresa.email || whatsappNumber;
  if (!temDado) return null;

  const linhas = [
    empresa.endereco && { icone: <IcPin/>, label: "Endereço", valor: empresa.endereco + (empresa.cidade ? ` — ${empresa.cidade}, ${empresa.estado}` : ""), href: undefined },
    empresa.telefone && { icone: <IcPhone/>, label: "Telefone", valor: empresa.telefone, href: "tel:" + empresa.telefone },
    empresa.email && { icone: <IcMail/>, label: "E-mail", valor: empresa.email, href: "mailto:" + empresa.email },
    empresa.horario_funcionamento && { icone: <IcClock/>, label: "Horário", valor: empresa.horario_funcionamento, href: undefined },
  ].filter(Boolean) as { icone: ReactNode; label: string; valor: string; href?: string }[];

  return (
    <section id="contato" style={{ padding: "104px 24px", background: "#FAF7F2" }}>
      <Reveal>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ marginBottom: 56, maxWidth: 560 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#B8863D", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px" }}>Contato</p>
            <h2 style={{ fontSize: "clamp(28px,3.4vw,40px)", fontWeight: 700, color: "#14110D", margin: 0, lineHeight: 1.22 }}>Fale com a gente</h2>
          </div>
          <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 56, alignItems: "start" }}>
            <div>
              {linhas.map((l, i) => {
                const conteudo = (
                  <>
                    <span style={{ color: "#B8863D", flexShrink: 0 }}>{l.icone}</span>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B6459", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{l.label}</div>
                      <div style={{ fontSize: 16, color: "#14110D", fontWeight: 600 }}>{l.valor}</div>
                    </div>
                  </>
                );
                const rowStyle = { display: "flex" as const, alignItems: "center" as const, gap: 16, padding: "20px 0", borderTop: "1px solid #E8E1D4", textDecoration: "none", color: "inherit" };
                return l.href
                  ? <a key={i} href={l.href} style={rowStyle}>{conteudo}</a>
                  : <div key={i} style={rowStyle}>{conteudo}</div>;
              })}
              <div style={{ borderTop: "1px solid #E8E1D4" }}/>
              {whatsappNumber && (
                <a href={waLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#25D366", borderRadius: 8, padding: "16px 20px", marginTop: 28, textDecoration: "none", color: "#ffffff", fontWeight: 600, fontSize: 15 }}>
                  <IcWa/> Enviar mensagem no WhatsApp
                </a>
              )}
            </div>
            <div style={{ background: "#E8E1D4", borderRadius: 16, minHeight: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6B6459" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <p style={{ fontSize: 13.5, color: "#6B6459", textAlign: "center", margin: 0, padding: "0 28px", lineHeight: 1.6 }}>{empresa.endereco || "Localização não cadastrada"}</p>
              {empresa.google_maps_url && (
                <a href={empresa.google_maps_url} target="_blank" rel="noreferrer" style={{ padding: "9px 20px", borderRadius: 7, background: "#14110D", color: "#ffffff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
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
