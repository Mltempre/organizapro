"use client";
import { useEffect, useState } from "react";
import { IcWa, IcMenu, IcClose, IcPhone, IcMail, IcPin } from "../../_components/icons";
import { initials } from "../../_lib/helpers";
import type { Tema } from "../../_lib/families";
import type { Empresa } from "../../_lib/types";

// ── Navegação PULSE ───────────────────────────────────────────────────────
// Barra sólida escura desde o primeiro pixel (nunca transparente sobre o
// hero), marca em quadrado cheio na cor da marca, links em caixa alta e CTA
// em PÍLULA de acento — a chamada comercial fica sempre visível. No mobile o
// menu é uma folha que sobe de baixo para cima (o inverso da gaveta lateral do
// Aurora e da sobreposição institucional do Vértice), com os contatos reais
// cadastrados e um botão de WhatsApp no rodapé da folha.
export default function Nav({ empresa, nome, logoUrl, waLink, whatsappNumber, navItems, tema }: {
  empresa: Empresa; nome: string; logoUrl?: string; waLink: string; whatsappNumber?: string; navItems: readonly (readonly [string, string])[]; tema: Tema;
}) {
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");

  return (
    <>
      <header className={`pulse-nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="pulse-nav__inner">
          <a href="#hero" className="pulse-brand">
            {logoUrl ? <img src={logoUrl} alt={nome}/> : <span className="pulse-brand__mark">{initials(nome)}</span>}
            <strong>{nome}</strong>
          </a>
          <nav className="pulse-nav__links">
            {navItems.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          {whatsappNumber
            ? <a className="pulse-nav__cta" href={waLink} target="_blank" rel="noreferrer"><IcWa size={15}/>Chamar no WhatsApp</a>
            : <a className="pulse-nav__cta" href="#contato">Falar com a gente</a>}
          <button className="pulse-nav__burger" onClick={() => setOpen(true)} aria-label="Abrir menu"><IcMenu/></button>
        </div>
      </header>

      <div className={`pulse-sheet ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <div className="pulse-sheet__top">
          <span>{nome}</span>
          <button onClick={() => setOpen(false)} aria-label="Fechar menu"><IcClose/></button>
        </div>
        <nav className="pulse-sheet__links">
          {navItems.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
        </nav>
        <div className="pulse-sheet__foot">
          {local && <span><IcPin/>{local}</span>}
          {empresa.telefone && <a href={"tel:" + empresa.telefone}><IcPhone/>{empresa.telefone}</a>}
          {empresa.email && <a href={"mailto:" + empresa.email}><IcMail/>{empresa.email}</a>}
          {whatsappNumber && <a className="pulse-sheet__cta" href={waLink} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><IcWa size={18}/>Falar no WhatsApp</a>}
        </div>
      </div>

      <style>{`
        .pulse-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:${tema.ink};border-bottom:1px solid ${tema.line};transition:box-shadow .25s}
        .pulse-nav.is-scrolled{box-shadow:0 18px 40px -26px rgba(0,0,0,.9)}
        .pulse-nav__inner{max-width:1240px;margin:0 auto;padding:0 24px;min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:22px}
        .pulse-brand{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0}
        .pulse-brand img{height:32px;max-width:150px;object-fit:contain}
        .pulse-brand__mark{width:38px;height:38px;border-radius:12px;background:${tema.primary};color:${tema.ink3};display:flex;align-items:center;justify-content:center;font-family:${font.display};font-size:14px;font-weight:800}
        .pulse-brand strong{font-family:${font.display};font-weight:800;font-size:18px;letter-spacing:-.01em;color:${tema.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pulse-nav__links{display:flex;align-items:center;gap:22px;min-width:0}
        .pulse-nav__links a{font-family:${font.body};font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${tema.textMuted};text-decoration:none;white-space:nowrap}
        .pulse-nav__links a:hover{color:${tema.primary}}
        .pulse-nav__cta{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:999px;background:${tema.primary};color:${tema.ink3};text-decoration:none;font-family:${font.body};font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;transition:transform .16s}
        .pulse-nav__cta:hover{transform:translateY(-1px)}
        .pulse-nav__burger{display:none;background:transparent;border:1px solid ${tema.line};border-radius:12px;width:44px;height:44px;color:${tema.text};align-items:center;justify-content:center}
        .pulse-sheet{position:fixed;inset:0;z-index:1100;background:${tema.ink};display:flex;flex-direction:column;transform:translateY(102%);transition:transform .4s cubic-bezier(.2,.7,.2,1)}
        .pulse-sheet.is-open{transform:translateY(0)}
        .pulse-sheet__top{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 22px;border-bottom:1px solid ${tema.line}}
        .pulse-sheet__top span{font-family:${font.display};font-size:16px;font-weight:800;color:${tema.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pulse-sheet__top button{background:transparent;border:1px solid ${tema.line};border-radius:12px;width:42px;height:42px;color:${tema.text};display:flex;align-items:center;justify-content:center}
        .pulse-sheet__links{flex:1;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:12px 20px;overflow-y:auto}
        .pulse-sheet__links a{font-family:${font.display};font-weight:800;font-size:30px;letter-spacing:-.02em;color:${tema.text};text-decoration:none;padding:12px 0;border-bottom:1px solid ${tema.line}}
        .pulse-sheet__links a:hover{color:${tema.primary}}
        .pulse-sheet__foot{display:grid;gap:12px;padding:18px 22px 26px;border-top:1px solid ${tema.line}}
        .pulse-sheet__foot span,.pulse-sheet__foot a{display:flex;align-items:center;gap:9px;font-family:${font.body};font-size:13px;color:${tema.textMuted};text-decoration:none;overflow-wrap:anywhere}
        .pulse-sheet__foot .pulse-sheet__cta{margin-top:6px;justify-content:center;min-height:54px;border-radius:999px;background:${tema.primary};color:${tema.ink3};font-size:14px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
        @media(max-width:1080px){.pulse-nav__links{display:none}.pulse-nav__burger{display:flex}}
        @media(max-width:640px){
          .pulse-nav__inner{padding:0 18px;min-height:66px;gap:12px}
          .pulse-brand__mark{width:34px;height:34px;border-radius:10px;font-size:12.5px}
          .pulse-brand strong{font-size:16px}
          .pulse-nav__cta{padding:10px 15px;font-size:11.5px}
          .pulse-nav__cta svg{display:none}
        }
      `}</style>
    </>
  );
}
