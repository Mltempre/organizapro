"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  ["Como funciona", "#como-funciona"],
  ["O que ele faz", "#modulos"],
  ["Para quem", "#para-quem"],
  ["Investimento", "#oferta"],
] as const;

type LandingHeroProps = {
  onPrimaryCta: () => void;
};

export default function LandingHero({ onPrimaryCta }: LandingHeroProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-hero">
      <nav className={scrolled ? "hero-nav hero-nav-scrolled" : "hero-nav"} aria-label="Navegação principal">
        <div className="nav-inner">
          <a className="brand" href="#top" aria-label="OrganizaPro — início">
            <span className="brand-mark" aria-hidden="true">👔</span>
            <span>OrganizaPro</span>
          </a>

          <div className="nav-links">
            {NAV_LINKS.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </div>

          <div className="nav-actions">
            <Link href="/login" className="login-link">Entrar</Link>
            <button type="button" className="nav-cta" onClick={onPrimaryCta}>Falar agora</button>
          </div>

          <button
            type="button"
            className={menuOpen ? "menu-button menu-button-open" : "menu-button"}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(open => !open)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mobile-menu">
          {NAV_LINKS.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>
          ))}
          <button type="button" onClick={() => { setMenuOpen(false); onPrimaryCta(); }}>Falar agora</button>
          <Link href="/login" onClick={() => setMenuOpen(false)}>Já sou cliente → Entrar</Link>
        </div>
      )}

      <section id="top" className="hero-content">
        <div className="hero-copy">
          <div className="eyebrow"><span aria-hidden="true" />Não é mais um sistema. É um Diretor Digital.</div>
          <h1>Decisões mais claras para o seu negócio. <strong>Todos os dias.</strong></h1>
          <p className="lead">O OrganizaPro analisa sua agenda, seus clientes e sua reputação para mostrar o que realmente precisa da sua atenção agora.</p>
          <div className="hero-ctas">
            <button type="button" className="primary-cta" onClick={onPrimaryCta}>
              Quero meu Diretor Digital <span aria-hidden="true">→</span>
            </button>
            <a className="secondary-cta" href="#como-funciona">Ver como funciona</a>
          </div>
          <p className="product-proof">Agenda · Clientes · Dashboard · Site · Reputação · Conteúdo IA</p>
        </div>

        <div className="dashboard-visual">
          <div className="browser-frame">
            <div className="browser-bar" aria-hidden="true">
              <i /><i /><i /><span>app.organizapro.com.br/dashboard</span>
            </div>
            <Image
              className="dashboard-image"
              src="/organizapro-dashboard.png"
              alt="Dashboard real do OrganizaPro com visão executiva, prioridades e agenda usando dados demonstrativos"
              width={1440}
              height={960}
              priority
              sizes="(max-width: 700px) 100vw, 64vw"
            />
          </div>
          <div className="dashboard-meta">
            <span><strong>Dashboard real</strong> · dados demonstrativos</span>
            <span>OrganizaPro Intelligence</span>
          </div>
          <div className="system-status"><strong>● Sistema ativo</strong> · visão executiva em tempo real</div>
        </div>
      </section>

      <style>{`
        .landing-hero { position: relative; min-height: 100vh; overflow: hidden; background: radial-gradient(820px 560px at 77% 43%, rgba(38,111,130,.23), transparent 72%), radial-gradient(620px 420px at 11% 19%, rgba(31,78,95,.14), transparent 70%), #0d1016; color: #e2e8f0; }
        .landing-hero::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px); background-size: 54px 54px; mask-image: linear-gradient(#000, transparent 80%); pointer-events: none; }
        .hero-nav { position: fixed; inset: 0 0 auto; z-index: 100; height: 76px; border-bottom: 1px solid rgba(255,255,255,.025); transition: background .25s ease, border-color .25s ease, backdrop-filter .25s ease; }
        .hero-nav-scrolled { background: rgba(13,16,22,.9); border-bottom-color: rgba(255,255,255,.07); backdrop-filter: blur(16px); }
        .nav-inner { width: min(100%, 1360px); height: 100%; padding: 0 30px; margin: auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
        .brand { display: flex; align-items: center; gap: 11px; justify-self: start; color: #f8fafc; font-size: 17px; font-weight: 800; text-decoration: none; }
        .brand-mark { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: linear-gradient(145deg,#2a6b80,#123b4b); border: 1px solid rgba(127,205,224,.25); box-shadow: inset 0 1px rgba(255,255,255,.1); }
        .nav-links, .nav-actions { display: flex; align-items: center; }
        .nav-links { gap: 34px; }
        .nav-links a, .login-link { color: #9aa8b9; text-decoration: none; font-size: 13px; transition: color .18s ease; }
        .nav-links a:hover, .login-link:hover { color: #e2e8f0; }
        .nav-actions { gap: 20px; justify-self: end; }
        .nav-cta { min-height: 40px; padding: 0 19px; border-radius: 9px; color: #fff; font-size: 13px; font-weight: 700; background: linear-gradient(145deg,#28677c,#184553); border: 1px solid rgba(119,199,219,.27); box-shadow: inset 0 1px rgba(255,255,255,.08); cursor: pointer; transition: transform .18s ease, border-color .18s ease; }
        .nav-cta:hover { transform: translateY(-1px); border-color: rgba(151,221,238,.42); }
        .menu-button, .mobile-menu { display: none; }
        .hero-content { position: relative; z-index: 1; width: min(100%, 1360px); min-height: 100vh; margin: auto; padding: 156px 30px 92px; display: grid; grid-template-columns: 430px minmax(0,1fr); gap: 34px; align-items: center; }
        .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 7px 13px; margin-bottom: 24px; border-radius: 999px; background: rgba(55,134,154,.08); border: 1px solid rgba(103,187,207,.25); color: #79bdcd; font-size: 11.5px; font-weight: 700; }
        .eyebrow span { width: 6px; height: 6px; border-radius: 50%; background: #6db8ca; }
        .hero-copy h1 { margin: 0 0 22px; color: #f8fafc; font-size: 46px; line-height: 1.075; letter-spacing: -1.6px; font-weight: 850; }
        .hero-copy h1 strong { display: block; margin-top: 6px; color: #70b5c6; font: inherit; }
        .lead { max-width: 420px; margin: 0 0 31px; color: #a0adbd; font-size: 16px; line-height: 1.7; }
        .hero-ctas { display: flex; align-items: stretch; gap: 11px; }
        .primary-cta, .secondary-cta { min-height: 54px; display: flex; align-items: center; justify-content: center; border-radius: 11px; font-size: 13.5px; font-weight: 760; text-decoration: none; }
        .primary-cta { padding: 0 24px; color: #fff; background: linear-gradient(145deg,#347f95,#1c4d5d); border: 1px solid rgba(137,218,237,.36); box-shadow: inset 0 1px rgba(255,255,255,.12), 0 12px 30px rgba(11,41,50,.42); cursor: pointer; transition: transform .18s ease, box-shadow .18s ease; }
        .primary-cta:hover { transform: translateY(-1px); box-shadow: inset 0 1px rgba(255,255,255,.12), 0 15px 34px rgba(11,41,50,.48); }
        .primary-cta span { margin-left: 9px; color: #b9e5ee; font-size: 16px; }
        .secondary-cta { padding: 0 17px; color: #d6dee7; background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.13); transition: background .18s ease, border-color .18s ease; }
        .secondary-cta:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.2); }
        .product-proof { margin: 20px 0 0; color: #687589; font-size: 11px; line-height: 1.55; }
        .dashboard-visual { position: relative; min-width: 0; }
        .dashboard-visual::before { content: ""; position: absolute; inset: 7% 5% -4%; z-index: -1; border-radius: 40%; background: rgba(38,111,130,.26); filter: blur(62px); }
        .browser-frame { position: relative; padding: 8px; border-radius: 18px; background: linear-gradient(145deg,rgba(22,29,40,.94),rgba(7,10,16,.98)); border: 1px solid rgba(138,190,203,.27); box-shadow: 0 42px 100px rgba(0,0,0,.54), 0 13px 36px rgba(0,0,0,.3), inset 0 1px rgba(255,255,255,.07); }
        .browser-frame::after { content: ""; position: absolute; inset: 0; border-radius: 18px; box-shadow: inset 0 0 32px rgba(101,183,204,.04); pointer-events: none; }
        .browser-bar { height: 36px; display: flex; align-items: center; gap: 6px; padding: 0 12px; }
        .browser-bar i { width: 7px; height: 7px; border-radius: 50%; background: #3a475a; }
        .browser-bar span { width: 230px; height: 18px; margin: auto; display: grid; place-items: center; border-radius: 6px; background: rgba(255,255,255,.035); color: #59677a; font-size: 8px; }
        .dashboard-image { display: block; width: 100%; height: auto; border-radius: 10px; border: 1px solid rgba(255,255,255,.06); }
        .dashboard-meta { display: flex; justify-content: space-between; margin-top: 13px; padding: 0 5px; color: #687589; font-size: 10.5px; }
        .dashboard-meta strong { color: #89c4d1; }
        .system-status { position: absolute; right: 18px; bottom: -19px; padding: 9px 13px; border-radius: 10px; background: rgba(15,23,31,.88); backdrop-filter: blur(14px); border: 1px solid rgba(127,190,205,.18); box-shadow: 0 12px 30px rgba(0,0,0,.3); color: #9cabb9; font-size: 10px; }
        .system-status strong { color: #5fba8d; }
        @media (max-width: 700px) {
          .landing-hero { min-height: 844px; background: radial-gradient(440px 320px at 50% 19%,rgba(31,78,95,.22),transparent 72%),#0d1016; }
          .landing-hero::before { background-size: 38px 38px; }
          .hero-nav { height: 62px; }
          .nav-inner { display: flex; justify-content: space-between; padding: 0 17px; }
          .brand { font-size: 16px; }
          .brand-mark { width: 32px; height: 32px; }
          .nav-links, .nav-actions { display: none; }
          .menu-button { width: 34px; height: 34px; padding: 7px 6px; display: flex; flex-direction: column; justify-content: center; gap: 5px; border: 0; background: transparent; cursor: pointer; }
          .menu-button span { width: 22px; height: 2px; display: block; border-radius: 2px; background: #8998aa; transition: transform .2s ease, opacity .2s ease; }
          .menu-button-open span:first-child { transform: translateY(7px) rotate(45deg); }
          .menu-button-open span:nth-child(2) { opacity: 0; }
          .menu-button-open span:last-child { transform: translateY(-7px) rotate(-45deg); }
          .mobile-menu { position: fixed; inset: 62px 0 0; z-index: 99; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 27px; background: rgba(13,16,22,.98); backdrop-filter: blur(16px); }
          .mobile-menu a { color: #e2e8f0; font-size: 19px; font-weight: 650; text-decoration: none; }
          .mobile-menu a:last-child { color: #758296; font-size: 13px; }
          .mobile-menu button { min-height: 45px; padding: 0 24px; border-radius: 10px; border: 1px solid rgba(137,218,237,.3); background: linear-gradient(145deg,#347f95,#1c4d5d); color: #fff; font-weight: 700; }
          .hero-content { min-height: 844px; padding: 96px 14px 12px; display: flex; flex-direction: column; gap: 21px; text-align: center; }
          .eyebrow { margin-bottom: 17px; padding: 6px 10px; font-size: 10.5px; }
          .hero-copy h1 { margin-bottom: 14px; font-size: 32px; line-height: 1.075; letter-spacing: -1px; }
          .hero-copy h1 strong { margin-top: 4px; }
          .lead { max-width: 358px; margin: 0 auto 20px; font-size: 13.5px; line-height: 1.52; }
          .hero-ctas { flex-direction: column; gap: 8px; }
          .primary-cta, .secondary-cta { width: 100%; min-height: 45px; border-radius: 10px; font-size: 12.8px; }
          .product-proof { margin-top: 12px; padding: 0 8px; font-size: 9.8px; }
          .dashboard-visual { width: calc(100% + 26px); margin-left: -13px; }
          .dashboard-visual::before { inset: 5% 8% 2%; filter: blur(36px); }
          .browser-frame { padding: 5px; border-radius: 13px; box-shadow: 0 25px 58px rgba(0,0,0,.56), inset 0 1px rgba(255,255,255,.06); }
          .browser-frame::after { border-radius: 13px; }
          .browser-bar { height: 22px; padding: 0 8px; }
          .browser-bar i { width: 5px; height: 5px; }
          .browser-bar span { width: 150px; height: 12px; font-size: 5.5px; }
          .dashboard-image { border-radius: 7px; }
          .dashboard-meta { margin-top: 7px; font-size: 8.5px; }
          .system-status { display: none; }
        }
      `}</style>
    </div>
  );
}
