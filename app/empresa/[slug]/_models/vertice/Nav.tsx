"use client";
import { useEffect, useState } from "react";
import { IcWa, IcMenu, IcClose, IcPhone, IcMail, IcPin, IcClock } from "../../_components/icons";
import { initials } from "../../_lib/helpers";
import type { Tema } from "../../_lib/families";
import type { Empresa } from "../../_lib/types";

// ── Navegação VÉRTICE ─────────────────────────────────────────────────────
// Barra institucional sólida (nunca transparente): faixa superior com contato
// real cadastrado, nome em serif editorial e navegação em caixa alta com
// espaçamento de letra. Nada de pílulas nem raio — fio reto, enquadramento de
// escritório. No mobile, sobreposição de tela inteira com itens grandes e
// bloco de contato completo.
export default function Nav({ empresa, nome, logoUrl, waLink, whatsappNumber, navItems, tema }: {
  empresa: Empresa; nome: string; logoUrl?: string; waLink: string; whatsappNumber?: string; navItems: readonly (readonly [string, string])[]; tema: Tema;
}) {
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
  const local = [empresa.endereco, [empresa.cidade, empresa.estado].filter(Boolean).join(", ")].filter(Boolean).join(" — ");

  return (
    <>
      <header className={`vertice-nav ${scrolled ? "is-scrolled" : ""}`}>
        {(empresa.telefone || local || empresa.horario_funcionamento) && (
          <div className="vertice-top">
            <div className="vertice-top__inner">
              {empresa.telefone && <a href={"tel:" + empresa.telefone}><IcPhone/>{empresa.telefone}</a>}
              {local && <span><IcPin/>{local}</span>}
              {empresa.horario_funcionamento && <span><IcClock/>{empresa.horario_funcionamento}</span>}
            </div>
          </div>
        )}
        <div className="vertice-nav__inner">
          <a href="#hero" className="vertice-brand">
            {logoUrl ? <img src={logoUrl} alt={nome}/> : <span className="vertice-brand__mark">{initials(nome)}</span>}
            <strong>{nome}</strong>
          </a>
          <nav className="vertice-nav__links">
            {navItems.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            {whatsappNumber && <a className="vertice-nav__cta" href={waLink} target="_blank" rel="noreferrer"><IcWa size={15}/>Falar agora</a>}
          </nav>
          <button className="vertice-nav__burger" onClick={() => setOpen(true)} aria-label="Abrir menu"><IcMenu/></button>
        </div>
      </header>

      <div className={`vertice-menu ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <div className="vertice-menu__top">
          <span>{nome}</span>
          <button onClick={() => setOpen(false)} aria-label="Fechar menu"><IcClose/></button>
        </div>
        <nav>
          {navItems.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
        </nav>
        <div className="vertice-menu__foot">
          {empresa.telefone && <span><IcPhone/>{empresa.telefone}</span>}
          {empresa.email && <span><IcMail/>{empresa.email}</span>}
          {local && <span><IcPin/>{local}</span>}
          {empresa.horario_funcionamento && <span><IcClock/>{empresa.horario_funcionamento}</span>}
          {whatsappNumber && <a href={waLink} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><IcWa size={17}/>Falar pelo WhatsApp</a>}
        </div>
      </div>

      <style>{`
        .vertice-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:${tema.ink};border-bottom:1px solid ${tema.line};transition:box-shadow .3s}
        .vertice-nav.is-scrolled{box-shadow:0 18px 40px -30px rgba(0,0,0,.9)}
        .vertice-top{border-bottom:1px solid ${tema.line}}
        .vertice-top__inner{max-width:1240px;margin:0 auto;padding:0 24px;min-height:38px;display:flex;align-items:center;gap:26px;flex-wrap:wrap;font-family:${font.body};font-size:11.5px}
        .vertice-top__inner a,.vertice-top__inner span{display:inline-flex;align-items:center;gap:7px;color:${tema.textMuted};text-decoration:none;overflow-wrap:anywhere}
        .vertice-top__inner a:hover{color:${tema.text}}
        .vertice-nav__inner{max-width:1240px;margin:0 auto;padding:0 24px;min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:24px}
        .vertice-brand{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0}
        .vertice-brand img{height:30px;max-width:140px;object-fit:contain}
        .vertice-brand__mark{width:34px;height:34px;border:1px solid ${tema.primaryBorder};color:${tema.primary};display:flex;align-items:center;justify-content:center;font-family:${font.display};font-size:14px;font-weight:600}
        .vertice-brand strong{font-family:${font.display};font-weight:600;font-size:19px;letter-spacing:.01em;color:${tema.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .vertice-nav__links{display:flex;align-items:center;gap:26px}
        .vertice-nav__links>a{position:relative;font-family:${font.body};font-size:11.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${tema.textMuted};text-decoration:none;padding:6px 0}
        .vertice-nav__links>a:hover{color:${tema.text}}
        .vertice-nav__links>.vertice-nav__cta{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;background:${tema.primary};color:${tema.ink3};font-weight:800;letter-spacing:.1em}
        .vertice-nav__links>.vertice-nav__cta:hover{background:${tema.text};color:${tema.ink3}}
        .vertice-nav__burger{display:none;background:transparent;border:1px solid ${tema.line};width:44px;height:44px;color:${tema.text};align-items:center;justify-content:center}
        .vertice-menu{position:fixed;inset:0;z-index:1100;background:${tema.ink};display:flex;flex-direction:column;transform:translateY(-102%);transition:transform .4s cubic-bezier(.2,.7,.2,1)}
        .vertice-menu.is-open{transform:translateY(0)}
        .vertice-menu__top{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid ${tema.line}}
        .vertice-menu__top span{font-family:${font.display};font-size:16px;color:${tema.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .vertice-menu__top button{background:transparent;border:1px solid ${tema.line};width:42px;height:42px;color:${tema.text};display:flex;align-items:center;justify-content:center}
        .vertice-menu nav{flex:1;display:flex;flex-direction:column;justify-content:center;padding:10px 22px;overflow-y:auto}
        .vertice-menu nav a{font-family:${font.display};font-weight:600;font-size:30px;color:${tema.text};text-decoration:none;padding:14px 0;border-bottom:1px solid ${tema.line}}
        .vertice-menu__foot{display:grid;gap:12px;padding:22px;font-family:${font.body}}
        .vertice-menu__foot span{display:flex;align-items:flex-start;gap:9px;color:${tema.textMuted};font-size:12.5px;overflow-wrap:anywhere}
        .vertice-menu__foot a{display:flex;align-items:center;justify-content:center;gap:10px;padding:15px;background:${tema.primary};color:${tema.ink3};text-decoration:none;font-weight:800;font-size:14px;letter-spacing:.06em;text-transform:uppercase}
        @media(max-width:1080px){.vertice-nav__links{display:none}.vertice-nav__burger{display:flex}}
        @media(max-width:820px){.vertice-top{display:none}}
      `}</style>
    </>
  );
}
