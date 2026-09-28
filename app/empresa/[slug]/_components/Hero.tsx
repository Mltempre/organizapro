import { IcWa, Icon } from "./icons";
import { gerarIndicadoresConfianca } from "../_lib/helpers";
import type { Tema } from "../_lib/families";
import type { Empresa } from "../_lib/types";

// ── Hero AURORA ───────────────────────────────────────────────────────────
// Claro e contemporâneo: malha de gradiente suave sobre off-white, tipografia
// grande, imagem emoldurada em raio generoso e cartões de prova flutuando na
// borda da foto (nota do Google e horário SÓ quando existem no cadastro).
// Sem foto cadastrada, o lugar nunca é um retângulo cinza vazio: é um painel
// de cor e textura do próprio modelo com o monograma da empresa.
export default function Hero({ empresa, esp, local, titulo, subtitulo, waLink, whatsappNumber, mediaUrl, hasServices, tema }: {
  empresa: Empresa; esp: string; local: string; titulo: string; subtitulo: string; waLink: string; whatsappNumber?: string; mediaUrl?: string | null; hasServices: boolean; tema: Tema;
}) {
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  const indicadores = gerarIndicadoresConfianca(empresa, local);
  const temNota = Boolean(empresa.nota_google);
  const nota = empresa.nota_google ? String(empresa.nota_google).replace(".", ",") : "";
  return (
    <section id="hero" className="aurora-hero">
      <div className="aurora-hero__inner">
        <div className="aurora-hero__copy">
          {(esp || local) && <div className="aurora-kicker"><span/>{[esp, local].filter(Boolean).join(" · ")}</div>}
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
          <div className="aurora-actions">
            {whatsappNumber && <a className="aurora-btn aurora-btn--primary" href={waLink} target="_blank" rel="noreferrer"><IcWa size={17}/> Falar no WhatsApp</a>}
            {hasServices && <a className="aurora-btn aurora-btn--ghost" href="#servicos">Conhecer os serviços</a>}
          </div>
          {indicadores.length > 0 && <ul className="aurora-proof">
            {indicadores.map((item, i) => <li key={i}><Icon name={item.icone} size={15} color={item.icone === "star" ? tema.emotional : tema.contrast}/>{item.texto}</li>)}
          </ul>}
        </div>

        <div className="aurora-hero__media">
          {mediaUrl
            ? <img src={mediaUrl} alt={`Imagem de apresentação de ${empresa.nome || "empresa"}`} decoding="async"/>
            : <div className="aurora-hero__fallback" aria-hidden="true"><span>{(empresa.nome || "•").charAt(0).toUpperCase()}</span></div>}
          {temNota && <div className="aurora-float aurora-float--rating">
            <div className="aurora-float__stars" aria-hidden="true">{[1,2,3,4,5].map(n => <Icon key={n} name="star" size={13} color={n <= Math.round(empresa.nota_google!) ? tema.emotional : tema.lineOnPaper}/>)}</div>
            <strong>{nota}</strong>
            <small>{empresa.num_avaliacoes ? `${empresa.num_avaliacoes} avaliações no Google` : "Avaliação no Google"}</small>
          </div>}
          {empresa.horario_funcionamento && <div className="aurora-float aurora-float--hours">
            <Icon name="clock" size={15} color={tema.contrast}/>
            <span>{empresa.horario_funcionamento}</span>
          </div>}
        </div>
      </div>

      <style>{`
        .aurora-hero{position:relative;overflow:hidden;padding:150px 24px 96px;background:
          radial-gradient(680px 420px at 88% 8%, ${tema.primarySoft}, transparent 70%),
          radial-gradient(520px 380px at 4% 96%, ${tema.emotionalSoft}, transparent 72%),
          ${tema.paper}}
        .aurora-hero:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(${tema.lineOnPaper} 1px,transparent 1px),linear-gradient(90deg,${tema.lineOnPaper} 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(circle at 50% 30%,#000,transparent 78%);opacity:.6}
        .aurora-hero__inner{position:relative;max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.04fr) minmax(0,.96fr);gap:56px;align-items:center}
        .aurora-hero__copy{min-width:0;animation:auroraIn .7s ease both}
        .aurora-kicker{display:inline-flex;align-items:center;gap:9px;padding:8px 15px;margin-bottom:26px;border:1px solid ${tema.primaryBorder};border-radius:999px;background:rgba(255,255,255,.6);color:${tema.contrast};font-family:${font.body};font-size:11.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase}
        .aurora-kicker span{width:6px;height:6px;border-radius:50%;background:${tema.contrast}}
        .aurora-hero h1{margin:0 0 22px;font-family:${font.display};font-weight:600;font-size:clamp(37px,5.1vw,60px);line-height:1.05;letter-spacing:-.022em;color:${tema.textOnPaper};text-wrap:balance}
        .aurora-hero p{max-width:500px;margin:0 0 34px;font-family:${font.body};font-size:17px;line-height:1.72;color:${tema.textMutedOnPaper};overflow-wrap:anywhere}
        .aurora-actions{display:flex;flex-wrap:wrap;gap:12px}
        .aurora-btn{min-height:54px;padding:0 24px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;font-family:${font.body};font-size:14.5px;font-weight:700;transition:transform .16s,box-shadow .16s,background .16s}
        .aurora-btn--primary{background:${tema.contrast};color:#fff;box-shadow:0 16px 34px -14px ${tema.contrast}}
        .aurora-btn--primary:hover{transform:translateY(-2px)}
        .aurora-btn--ghost{background:rgba(255,255,255,.72);border:1px solid ${tema.lineOnPaper};color:${tema.textOnPaper}}
        .aurora-btn--ghost:hover{border-color:${tema.primaryBorder};color:${tema.contrast}}
        .aurora-proof{display:flex;flex-wrap:wrap;gap:10px 22px;margin:30px 0 0;padding:22px 0 0;border-top:1px solid ${tema.lineOnPaper};list-style:none}
        .aurora-proof li{display:flex;align-items:center;gap:8px;font-family:${font.body};font-size:12.5px;font-weight:600;color:${tema.textMutedOnPaper}}
        .aurora-hero__media{position:relative;min-width:0;animation:auroraIn .8s ease .1s both}
        .aurora-hero__media>img{display:block;width:100%;aspect-ratio:4/4.2;object-fit:cover;border-radius:28px;border:1px solid ${tema.lineOnPaper};box-shadow:0 40px 80px -34px rgba(10,15,31,.42)}
        .aurora-hero__fallback{position:relative;aspect-ratio:4/4.2;border-radius:28px;border:1px solid ${tema.lineOnPaper};overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(150deg,${tema.primarySoft},transparent 58%),linear-gradient(330deg,${tema.emotionalSoft},transparent 62%),${tema.paper2}}
        .aurora-hero__fallback:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(10,15,31,.035) 0 1px,transparent 1px 34px)}
        .aurora-hero__fallback span{position:relative;font-family:${font.display};font-size:96px;font-weight:600;color:${tema.contrast};opacity:.32}
        .aurora-float{position:absolute;background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid ${tema.lineOnPaper};border-radius:18px;box-shadow:0 22px 44px -26px rgba(10,15,31,.4);font-family:${font.body}}
        .aurora-float--rating{left:-18px;bottom:26px;padding:14px 18px;display:grid;gap:2px;max-width:220px}
        .aurora-float__stars{display:flex;gap:2px}
        .aurora-float--rating strong{font-family:${font.display};font-size:22px;color:${tema.textOnPaper};line-height:1.1}
        .aurora-float--rating small{font-size:11.5px;color:${tema.textMutedOnPaper}}
        .aurora-float--hours{right:-10px;top:24px;display:flex;align-items:center;gap:9px;padding:12px 16px;font-size:12.5px;font-weight:600;color:${tema.textOnPaper};max-width:230px;overflow-wrap:anywhere}
        @keyframes auroraIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @media(prefers-reduced-motion:reduce){.aurora-hero__copy,.aurora-hero__media{animation:none}}
        @media(max-width:1024px){.aurora-hero{padding:132px 22px 80px}.aurora-hero__inner{grid-template-columns:minmax(0,1fr) minmax(0,44%);gap:34px}}
        @media(max-width:820px){
          .aurora-hero{padding:116px 20px 66px}
          .aurora-hero__inner{grid-template-columns:1fr;gap:34px}
          .aurora-hero h1{font-size:clamp(32px,9vw,44px)}
          .aurora-hero p{font-size:15.5px;margin-bottom:26px}
          .aurora-actions{flex-direction:column;align-items:stretch}
          .aurora-btn{width:100%}
          .aurora-hero__media>img,.aurora-hero__fallback{aspect-ratio:16/11}
          .aurora-float--rating{left:12px;bottom:12px;padding:11px 14px}
          .aurora-float--hours{right:12px;top:12px}
        }
      `}</style>
    </section>
  );
}
