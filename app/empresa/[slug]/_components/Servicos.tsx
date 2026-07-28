import Reveal, { RevealItem } from "./Reveal";
import { Icon } from "./icons";
import { gerarTituloServicos } from "../_lib/helpers";
import { CTA_CONTEXTUAL } from "../_lib/content";
import { font, paleta, type FamiliaId, type Tema, type Tone } from "../_lib/families";
import type { DBServico, Empresa } from "../_lib/types";

export default function Servicos({ servicos, empresa, tema, familiaId, waBase, tone = "light", variant = 2 }: { servicos: DBServico[]; empresa: Empresa; tema: Tema; familiaId: FamiliaId; waBase?: string; tone?: Tone; variant?: 1 | 2 }) {
  if (servicos.length === 0) return null;
  const msg = CTA_CONTEXTUAL[familiaId].servicos;
  const p = paleta(tema, tone, variant);
  return <section id="servicos" className="premium-section premium-services"><Reveal><div className="section-shell">
    <div className="section-heading"><div><span className="section-label">O que oferecemos</span><h2>{gerarTituloServicos(empresa)}</h2></div><p>Soluções apresentadas com clareza para você escolher o atendimento que faz sentido.</p></div>
    <div className="premium-services__grid">{servicos.map((s, i) => <RevealItem key={s.id} index={i}><article className={`service-editorial ${s.imagem_url ? "has-image" : ""} ${i === 0 ? "is-feature" : ""}`}>
      {s.imagem_url && <img src={s.imagem_url} alt={s.nome} loading="lazy"/>}
      <div className="service-editorial__body">
        <span className="service-editorial__number">{String(i + 1).padStart(2,"0")}</span>
        <div><h3>{s.nome}</h3>{s.descricao && <p>{s.descricao}</p>}</div>
        {!s.imagem_url && <Icon name={s.icone || "target"} size={20} color={p.accent}/>}
      </div>
      {waBase && <a className="service-editorial__link" href={`${waBase}${encodeURIComponent(`${msg} (${s.nome})`)}`} target="_blank" rel="noreferrer">Perguntar sobre este serviço →</a>}
    </article></RevealItem>)}</div>
  </div></Reveal><style>{`.premium-services{background:${p.bg}}
    .premium-services .section-label{color:${p.accent}}
    .premium-services .section-heading h2{color:${p.text};font-family:${font.display};font-weight:600}
    .premium-services .section-heading>p{color:${p.textMuted}}
    .premium-services__grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
    .premium-services__grid>div{grid-column:span 4}
    .premium-services__grid>div:first-child .is-feature{}
    .service-editorial{height:100%;min-height:230px;padding:30px;display:flex;flex-direction:column;justify-content:flex-end;border:1px solid ${p.line};border-radius:${tema.radius}px;background:${p.card};overflow:hidden;position:relative}
    .service-editorial.has-image{min-height:400px;padding:0}
    .service-editorial.is-feature{min-height:320px}
    .service-editorial>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .service-editorial.has-image:after{content:"";position:absolute;inset:25% 0 0;background:linear-gradient(transparent,rgba(5,8,12,.88))}
    .service-editorial__body{position:relative;z-index:1;display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:start}
    .has-image .service-editorial__body{padding:26px 26px 6px}
    .service-editorial__number{font-family:${font.display};color:${p.accent};font-size:12px;font-weight:700}
    .service-editorial h3{margin:0 0 10px;font-size:19px;font-weight:800;color:${p.text};font-family:${font.body}}
    .has-image .service-editorial h3{color:#fff}
    .service-editorial p{margin:0;color:${p.textMuted};font-size:14px;line-height:1.7;font-family:${font.body}}
    .has-image .service-editorial p{color:rgba(255,255,255,.78)}
    .service-editorial__link{position:relative;z-index:1;display:inline-block;margin:12px 26px 22px;font-size:12.5px;font-weight:700;color:${p.accent};text-decoration:none}
    .has-image .service-editorial__link{color:#fff;opacity:.9}
    @media(max-width:900px){.premium-services__grid>div{grid-column:span 6}}
    @media(max-width:620px){.premium-services__grid>div{grid-column:1/-1}.service-editorial,.service-editorial.has-image{min-height:230px}}`}</style></section>;
}
