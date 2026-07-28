import Reveal from "./Reveal";
import { gerarTituloGaleria } from "../_lib/helpers";
import { font, paleta, type Tema, type Tone } from "../_lib/families";
import type { DBGaleria, DBEstrutura, Empresa } from "../_lib/types";

export default function Galeria({ galeria, estrutura, empresa, tema, tone = "light", variant = 2 }: { galeria: DBGaleria[]; estrutura: DBEstrutura[]; empresa: Empresa; tema: Tema; tone?: Tone; variant?: 1 | 2 }) {
  const fotos=[...galeria.map(g=>({id:g.id,url:g.url,titulo:g.titulo||g.categoria})),...estrutura.map(e=>({id:e.id,url:e.imagem_url,titulo:e.titulo}))].filter(f=>f.url);
  if(!fotos.length)return null;
  const p = paleta(tema, tone, variant);
  return <section id="galeria" className="premium-section premium-gallery"><Reveal><div className="section-shell">
    <div className="section-heading"><div><span className="section-label">Em imagens</span><h2>{gerarTituloGaleria(empresa)}</h2></div><p>Uma seleção real do trabalho, ambiente e detalhes da empresa.</p></div>
    <div className={`premium-gallery__grid count-${Math.min(fotos.length,4)}`}>{fotos.slice(0,6).map((f,i)=><figure key={f.id} className={`gallery-photo gallery-photo--${i}`}><img src={f.url} alt={f.titulo} loading="lazy"/><figcaption>{f.titulo}</figcaption></figure>)}</div>
  </div></Reveal><style>{`.premium-gallery{background:${p.bg}}
    .premium-gallery .section-label{color:${p.accent}}
    .premium-gallery .section-heading h2{color:${p.text};font-family:${font.display};font-weight:600}
    .premium-gallery .section-heading>p{color:${p.textMuted}}
    .premium-gallery__grid{display:grid;grid-template-columns:1.25fr .75fr;grid-template-rows:280px 280px;gap:14px}
    .gallery-photo{position:relative;margin:0;overflow:hidden;border-radius:${tema.radius}px;background:${p.card};border:1px solid ${p.line}}
    .gallery-photo--0{grid-row:1/3}
    .gallery-photo img{width:100%;height:100%;object-fit:cover;transition:transform .7s ease}
    .gallery-photo:hover img{transform:scale(1.035)}
    .gallery-photo figcaption{position:absolute;left:18px;bottom:16px;padding:7px 11px;border-radius:999px;background:rgba(10,10,10,.6);backdrop-filter:blur(10px);color:#fff;font-size:11px;opacity:0;transition:opacity .2s}
    .gallery-photo:hover figcaption{opacity:1}
    .gallery-photo--3,.gallery-photo--4,.gallery-photo--5{display:none}
    @media(max-width:700px){.premium-gallery__grid{grid-template-columns:1fr;grid-template-rows:360px 220px 220px}.gallery-photo--0{grid-row:auto}.gallery-photo figcaption{opacity:1}}`}</style></section>;
}
