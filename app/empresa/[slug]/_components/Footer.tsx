import { IcWa, IcPhone, IcMail, IcPin } from "./icons";
import { NAV_LINKS } from "../_lib/content";
import type { Empresa } from "../_lib/types";

export default function Footer({ empresa, nome, esp, waLink, whatsappNumber }: { empresa: Empresa; nome: string; esp: string; waLink: string; whatsappNumber?: string }) {
  return (
    <footer style={{ background: "#14110D", padding: "44px 24px 28px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="footer-cols" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 28, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", marginBottom: 4 }}>{nome}</div>
            {esp && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{esp}</div>}
          </div>
          <nav style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>{label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {empresa.telefone && <a href={"tel:" + empresa.telefone} style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.60)", textDecoration: "none", fontSize: 13 }}><IcPhone/> {empresa.telefone}</a>}
            {whatsappNumber && <a href={waLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, color: "#25D366", textDecoration: "none", fontSize: 13, fontWeight: 600 }}><IcWa/> WhatsApp</a>}
            {empresa.email && <a href={"mailto:" + empresa.email} style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.60)", textDecoration: "none", fontSize: 13 }}><IcMail/> {empresa.email}</a>}
          </div>
          {empresa.endereco && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "rgba(255,255,255,0.50)", fontSize: 13, maxWidth: 220 }}>
              <span style={{ marginTop: 1 }}><IcPin/></span>
              <span>{empresa.endereco}{empresa.cidade ? " - " + empresa.cidade + ", " + empresa.estado : ""}</span>
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>&copy; {new Date().getFullYear()} {nome}. Todos os direitos reservados.</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>Site criado com OrganizaPro</span>
        </div>
      </div>
    </footer>
  );
}
