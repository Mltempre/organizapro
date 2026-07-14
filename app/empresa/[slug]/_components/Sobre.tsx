import Reveal from "./Reveal";
import { gerarTituloSobre } from "../_lib/helpers";
import { color } from "../_lib/theme";
import type { Empresa } from "../_lib/types";

export default function Sobre({ empresa, nome, sobre }: { empresa: Empresa; nome: string; sobre: string[] }) {
  return <section id="sobre" className="premium-section premium-about">
    <Reveal><div className={`premium-about__grid ${empresa.logo_url ? "has-logo" : ""}`}>
      <div><span className="section-label">Sobre</span><h2>{gerarTituloSobre(empresa)}</h2></div>
      <div className="premium-about__text">{sobre.map((texto, i) => <p key={i}>{texto}</p>)}</div>
      {empresa.logo_url && <div className="premium-about__logo"><img src={empresa.logo_url} alt={nome}/></div>}
    </div></Reveal>
    <style>{`.premium-about{background:${color.ink2}}.premium-about__grid{max-width:1180px;margin:auto;display:grid;grid-template-columns:.78fr 1.22fr;gap:80px;align-items:start}.premium-about__grid.has-logo{grid-template-columns:.75fr 1fr .55fr}.premium-about h2{max-width:430px;margin:18px 0 0;font-size:clamp(32px,4vw,50px);line-height:1.1;letter-spacing:-.035em}.premium-about__text{padding-top:36px}.premium-about__text p{margin:0 0 18px;color:${color.textMuted};font-size:16px;line-height:1.85}.premium-about__text p:first-child{color:${color.textBody};font-size:20px;line-height:1.65}.premium-about__logo{min-height:220px;display:flex;align-items:center;justify-content:center;padding:34px;border:1px solid ${color.line};border-radius:24px;background:rgba(255,255,255,.025)}.premium-about__logo img{max-width:100%;max-height:150px;object-fit:contain}@media(max-width:800px){.premium-about__grid,.premium-about__grid.has-logo{grid-template-columns:1fr;gap:24px}.premium-about__text{padding-top:0}.premium-about__logo{min-height:160px;order:3}}`}</style>
  </section>;
}
