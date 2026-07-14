import Reveal, { RevealItem } from "./Reveal";
import { Icon } from "./icons";
import { gerarTituloServicos } from "../_lib/helpers";
import { color } from "../_lib/theme";
import type { DBServico, Empresa } from "../_lib/types";

export default function Servicos({ servicos, empresa }: { servicos: DBServico[]; empresa: Empresa }) {
  if (servicos.length === 0) return null;
  return <section id="servicos" className="premium-section premium-services"><Reveal><div className="section-shell">
    <div className="section-heading"><div><span className="section-label">O que oferecemos</span><h2>{gerarTituloServicos(empresa)}</h2></div><p>Soluções apresentadas com clareza para você escolher o atendimento que faz sentido.</p></div>
    <div className="premium-services__grid">{servicos.map((s, i) => <RevealItem key={s.id} index={i}><article className={`service-editorial ${s.imagem_url ? "has-image" : ""}`}>
      {s.imagem_url && <img src={s.imagem_url} alt={s.nome} loading="lazy"/>}<div className="service-editorial__body"><span className="service-editorial__number">{String(i + 1).padStart(2,"0")}</span><div><h3>{s.nome}</h3>{s.descricao && <p>{s.descricao}</p>}</div>{!s.imagem_url && <Icon name={s.icone || "target"} size={20} color={color.accent}/>}</div>
    </article></RevealItem>)}</div>
  </div></Reveal><style>{`.premium-services{background:${color.ink}}.premium-services__grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}.premium-services__grid>div{grid-column:span 4}.service-editorial{height:100%;min-height:230px;padding:30px;display:flex;flex-direction:column;justify-content:flex-end;border:1px solid ${color.line};border-radius:22px;background:${color.surface};overflow:hidden;position:relative}.service-editorial.has-image{min-height:400px;padding:0}.service-editorial>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.service-editorial.has-image:after{content:"";position:absolute;inset:25% 0 0;background:linear-gradient(transparent,rgba(5,8,12,.94))}.service-editorial__body{position:relative;z-index:1;display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:start}.has-image .service-editorial__body{padding:28px}.service-editorial__number{color:${color.accent};font-size:11px;font-weight:800;letter-spacing:.1em}.service-editorial h3{margin:0 0 10px;font-size:20px;line-height:1.25}.service-editorial p{margin:0;color:${color.textMuted};font-size:14px;line-height:1.7}@media(max-width:900px){.premium-services__grid>div{grid-column:span 6}}@media(max-width:620px){.premium-services__grid>div{grid-column:1/-1}.service-editorial,.service-editorial.has-image{min-height:230px}}`}</style></section>;
}
