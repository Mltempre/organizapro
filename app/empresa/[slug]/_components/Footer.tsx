import type { ReactNode } from "react";
import { IcPhone,IcMail,IcInstagram,IcFacebook,IcLinkedin,IcTiktok } from "./icons";
import type { SiteNavItem } from "./Header";
import { font, type Tema } from "../_lib/families";
import type { Empresa } from "../_lib/types";
export default function Footer({empresa,nome,esp,navItems,tema}:{empresa:Empresa;nome:string;esp:string;waLink:string;whatsappNumber?:string;navItems:SiteNavItem[];tema:Tema}){
  const redes=[empresa.instagram_url&&{href:empresa.instagram_url,icon:<IcInstagram/>,label:"Instagram"},empresa.facebook_url&&{href:empresa.facebook_url,icon:<IcFacebook/>,label:"Facebook"},empresa.linkedin_url&&{href:empresa.linkedin_url,icon:<IcLinkedin/>,label:"LinkedIn"},empresa.tiktok_url&&{href:empresa.tiktok_url,icon:<IcTiktok/>,label:"TikTok"}].filter(Boolean) as {href:string;icon:ReactNode;label:string}[];
  return <footer className="premium-footer"><div className="premium-footer__main"><div className="premium-footer__brand"><strong>{nome}</strong>{esp&&<span>{esp}</span>}</div>{navItems.length>0&&<nav>{navItems.map(([href,label])=><a key={href} href={href}>{label}</a>)}</nav>}<div className="premium-footer__contact">{empresa.telefone&&<a href={"tel:"+empresa.telefone}><IcPhone/>{empresa.telefone}</a>}{empresa.email&&<a href={"mailto:"+empresa.email}><IcMail/>{empresa.email}</a>}</div>{redes.length>0&&<div className="premium-footer__social">{redes.map(r=><a key={r.label} href={r.href} target="_blank" rel="noreferrer" aria-label={r.label}>{r.icon}</a>)}</div>}</div><div className="premium-footer__bottom"><span>© {new Date().getFullYear()} {nome}. Todos os direitos reservados.</span><span className="op-sig">Site feito com <b>OrganizaPro</b></span></div><style>{`.premium-footer{padding:54px 24px 24px;background:${tema.ink3};border-top:1px solid ${tema.line};font-family:${font.body}}
    .premium-footer__main,.premium-footer__bottom{max-width:1180px;margin:auto}
    .premium-footer__main{display:grid;grid-template-columns:1.2fr .8fr 1fr auto;gap:42px;align-items:start;padding-bottom:38px}
    .premium-footer__brand strong,.premium-footer__brand span{display:block}
    .premium-footer__brand strong{font-size:18px;color:${tema.text};font-family:${font.display};font-weight:600}
    .premium-footer__brand span{margin-top:7px;color:${tema.textFaint};font-size:12px}
    .premium-footer nav,.premium-footer__contact{display:flex;flex-direction:column;gap:12px}
    .premium-footer a{color:${tema.textMuted};text-decoration:none;font-size:13px;overflow-wrap:anywhere}
    .premium-footer__contact a{display:flex;align-items:center;gap:8px}
    .premium-footer__social{display:flex;gap:8px}
    .premium-footer__social a{width:38px;height:38px;border:1px solid ${tema.line};border-radius:50%;display:flex;align-items:center;justify-content:center;color:${tema.textMuted}}
    .premium-footer__bottom{padding-top:22px;border-top:1px solid ${tema.line};display:flex;justify-content:space-between;gap:16px;color:${tema.textFaint};font-size:11px}
    .op-sig b{color:${tema.primary};font-weight:700}
    @media(max-width:760px){.premium-footer__main{grid-template-columns:1fr 1fr;gap:34px}.premium-footer__bottom{flex-direction:column}}
    @media(max-width:480px){.premium-footer__main{grid-template-columns:1fr}.premium-footer nav{flex-direction:row;flex-wrap:wrap}}`}</style></footer>;
}
