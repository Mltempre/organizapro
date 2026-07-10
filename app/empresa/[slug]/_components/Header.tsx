"use client";
import { useEffect, useState } from "react";
import { IcWa, IcMenu } from "./icons";
import { NAV_LINKS } from "../_lib/content";
import { initials } from "../_lib/helpers";

export default function Header({ nome, logoUrl, waLink, whatsappNumber }: { nome: string; logoUrl?: string; waLink: string; whatsappNumber?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
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
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: scrolled ? "1px solid #E8E1D4" : "1px solid rgba(232,225,212,0.5)",
        boxShadow: scrolled ? "0 1px 0 rgba(20,17,13,0.04)" : "none",
        transition: "border-color 0.3s ease",
      }}>
        <div style={{ maxWidth: 1220, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="#hero" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
            {logoUrl
              ? <img src={logoUrl} alt={nome} style={{ height: 28, maxWidth: 130, objectFit: "contain" }}/>
              : <div style={{ width: 30, height: 30, borderRadius: 8, background: "#14110D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em" }}>{initials(nome)}</div>
            }
            <span style={{ fontSize: 15, fontWeight: 700, color: "#14110D", letterSpacing: "-0.01em" }}>{nome}</span>
          </a>
          <nav className="nav-links" style={{ display: "flex", alignItems: "center", gap: 36 }}>
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 14, fontWeight: 500, color: "#6B6459", textDecoration: "none" }}>{label}</a>
            ))}
            {whatsappNumber && (
              <a href={waLink} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 7, background: "#14110D", color: "#ffffff", textDecoration: "none", fontWeight: 600, fontSize: 13.5 }}>
                <IcWa size={15}/> Falar agora
              </a>
            )}
          </nav>
          <button className="nav-burger" onClick={() => setOpen(true)} aria-label="Abrir menu" style={{ display: "none", background: "transparent", border: "1px solid #E8E1D4", borderRadius: 8, width: 40, height: 40, color: "#14110D", alignItems: "center", justifyContent: "center" }}>
            <IcMenu/>
          </button>
        </div>
      </header>

      {/* painel mobile — overlay cheio, não lista empurrando conteúdo */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "#ffffff",
        transform: open ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.35s cubic-bezier(.2,.7,.2,1)",
        visibility: open ? "visible" : "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #E8E1D4" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#14110D" }}>{nome}</span>
          <button onClick={() => setOpen(false)} aria-label="Fechar menu" style={{ background: "#FAF7F2", border: "1px solid #E8E1D4", borderRadius: 8, width: 40, height: 40, color: "#14110D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            ✕
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 32px", gap: 30 }}>
          {NAV_LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} style={{ fontSize: 28, fontWeight: 700, color: "#14110D", textDecoration: "none", letterSpacing: "-0.01em" }}>{label}</a>
          ))}
        </div>
        {whatsappNumber && (
          <div style={{ padding: "0 32px 40px" }}>
            <a href={waLink} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 20px", borderRadius: 8, background: "#14110D", color: "#ffffff", textDecoration: "none", fontWeight: 600, fontSize: 15.5 }}>
              <IcWa size={18}/> Falar pelo WhatsApp
            </a>
          </div>
        )}
      </div>
    </>
  );
}
