import Image from "next/image";
import { IcWa, Icon } from "./icons";
import { gerarIndicadoresConfianca } from "../_lib/helpers";
import { radius, shadow, gradienteDe, brilhoCta } from "../_lib/theme";
import { font, type Tema } from "../_lib/families";
import type { Empresa } from "../_lib/types";

// Hero — precisa responder em até 5 segundos: o que a empresa faz, para
// quem, qual benefício, por que confiar, e qual o próximo passo. Sem foto
// real cadastrada, o fallback visual nunca é um retângulo cinza vazio: é uma
// composição de cor própria da família, para nunca parecer "espaço vazio
// esperando uma imagem" — e nunca depende de um banco de imagens que entregue
// a identidade do nicho no lugar da empresa real.
export default function Hero({ empresa, esp, local, titulo, subtitulo, waLink, whatsappNumber, mediaUrl, hasServices, tema }: {
  empresa: Empresa; esp: string; local: string; titulo: string; subtitulo: string; waLink: string; whatsappNumber?: string; mediaUrl?: string | null; hasServices: boolean; tema: Tema;
}) {
  const indicadores = gerarIndicadoresConfianca(empresa, local);
  return (
    <section id="hero" className={`premium-hero ${mediaUrl ? "premium-hero--media" : "premium-hero--fallback"}`}>
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
            {indicadores.map((item, index) => <span key={index}><Icon name={item.icone} size={14} color={item.icone === "star" ? tema.emotional : tema.primary}/>{item.texto}</span>)}
          </div>}
        </div>
        {mediaUrl ? (
          <figure className="premium-hero__media"><Image src={mediaUrl} alt={`Imagem de apresentação de ${empresa.nome || "empresa"}`} fill priority sizes="(max-width: 700px) 100vw, 46vw" unoptimized/><span aria-hidden="true"/></figure>
        ) : (
          <div className="premium-hero__fallback" aria-hidden="true">
            <span className="premium-hero__fallback-mark">{(empresa.nome || "•").charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>
      <style>{`
        .premium-hero{position:relative;min-height:660px;padding:134px 24px 86px;display:flex;align-items:center;overflow:hidden;background:radial-gradient(760px 500px at 82% 26%,${tema.primarySoft},transparent 72%),radial-gradient(520px 360px at 6% 12%,${tema.emotionalSoft},transparent 70%),${tema.ink}}
        .premium-hero:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px);background-size:56px 56px;mask-image:linear-gradient(#000,transparent 90%);pointer-events:none}
        .premium-hero__inner{position:relative;width:100%;max-width:1180px;margin:auto;display:grid;grid-template-columns:minmax(0,1fr);align-items:center}
        .premium-hero--media .premium-hero__inner,.premium-hero--fallback .premium-hero__inner{grid-template-columns:minmax(0,1.05fr) minmax(360px,.86fr);gap:64px}
        .premium-hero__copy{max-width:640px}
        .premium-kicker{display:inline-flex;align-items:center;gap:9px;padding:7px 13px;margin-bottom:24px;border:1px solid ${tema.primaryBorder};border-radius:${radius.pill}px;background:${tema.primarySoft};color:${tema.primary};font-size:11.5px;font-weight:700;letter-spacing:.02em}
        .premium-kicker span{width:6px;height:6px;border-radius:50%;background:${tema.primary}}
        .premium-hero h1{margin:0 0 22px;color:${tema.text};font-family:${font.display};font-size:clamp(40px,5.2vw,62px);line-height:1.04;letter-spacing:-.015em;font-weight:600}
        .premium-hero p{max-width:480px;margin:0 0 32px;color:${tema.textMuted};font-size:17px;line-height:1.7;font-family:${font.body}}
        .premium-actions{display:flex;gap:12px;flex-wrap:wrap}
        .premium-button{min-height:52px;padding:0 23px;border-radius:${radius.pill}px;display:inline-flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;font-size:14px;font-weight:700;font-family:${font.body};transition:transform .15s,box-shadow .15s}
        .premium-button--primary{color:#0c0f12;background:${gradienteDe(tema)};border:1px solid rgba(255,255,255,.14);box-shadow:${brilhoCta(tema)}}
        .premium-button--primary:hover{transform:translateY(-1.5px)}
        .premium-button--secondary{color:${tema.text};background:rgba(255,255,255,.03);border:1px solid ${tema.line}}
        .premium-button--secondary:hover{border-color:${tema.primaryBorder};color:${tema.primary}}
        .premium-proof{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:28px;padding-top:20px;border-top:1px solid ${tema.line};max-width:640px}
        .premium-proof span{display:flex;align-items:center;gap:7px;color:${tema.textMuted};font-size:12.5px;font-weight:600}
        .premium-hero__media,.premium-hero__fallback{position:relative;margin:0;aspect-ratio:4/4.3;border-radius:${tema.radius}px;overflow:hidden;border:1px solid ${tema.line};box-shadow:${shadow.hero}}
        .premium-hero__media img{display:block;width:100%;height:100%;object-fit:cover}
        .premium-hero__media span{position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035);border-radius:inherit;pointer-events:none}
        .premium-hero__fallback{background:linear-gradient(155deg,${tema.primarySoft},transparent 55%),linear-gradient(340deg,${tema.emotionalSoft},transparent 60%),${tema.ink2};display:flex;align-items:center;justify-content:center}
        .premium-hero__fallback:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.028) 0 2px,transparent 2px 46px)}
        .premium-hero__fallback-mark{position:relative;font-family:${font.display};font-size:88px;font-weight:600;color:${tema.primary};opacity:.5}
        @media(max-width:960px){.premium-hero--media .premium-hero__inner,.premium-hero--fallback .premium-hero__inner{grid-template-columns:1fr 40%;gap:32px}.premium-hero h1{font-size:clamp(36px,6vw,52px)}}
        @media(max-width:700px){.premium-hero{min-height:auto;padding:104px 20px 58px}.premium-hero--media .premium-hero__inner,.premium-hero--fallback .premium-hero__inner{grid-template-columns:1fr;gap:30px}.premium-hero h1{font-size:clamp(34px,11vw,46px)}.premium-hero p{font-size:15.5px}.premium-actions{flex-direction:column}.premium-button{width:100%}.premium-proof{gap:10px 16px}.premium-hero__media,.premium-hero__fallback{aspect-ratio:16/10;order:2}.premium-hero__fallback-mark{font-size:56px}}
      `}</style>
    </section>
  );
}
