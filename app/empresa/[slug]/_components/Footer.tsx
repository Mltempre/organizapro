import type { ReactNode } from "react";
import { IcWa, IcPhone, IcMail, IcPin, IcInstagram, IcFacebook, IcLinkedin, IcTiktok } from "./icons";
import { NAV_LINKS } from "../_lib/content";
import { color } from "../_lib/theme";
import type { Empresa } from "../_lib/types";

export default function Footer({ empresa, nome, esp, waLink, whatsappNumber }: { empresa: Empresa; nome: string; esp: string; waLink: string; whatsappNumber?: string }) {
  // Só renderiza ícone de rede social com URL real cadastrada — nunca um
  // link vazio ou apontando para "#".
  const redes = [
    empresa.instagram_url && { href: empresa.instagram_url, icon: <IcInstagram/>, label: "Instagram" },
    empresa.facebook_url  && { href: empresa.facebook_url,  icon: <IcFacebook/>,  label: "Facebook"  },
    empresa.linkedin_url  && { href: empresa.linkedin_url,  icon: <IcLinkedin/>,  label: "LinkedIn"  },
    empresa.tiktok_url    && { href: empresa.tiktok_url,    icon: <IcTiktok/>,    label: "TikTok"    },
  ].filter(Boolean) as { href: string; icon: ReactNode; label: string }[];

  return (
    <footer style={{ background: color.ink3, padding: "48px 24px 28px", borderTop: `1px solid ${color.line}` }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div className="footer-cols" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 28, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: color.text, marginBottom: 4 }}>{nome}</div>
            {esp && <div style={{ fontSize: 13, color: color.textFaint }}>{esp}</div>}
          </div>
          <nav style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 13.5, color: color.textMuted, textDecoration: "none" }}>{label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {empresa.telefone && <a href={"tel:" + empresa.telefone} style={{ display: "flex", alignItems: "center", gap: 8, color: color.textMuted, textDecoration: "none", fontSize: 13 }}><IcPhone/> {empresa.telefone}</a>}
            {whatsappNumber && <a href={waLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, color: color.accent, textDecoration: "none", fontSize: 13, fontWeight: 700 }}><IcWa/> WhatsApp</a>}
            {empresa.email && <a href={"mailto:" + empresa.email} style={{ display: "flex", alignItems: "center", gap: 8, color: color.textMuted, textDecoration: "none", fontSize: 13 }}><IcMail/> {empresa.email}</a>}
          </div>
          {empresa.endereco && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: color.textFaint, fontSize: 13, maxWidth: 220 }}>
              <span style={{ marginTop: 1 }}><IcPin/></span>
              <span>{empresa.endereco}{empresa.cidade ? " - " + empresa.cidade + ", " + empresa.estado : ""}</span>
            </div>
          )}
          {redes.length > 0 && (
            <div style={{ display: "flex", gap: 10 }}>
              {redes.map(r => (
                <a key={r.label} href={r.href} target="_blank" rel="noreferrer" aria-label={r.label} title={r.label}
                  style={{ width: 34, height: 34, borderRadius: "50%", background: color.surface, border: `1px solid ${color.line}`, color: color.textMuted, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                  {r.icon}
                </a>
              ))}
            </div>
          )}
        </div>
        <div style={{ borderTop: `1px solid ${color.line}`, paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: color.textFaint }}>&copy; {new Date().getFullYear()} {nome}. Todos os direitos reservados.</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>Site criado com OrganizaPro</span>
        </div>
      </div>
    </footer>
  );
}
