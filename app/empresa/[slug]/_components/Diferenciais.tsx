import Reveal from "./Reveal";
import { Icon } from "./icons";
import { DIFERENCIAIS } from "../_lib/content";
import { font, paleta, type FamiliaId, type Tema, type Tone } from "../_lib/families";

// A seção que mais "cheirava a template": antes, os mesmos 6 itens fixos
// para qualquer negócio do país. Agora o conteúdo vem da família visual do
// segmento — ainda uma verdade universal (nunca um fato específico e
// inventado sobre esta empresa), mas relevante para quem está lendo.
export default function Diferenciais({ familiaId, tema, tone = "light", variant = 1 }: { familiaId: FamiliaId; tema: Tema; tone?: Tone; variant?: 1 | 2 }) {
  const itens = DIFERENCIAIS[familiaId];
  const p = paleta(tema, tone, variant);
  return (
    <section className="premium-section premium-dif">
      <Reveal>
        <div className="section-shell premium-dif__grid">
          <div className="premium-dif__intro">
            <span className="section-label">Por que escolher</span>
            <h2>Uma experiência simples, clara e bem cuidada.</h2>
            <p>Princípios que orientam cada contato, do primeiro atendimento à entrega.</p>
          </div>
          <div className="premium-dif__list">
            {itens.map((d, i) => (
              <div className="premium-dif__item" key={d.titulo}>
                <span className="premium-dif__tick"><Icon name="check" size={13} color={p.accent}/></span>
                <div><h3>{d.titulo}</h3><p>{d.desc}</p></div>
                <span className="premium-dif__no">{String(i + 1).padStart(2, "0")}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
      <style>{`
        .premium-dif{background:${p.bg}}
        .premium-dif__grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:100px}
        .premium-dif__intro{position:sticky;top:110px;align-self:start}
        .premium-dif h2{margin:20px 0 18px;font-family:${font.display};font-weight:600;font-size:clamp(30px,3.8vw,44px);line-height:1.1;color:${p.text}}
        .premium-dif__intro>p{max-width:400px;color:${p.textMuted};font-size:15.5px;line-height:1.75;font-family:${font.body}}
        .premium-dif__item{position:relative;display:grid;grid-template-columns:30px 1fr;gap:16px;padding:26px 0;border-top:1px solid ${p.line}}
        .premium-dif__list .premium-dif__item:last-child{border-bottom:1px solid ${p.line}}
        .premium-dif__tick{width:30px;height:30px;border-radius:50%;border:1.5px solid ${p.accent};display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .premium-dif__item h3{margin:0 0 7px;font-size:17.5px;font-weight:800;color:${p.text};font-family:${font.body}}
        .premium-dif__item p{margin:0;color:${p.textMuted};font-size:14px;line-height:1.7;font-family:${font.body}}
        .premium-dif__no{position:absolute;right:0;top:26px;font-family:${font.display};font-size:13px;color:${p.textMuted};opacity:.5}
        @media(max-width:800px){.premium-dif__grid{grid-template-columns:1fr;gap:36px}.premium-dif__intro{position:static}.premium-dif__no{display:none}}
      `}</style>
    </section>
  );
}
