import Reveal from "./Reveal";
import { PROBLEMA } from "../_lib/content";
import { font, paleta, type FamiliaId, type Tema, type Tone } from "../_lib/families";

// "Problema" — a seção que faltava. Não fala da empresa, fala do visitante:
// nomeia a dor universal do segmento antes de qualquer solução (nunca uma
// alegação específica e inventada sobre esta empresa). Responde a pergunta
// silenciosa: "eles entendem o que eu preciso?"
export default function Problema({ familiaId, tema, ctaHref, ctaTexto, tone = "light", variant = 1 }: { familiaId: FamiliaId; tema: Tema; ctaHref: string; ctaTexto: string; tone?: Tone; variant?: 1 | 2 }) {
  const conteudo = PROBLEMA[familiaId];
  const p = paleta(tema, tone, variant);
  return (
    <section className="premium-problema">
      <Reveal>
        <div className="premium-problema__box">
          <span className="section-label">O que você precisa saber</span>
          <h2>{conteudo.titulo}</h2>
          <p>{conteudo.corpo}</p>
          <a className="soft-cta" href={ctaHref} target="_blank" rel="noreferrer">{ctaTexto} →</a>
        </div>
      </Reveal>
      <style>{`
        .premium-problema{padding:96px 24px;background:${p.bg}}
        .premium-problema__box{max-width:700px;margin:0 auto}
        .premium-problema h2{font-family:${font.display};font-weight:600;font-size:clamp(27px,3.2vw,36px);line-height:1.24;margin:18px 0 22px;color:${p.text};text-wrap:balance}
        .premium-problema p{font-size:15.5px;line-height:1.8;color:${p.textMuted};margin:0 0 26px;font-family:${font.body}}
        .soft-cta{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:${p.accent};border-bottom:1px solid ${p.accent};padding-bottom:2px;text-decoration:none;transition:gap .15s;font-family:${font.body}}
        .soft-cta:hover{gap:13px}
        @media(max-width:700px){.premium-problema{padding:70px 22px}}
      `}</style>
    </section>
  );
}
