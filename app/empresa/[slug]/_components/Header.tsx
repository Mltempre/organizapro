"use client";
import { useEffect, useState } from "react";
import { IcWa, IcMenu, IcClose } from "./icons";
import { initials } from "../_lib/helpers";
import { color, gradient, radius, shadow } from "../_lib/theme";

export type SiteNavItem = readonly [string, string];

export default function Header({ nome, logoUrl, waLink, whatsappNumber, navItems }: { nome: string; logoUrl?: string; waLink: string; whatsappNumber?: string; navItems: SiteNavItem[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? "rgba(15,17,23,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        boxShadow: scrolled ? "0 1px 20px rgba(0,0,0,0.3)" : "none",
        borderBottom: `1px solid ${scrolled ? color.line : "transparent"}`,
        transition: "all 0.3s",
      }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="#hero" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            {logoUrl
              ? <img src={logoUrl} alt={nome} style={{ height: 26, maxWidth: 128, objectFit: "contain" }}/>
              : <div style={{ width: 30, height: 30, borderRadius: 8, background: gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>{initials(nome)}</div>
            }
            <span style={{ fontSize: 15, fontWeight: 800, color: color.text }}>{nome}</span>
          </a>
          <nav className="nav-links" style={{ display: "flex", alignItems: "center", gap: 30 }}>
            {navItems.map(([href, label]) => (
              <a key={href} href={href} className="nav-link-item" style={{ fontSize: 14, color: color.textBody, textDecoration: "none", fontWeight: 500, opacity: 0.72 }}>{label}</a>
            ))}
            {whatsappNumber && (
              <a href={waLink} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: radius.sm, background: gradient, color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13.5, boxShadow: shadow.ctaGlow, transition: "box-shadow 0.2s, transform 0.2s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.boxShadow = shadow.ctaGlowHover; el.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.boxShadow = shadow.ctaGlow; el.style.transform = "translateY(0)"; }}>
                <IcWa size={14}/> Falar agora
              </a>
            )}
          </nav>
          <button className="nav-burger" onClick={() => setOpen(true)} aria-label="Abrir menu" style={{ display: "none", background: "transparent", border: `1px solid ${color.line}`, borderRadius: 9, width: 40, height: 40, color: color.text, alignItems: "center", justifyContent: "center" }}>
            <IcMenu/>
          </button>
        </div>
      </header>

      {/* painel mobile — desliza da direita */}
      <div aria-hidden={!open} style={{
        position: "fixed", inset: 0, zIndex: 1099,
        background: "rgba(0,0,0,0.55)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.3s ease",
      }} onClick={() => setOpen(false)}/>
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(340px, 84vw)", zIndex: 1100,
        background: color.ink2,
        borderLeft: `1px solid ${color.line}`,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.38s cubic-bezier(.2,.7,.2,1)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${color.line}` }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: color.text }}>{nome}</span>
          <button onClick={() => setOpen(false)} aria-label="Fechar menu" style={{ background: color.surface, border: `1px solid ${color.line}`, borderRadius: 9, width: 36, height: 36, color: color.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IcClose/>
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 28px", gap: 26 }}>
          {navItems.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} style={{ fontSize: 23, fontWeight: 700, color: color.text, textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        {whatsappNumber && (
          <div style={{ padding: "0 28px 32px" }}>
            <a href={waLink} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "15px 20px", borderRadius: radius.sm, background: gradient, color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 15, boxShadow: shadow.ctaGlow }}>
              <IcWa size={17}/> Falar pelo WhatsApp
            </a>
          </div>
        )}
      </div>
    </>
  );
}
