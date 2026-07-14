import Reveal from "./Reveal";
import { Icon } from "./icons";
import { DIFERENCIAIS } from "../_lib/content";
import { color } from "../_lib/theme";

export default function Diferenciais() {
  return <section className="premium-section premium-dif"><Reveal><div className="section-shell premium-dif__grid">
    <div className="premium-dif__intro"><span className="section-label">Nosso jeito de trabalhar</span><h2>Uma experiência simples, clara e bem cuidada.</h2><p>Princípios que orientam cada contato, do primeiro atendimento à entrega.</p></div>
    <div className="premium-dif__list">{DIFERENCIAIS.slice(0,4).map((d,i)=><div className="premium-dif__item" key={d.titulo}><span>{String(i+1).padStart(2,"0")}</span><Icon name={d.icone} size={18} color={color.accent}/><div><h3>{d.titulo}</h3><p>{d.desc}</p></div></div>)}</div>
  </div></Reveal><style>{`.premium-dif{background:${color.ink2}}.premium-dif__grid{display:grid;grid-template-columns:.82fr 1.18fr;gap:100px}.premium-dif__intro{position:sticky;top:110px;align-self:start}.premium-dif h2{margin:20px 0 18px;font-size:clamp(34px,4.2vw,52px);line-height:1.08;letter-spacing:-.04em}.premium-dif__intro>p{max-width:430px;color:${color.textMuted};font-size:16px;line-height:1.75}.premium-dif__item{display:grid;grid-template-columns:34px 30px 1fr;gap:16px;padding:26px 0;border-top:1px solid ${color.line}}.premium-dif__item:last-child{border-bottom:1px solid ${color.line}}.premium-dif__item>span{color:${color.textFaint};font-size:11px;font-weight:800}.premium-dif__item h3{margin:0 0 7px;font-size:18px}.premium-dif__item p{margin:0;color:${color.textMuted};font-size:14px;line-height:1.7}@media(max-width:800px){.premium-dif__grid{grid-template-columns:1fr;gap:40px}.premium-dif__intro{position:static}}`}</style></section>;
}
