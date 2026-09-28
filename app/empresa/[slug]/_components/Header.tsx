"use client";
import { useEffect, useState } from "react";
import { IcWa, IcMenu, IcClose } from "./icons";
import { initials } from "../_lib/helpers";
import { shadow } from "../_lib/theme";
import type { Tema } from "../_lib/families";

// ── Header AURORA ─────────────────────────────────────────────────────────
// Claro e sofisticado: transparente sobre o hero, vira vidro claro (blur) com
// fio fino ao rolar. Navegação em pílulas discretas, CTA sólido na cor da
// marca (contraste garantido em tema claro) e menu mobile em gaveta à direita.
// Nenhum dado inventado: os itens de navegação chegam prontos do orquestrador
// (só seções que existem de verdade) e o CTA só existe com WhatsApp cadastrado.

export type SiteNavItem = readonly [string, string];

export default function Header({ nome, logoUrl, waLink, whatsappNumber, navItems, tema }: { nome: string; logoUrl?: string; waLink: string; whatsappNumber?: string; navItems: SiteNavItem[]; tema: Tema }) {
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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
      <header className={`aurora-nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="aurora-nav__inner">
          <a href="#hero" className="aurora-brand">
            {logoUrl
              ? <img src={logoUrl} alt={nome} />
              : <span className="aurora-brand__mark">{initials(nome)}</span>}
            <strong>{nome}</strong>
          </a>
          <nav className="aurora-nav__links">
            {navItems.map(([href, label]) => (
              <a key={href} href={href}>{label}</a>
            ))}
            {whatsappNumber && (
              <a className="aurora-nav__cta" href={waLink} target="_blank" rel="noreferrer"><IcWa size={15}/> Falar no WhatsApp</a>
            )}
          </nav>
          <button className="aurora-nav__burger" onClick={() => setOpen(true)} aria-label="Abrir menu"><IcMenu/></button>
        </div>
      </header>

      <div className={`aurora-drawer-scrim ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true"/>
      <aside className={`aurora-drawer ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <div className="aurora-drawer__top">
          <span>{nome}</span>
          <button onClick={() => setOpen(false)} aria-label="Fechar menu"><IcClose/></button>
        </div>
        <nav>
          {navItems.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
        </nav>
        {whatsappNumber && (
          <div className="aurora-drawer__foot">
            <a href={waLink} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><IcWa size={17}/> Falar pelo WhatsApp</a>
          </div>
        )}
      </aside>

      <style>{`
        .aurora-nav{position:fixed;top:0;left:0;right:0;z-index:1000;border-bottom:1px solid transparent;transition:background .3s,border-color .3s,box-shadow .3s}
        .aurora-nav.is-scrolled{background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border-bottom-color:${tema.lineOnPaper};box-shadow:0 10px 30px -22px rgba(10,15,31,.35)}
        .aurora-nav__inner{max-width:1180px;margin:0 auto;padding:0 24px;height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}
        .aurora-brand{display:flex;align-items:center;gap:11px;text-decoration:none;min-width:0}
        .aurora-brand img{height:30px;max-width:132px;object-fit:contain}
        .aurora-brand__mark{width:34px;height:34px;border-radius:11px;background:${tema.primaryDeep};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:800;font-family:${font.body};letter-spacing:.02em}
        .aurora-brand strong{font-family:${font.display};font-weight:600;font-size:16px;color:${tema.textOnPaper};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .aurora-nav__links{display:flex;align-items:center;gap:6px}
        .aurora-nav__links>a{font-family:${font.body};font-size:14px;font-weight:500;color:${tema.textOnPaper};text-decoration:none;padding:9px 13px;border-radius:999px;opacity:.82;transition:background .2s,opacity .2s}
        .aurora-nav__links>a:hover{background:${tema.primarySoft};opacity:1}
        .aurora-nav__links>.aurora-nav__cta{display:inline-flex;align-items:center;gap:8px;margin-left:8px;padding:11px 19px;border-radius:999px;background:${tema.contrast};color:#fff;font-weight:700;font-size:13.5px;opacity:1;box-shadow:${shadow.ctaGlow}}
        .aurora-nav__links>.aurora-nav__cta:hover{transform:translateY(-1px)}
        .aurora-nav__burger{display:none;background:transparent;border:1px solid ${tema.lineOnPaper};border-radius:11px;width:42px;height:42px;color:${tema.textOnPaper};align-items:center;justify-content:center}
        .aurora-drawer-scrim{position:fixed;inset:0;z-index:1099;background:rgba(10,15,31,.42);opacity:0;pointer-events:none;transition:opacity .3s}
        .aurora-drawer-scrim.is-open{opacity:1;pointer-events:auto}
        .aurora-drawer{position:fixed;top:0;right:0;bottom:0;width:min(360px,86vw);z-index:1100;background:${tema.paper2};border-left:1px solid ${tema.lineOnPaper};display:flex;flex-direction:column;transform:translateX(101%);transition:transform .38s cubic-bezier(.2,.7,.2,1)}
        .aurora-drawer.is-open{transform:translateX(0)}
        .aurora-drawer__top{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:20px 22px;border-bottom:1px solid ${tema.lineOnPaper}}
        .aurora-drawer__top span{font-family:${font.display};font-weight:600;font-size:15px;color:${tema.textOnPaper};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .aurora-drawer__top button{background:transparent;border:1px solid ${tema.lineOnPaper};border-radius:10px;width:38px;height:38px;color:${tema.textOnPaper};display:flex;align-items:center;justify-content:center}
        .aurora-drawer nav{flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:22px 18px}
        .aurora-drawer nav a{font-family:${font.display};font-weight:600;font-size:24px;color:${tema.textOnPaper};text-decoration:none;padding:12px 14px;border-radius:14px}
        .aurora-drawer nav a:hover{background:${tema.primarySoft}}
        .aurora-drawer__foot{padding:0 22px 30px}
        .aurora-drawer__foot a{display:flex;align-items:center;justify-content:center;gap:10px;padding:16px;border-radius:14px;background:${tema.contrast};color:#fff;text-decoration:none;font-weight:700;font-size:15px;font-family:${font.body}}
        @media(max-width:1000px){.aurora-nav__links{display:none}.aurora-nav__burger{display:flex}}
      `}</style>
    </>
  );
}
