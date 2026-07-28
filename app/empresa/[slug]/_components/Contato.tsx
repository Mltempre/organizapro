import type { ReactNode } from "react";
import Reveal from "./Reveal";
import { IcWa,IcPhone,IcMail,IcPin,IcClock } from "./icons";
import { gerarTituloContato } from "../_lib/helpers";
import { shadow,gradienteDe } from "../_lib/theme";
import { font, paleta, type Tema, type Tone } from "../_lib/families";
import type { Empresa } from "../_lib/types";

export default function Contato({empresa,waLink,whatsappNumber,tema,tone="dark",variant=2}:{empresa:Empresa;waLink:string;whatsappNumber?:string;tema:Tema;tone?:Tone;variant?:1|2}){
  const temDado=empresa.endereco||empresa.telefone||empresa.email||whatsappNumber;if(!temDado)return null;
  const local=[empresa.cidade,empresa.estado].filter(Boolean).join(", ");
  const temEnderecoUtilizavel=Boolean(empresa.endereco?.trim());
  const p=paleta(tema,tone,variant);
  const linhas=[empresa.endereco&&{icone:<IcPin/>,label:"Endereço",valor:empresa.endereco+(local?` — ${local}`:"")},empresa.telefone&&{icone:<IcPhone/>,label:"Telefone",valor:empresa.telefone,href:"tel:"+empresa.telefone},empresa.email&&{icone:<IcMail/>,label:"E-mail",valor:empresa.email,href:"mailto:"+empresa.email},empresa.horario_funcionamento&&{icone:<IcClock/>,label:"Horário",valor:empresa.horario_funcionamento}].filter(Boolean) as {icone:ReactNode;label:string;valor:string;href?:string}[];
  return <section id="contato" className="premium-section premium-contact"><Reveal><div className="section-shell premium-contact__box"><div className="premium-contact__intro"><span className="section-label">Contato</span><h2>{gerarTituloContato(local)}</h2><p>Escolha o canal mais conveniente. As informações abaixo são as cadastradas pela empresa.</p>{whatsappNumber&&<a href={waLink} target="_blank" rel="noreferrer"><IcWa/> Iniciar conversa</a>}</div><div className="premium-contact__details">{linhas.map((l,i)=>{const body=<><span>{l.icone}</span><div><small>{l.label}</small><strong>{l.valor}</strong></div></>;return l.href?<a key={i} href={l.href}>{body}</a>:<div key={i}>{body}</div>})}{temEnderecoUtilizavel&&empresa.google_maps_url&&<a className="map-link" href={empresa.google_maps_url} target="_blank" rel="noreferrer">Ver localização no mapa →</a>}</div></div></Reveal><style>{`.premium-contact{background:${p.bg}}
    .premium-contact .section-label{color:${p.accent}}
    .premium-contact__box{display:grid;grid-template-columns:1fr 1fr;border:1px solid ${tema.primaryBorder};border-radius:${tema.radius}px;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.03),rgba(0,0,0,.12));box-shadow:${shadow.hero}}
    .premium-contact__intro{padding:58px}
    .premium-contact__intro h2{margin:20px 0 18px;font-family:${font.display};font-weight:600;font-size:clamp(30px,3.8vw,42px);line-height:1.14;color:${p.text}}
    .premium-contact__intro p{max-width:430px;margin:0 0 30px;color:${p.textMuted};font-size:15px;line-height:1.75;font-family:${font.body}}
    .premium-contact__intro>a{display:inline-flex;align-items:center;gap:9px;min-height:50px;padding:0 22px;border-radius:${tema.radius}px;background:${gradienteDe(tema)};color:#0c0f12;text-decoration:none;font-weight:700;font-size:14px;font-family:${font.body}}
    .premium-contact__details{padding:34px 46px;background:rgba(255,255,255,.018)}
    .premium-contact__details>div,.premium-contact__details>a:not(.map-link){display:flex;align-items:flex-start;gap:16px;padding:21px 0;border-bottom:1px solid ${p.line};color:inherit;text-decoration:none}
    .premium-contact__details>*>span{color:${p.accent}}
    .premium-contact__details small,.premium-contact__details strong{display:block;font-family:${font.body}}
    .premium-contact__details small{margin-bottom:5px;color:${p.textMuted};font-size:10px;text-transform:uppercase;letter-spacing:.1em}
    .premium-contact__details strong{color:${p.text};font-size:14px;line-height:1.5;overflow-wrap:anywhere}
    .map-link{display:inline-block;margin-top:24px;color:${p.accent};font-size:13px;font-weight:700;text-decoration:none;font-family:${font.body}}
    @media(max-width:760px){.premium-contact__box{grid-template-columns:1fr}.premium-contact__intro{padding:38px 28px}.premium-contact__details{padding:18px 28px 34px}}`}</style></section>;
}
