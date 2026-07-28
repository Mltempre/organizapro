import Reveal from "./Reveal";
import { IcWa,IcPhone } from "./icons";
import { gradienteDe,brilhoCta } from "../_lib/theme";
import { font, type Tema } from "../_lib/families";
import type { Empresa } from "../_lib/types";

export default function CtaFinal({empresa,waLink,whatsappNumber,titulo,subtitulo,ctaTexto,tema}:{empresa:Empresa;waLink:string;whatsappNumber?:string;titulo:string;subtitulo:string;ctaTexto:string;tema:Tema}){
  if(!whatsappNumber&&!empresa.telefone)return null;
  return <section className="premium-cta"><Reveal><div><span className="section-label">Vamos conversar</span><h2>{titulo}</h2><p>{subtitulo}</p><div className="premium-cta__actions">{whatsappNumber&&<a className="primary" href={waLink} target="_blank" rel="noreferrer"><IcWa/>{ctaTexto}</a>}{empresa.telefone&&<a href={"tel:"+empresa.telefone}><IcPhone/>{empresa.telefone}</a>}</div><p className="premium-cta__reassure">Resposta rápida, sem compromisso.</p></div></Reveal><style>{`.premium-cta{padding:110px 24px;background:radial-gradient(680px 340px at 50% 20%,${tema.primarySoft},transparent 72%),${tema.ink};text-align:center}
    .premium-cta .section-label{color:${tema.primary}}
    .premium-cta>div>div{max-width:760px;margin:auto}
    .premium-cta h2{margin:20px auto 14px;font-family:${font.display};font-weight:600;font-size:clamp(32px,4.6vw,50px);line-height:1.1;color:${tema.text}}
    .premium-cta p{margin:0 0 32px;color:${tema.textMuted};font-size:16px;font-family:${font.body}}
    .premium-cta__actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
    .premium-cta__actions a{min-height:52px;padding:0 24px;border:1px solid ${tema.line};border-radius:${tema.radius}px;display:inline-flex;align-items:center;gap:9px;color:${tema.text};text-decoration:none;font-size:14px;font-weight:700;font-family:${font.body};transition:transform .15s}
    .premium-cta__actions .primary{background:${gradienteDe(tema)};color:#0c0f12;box-shadow:${brilhoCta(tema)};border-color:transparent}
    .premium-cta__actions a:hover{transform:translateY(-1.5px)}
    .premium-cta__reassure{margin-top:22px!important;font-size:12.5px!important;color:${tema.textFaint}!important}
    @media(max-width:560px){.premium-cta{padding:76px 20px}.premium-cta__actions{flex-direction:column}.premium-cta__actions a{justify-content:center}}`}</style></section>;
}
