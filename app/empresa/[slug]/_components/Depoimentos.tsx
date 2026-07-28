import Reveal, { RevealItem } from "./Reveal";
import { IcStarFilled, Icon } from "./icons";
import { initials, gerarTituloDepoimentos } from "../_lib/helpers";
import { gradienteDe } from "../_lib/theme";
import { font, paleta, type Tema, type Tone } from "../_lib/families";
import type { DBDepoimento } from "../_lib/types";

export default function Depoimentos({ depoimentos, tema, tone = "dark", variant = 1 }: { depoimentos: DBDepoimento[]; tema: Tema; tone?: Tone; variant?: 1 | 2 }) {
  if(!depoimentos.length)return null;
  const p = paleta(tema, tone, variant);
  return <section id="depoimentos" className="premium-section premium-testimonials"><Reveal><div className="section-shell">
    <div className="section-heading"><div><span className="section-label">Depoimentos</span><h2>{gerarTituloDepoimentos()}</h2></div><p>Experiências compartilhadas por quem já entrou em contato com a empresa.</p></div>
    <div className="testimonial-grid">{depoimentos.map((d,i)=><RevealItem key={d.id} index={i}><article className="testimonial"><div className="testimonial__top"><Icon name="quote" size={28} color={p.accent}/><div>{[1,2,3,4,5].map(n=><IcStarFilled key={n} size={13} color={n<=d.nota?tema.emotional:p.line}/>)}</div></div><blockquote>“{d.comentario}”</blockquote><footer>{d.foto_url?<img src={d.foto_url} alt={d.nome}/>:<span>{initials(d.nome)}</span>}<div><strong>{d.nome}</strong>{d.cidade&&<small>{d.cidade}</small>}</div></footer></article></RevealItem>)}</div>
  </div></Reveal><style>{`.premium-testimonials{background:${p.bg}}
    .premium-testimonials .section-label{color:${p.accent}}
    .premium-testimonials .section-heading h2{font-family:${font.display};font-weight:600;color:${p.text}}
    .premium-testimonials .section-heading>p{color:${p.textMuted}}
    .testimonial-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    .testimonial{height:100%;padding:34px;border:1px solid ${p.line};border-radius:${tema.radius}px;background:${p.card};display:flex;flex-direction:column}
    .testimonial__top{display:flex;align-items:center;justify-content:space-between}
    .testimonial__top>div{display:flex;gap:3px}
    .testimonial blockquote{margin:26px 0 30px;color:${p.text};font-size:18px;line-height:1.7;flex:1;font-family:${font.display};font-weight:500}
    .testimonial footer{display:flex;align-items:center;gap:12px}
    .testimonial footer>img,.testimonial footer>span{width:44px;height:44px;border-radius:50%;object-fit:cover;display:flex;align-items:center;justify-content:center;background:${gradienteDe(tema)};color:#0c0f12;font-size:12px;font-weight:700;font-family:${font.body}}
    .testimonial strong,.testimonial small{display:block;font-family:${font.body}}
    .testimonial strong{font-size:14px;color:${p.text}}
    .testimonial small{margin-top:3px;color:${p.textMuted};font-size:12px}
    @media(max-width:700px){.testimonial-grid{grid-template-columns:1fr}.testimonial{padding:26px}.testimonial blockquote{font-size:16px}}`}</style></section>;
}
