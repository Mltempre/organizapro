import Image from "next/image";
import { IcWa, Icon } from "./icons";
import { gerarIndicadoresConfianca } from "../_lib/helpers";
import { color, gradient, radius, shadow } from "../_lib/theme";
import type { Empresa } from "../_lib/types";

export default function Hero({ empresa, esp, local, titulo, subtitulo, waLink, whatsappNumber, mediaUrl, hasServices }: {
  empresa: Empresa; esp: string; local: string; titulo: string; subtitulo: string; waLink: string; whatsappNumber?: string; mediaUrl?: string | null; hasServices: boolean;
}) {
  const indicadores = gerarIndicadoresConfianca(empresa, local);
  return (
    <section id="hero" className={`premium-hero ${mediaUrl ? "premium-hero--media" : "premium-hero--editorial"}`}>
      <div className="premium-hero__inner">
        <div className="premium-hero__copy">
          {(esp || local) && <div className="premium-kicker"><span/>{[esp, local].filter(Boolean).join(" · ")}</div>}
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
          <div className="premium-actions">
            {whatsappNumber && <a href={waLink} target="_blank" rel="noreferrer" className="premium-button premium-button--primary"><IcWa size={17}/> Falar pelo WhatsApp</a>}
            {hasServices && <a href="#servicos" className="premium-button premium-button--secondary">Conhecer os serviços</a>}
          </div>
          {indicadores.length > 0 && <div className="premium-proof">
            {indicadores.map((item, index) => <span key={index}><Icon name={item.icone} size={14} color={item.icone === "star" ? color.star : color.accent}/>{item.texto}</span>)}
          </div>}
        </div>
        {mediaUrl && <figure className="premium-hero__media"><Image src={mediaUrl} alt={`Imagem de apresentação de ${empresa.nome || "empresa"}`} fill priority sizes="(max-width: 700px) 100vw, 46vw" unoptimized/><span aria-hidden="true"/></figure>}
      </div>
      <style>{`
        .premium-hero{position:relative;min-height:700px;padding:134px 24px 82px;display:flex;align-items:center;overflow:hidden;background:radial-gradient(760px 500px at 82% 30%,rgba(38,111,130,.18),transparent 72%),radial-gradient(560px 360px at 8% 16%,rgba(31,78,95,.13),transparent 72%),${color.ink}}
        .premium-hero:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px);background-size:56px 56px;mask-image:linear-gradient(#000,transparent 90%);pointer-events:none}
        .premium-hero__inner{position:relative;width:100%;max-width:1180px;margin:auto;display:grid;grid-template-columns:minmax(0,1fr);align-items:center}.premium-hero--media .premium-hero__inner{grid-template-columns:minmax(0,1.08fr) minmax(420px,.92fr);gap:68px}.premium-hero--editorial .premium-hero__inner{max-width:920px}.premium-hero--editorial .premium-hero__copy{max-width:820px;margin:auto;text-align:center}.premium-hero__copy{max-width:650px}.premium-kicker{display:inline-flex;align-items:center;gap:9px;padding:7px 13px;margin-bottom:25px;border:1px solid ${color.accentBorder};border-radius:999px;background:${color.accentSoft};color:${color.accent};font-size:11.5px;font-weight:700}.premium-kicker span{width:6px;height:6px;border-radius:50%;background:${color.accent}}
        .premium-hero h1{margin:0 0 22px;color:${color.text};font-size:clamp(46px,5.5vw,72px);line-height:1.015;letter-spacing:-.055em;font-weight:850}.premium-hero p{max-width:540px;margin:0 0 32px;color:${color.textMuted};font-size:17px;line-height:1.7}.premium-hero--editorial p{margin-left:auto;margin-right:auto}.premium-actions{display:flex;gap:12px;flex-wrap:wrap}.premium-hero--editorial .premium-actions,.premium-hero--editorial .premium-proof{justify-content:center}.premium-button{min-height:52px;padding:0 23px;border-radius:${radius.sm}px;display:inline-flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;font-size:14px;font-weight:750}.premium-button--primary{color:#fff;background:${gradient};border:1px solid rgba(137,218,237,.36);box-shadow:${shadow.ctaGlow}}.premium-button--secondary{color:${color.textBody};background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.13)}.premium-proof{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:28px;padding-top:20px;border-top:1px solid ${color.line};max-width:680px}.premium-proof span{display:flex;align-items:center;gap:7px;color:${color.textMuted};font-size:12.5px;font-weight:600}.premium-hero__media{position:relative;margin:0;aspect-ratio:4/4.35;border-radius:28px;overflow:hidden;border:1px solid ${color.lineStrong};box-shadow:${shadow.hero};background:${color.ink2}}.premium-hero__media img{display:block;width:100%;height:100%;object-fit:cover}.premium-hero__media span{position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035);border-radius:inherit;pointer-events:none}
        @media(max-width:960px){.premium-hero--media .premium-hero__inner{grid-template-columns:1fr 42%;gap:36px}.premium-hero h1{font-size:clamp(42px,6vw,62px)}}
        @media(max-width:700px){.premium-hero{min-height:auto;padding:104px 20px 58px}.premium-hero--media .premium-hero__inner{grid-template-columns:1fr;gap:34px}.premium-hero--editorial .premium-hero__copy{text-align:left}.premium-hero h1{font-size:clamp(39px,12vw,52px);letter-spacing:-.045em}.premium-hero p{font-size:15.5px}.premium-hero--editorial p{margin-left:0}.premium-actions{flex-direction:column}.premium-hero--editorial .premium-actions,.premium-hero--editorial .premium-proof{justify-content:flex-start}.premium-button{width:100%}.premium-proof{gap:10px 16px}.premium-hero__media{aspect-ratio:4/3;order:2;border-radius:20px}}
      `}</style>
    </section>
  );
}
