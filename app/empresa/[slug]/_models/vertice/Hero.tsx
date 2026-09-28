import { IcWa, Icon } from "../../_components/icons";
import { gerarIndicadoresConfianca } from "../../_lib/helpers";
import type { Tema } from "../../_lib/families";
import type { Empresa } from "../../_lib/types";

// ── Hero VÉRTICE ──────────────────────────────────────────────────────────
// Faixa institucional escura (grafite) com composição assimétrica: régua fina,
// título em serif editorial, retrato em moldura reta com legenda e uma linha de
// fatos cadastrados separada por fios. Zero cartão flutuante e zero raio —
// deliberadamente diferente do hero do Aurora.
export default function Hero({ empresa, esp, local, titulo, subtitulo, waLink, whatsappNumber, mediaUrl, hasServices, tema }: {
  empresa: Empresa; esp: string; local: string; titulo: string; subtitulo: string; waLink: string; whatsappNumber?: string; mediaUrl?: string | null; hasServices: boolean; tema: Tema;
}) {
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  const fatos = gerarIndicadoresConfianca(empresa, local).slice(0, 3);
  return (
    <section id="hero" className="vertice-hero">
      <div className="vertice-hero__inner">
        <div className="vertice-hero__copy">
          <div className="vertice-hero__eyebrow">
            <span className="vertice-hero__rule"/>
            <span>{[esp || "Atendimento", local].filter(Boolean).join(" — ")}</span>
          </div>
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
          <div className="vertice-hero__actions">
            {whatsappNumber && <a className="v-btn v-btn--solid" href={waLink} target="_blank" rel="noreferrer"><IcWa size={16}/>Falar no WhatsApp</a>}
            {hasServices && <a className="v-btn v-btn--line" href="#servicos">Serviços</a>}
          </div>
          {fatos.length > 0 && <ul className="vertice-hero__facts">
            {fatos.map((f, i) => <li key={i}><Icon name={f.icone} size={14} color={f.icone === "star" ? tema.emotional : tema.primary}/><span>{f.texto}</span></li>)}
          </ul>}
        </div>
        <figure className="vertice-hero__media">
          {mediaUrl
            ? <img src={mediaUrl} alt={`Imagem de apresentação de ${empresa.nome || "empresa"}`} decoding="async"/>
            : <div className="vertice-hero__fallback" aria-hidden="true"><span>{(empresa.nome || "•").charAt(0).toUpperCase()}</span></div>}
          <figcaption>
            <strong>{empresa.nome || "Empresa"}</strong>
            <span>{[esp, local].filter(Boolean).join(" · ") || "OrganizaPro"}</span>
          </figcaption>
        </figure>
      </div>

      <style>{`
        .vertice-hero{position:relative;background:${tema.ink};padding:170px 24px 92px;overflow:hidden}
        .vertice-hero:after{content:"";position:absolute;inset:0;pointer-events:none;background:
          linear-gradient(${tema.line} 1px,transparent 1px) 0 0/100% 132px,
          radial-gradient(760px 420px at 88% 0%, ${tema.primarySoft}, transparent 68%)}
        .vertice-hero__inner{position:relative;z-index:1;max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:64px;align-items:end}
        .vertice-hero__copy{min-width:0}
        .vertice-hero__eyebrow{display:flex;align-items:center;gap:14px;margin-bottom:30px}
        .vertice-hero__rule{width:52px;height:1px;background:${tema.primary}}
        .vertice-hero__eyebrow span:last-child{font-family:${font.body};font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${tema.primary};overflow-wrap:anywhere}
        .vertice-hero h1{margin:0 0 24px;font-family:${font.display};font-weight:600;font-size:clamp(38px,5vw,66px);line-height:1.03;letter-spacing:-.01em;color:${tema.text};text-wrap:balance}
        .vertice-hero p{max-width:520px;margin:0 0 34px;font-family:${font.body};font-size:17px;line-height:1.75;color:${tema.textMuted};overflow-wrap:anywhere}
        .vertice-hero__actions{display:flex;flex-wrap:wrap;gap:0}
        .v-btn{min-height:52px;padding:0 26px;display:inline-flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;font-family:${font.body};font-size:12.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;transition:background .2s,color .2s}
        .v-btn--solid{background:${tema.primary};color:${tema.ink3}}
        .v-btn--solid:hover{background:${tema.text};color:${tema.ink3}}
        .v-btn--line{border:1px solid ${tema.line};color:${tema.text};margin-left:12px}
        .v-btn--line:hover{border-color:${tema.primary};color:${tema.primary}}
        .vertice-hero__facts{display:flex;flex-wrap:wrap;gap:0;margin:40px 0 0;padding:0;list-style:none;border-top:1px solid ${tema.line}}
        .vertice-hero__facts li{display:flex;align-items:center;gap:9px;padding:16px 26px 0 0;margin-right:26px;font-family:${font.body};font-size:12px;font-weight:600;color:${tema.textMuted};overflow-wrap:anywhere}
        .vertice-hero__media{position:relative;margin:0;min-width:0}
        .vertice-hero__media>img,.vertice-hero__fallback{display:block;width:100%;aspect-ratio:4/4.6;object-fit:cover;border:1px solid ${tema.line}}
        .vertice-hero__fallback{display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,${tema.primarySoft},transparent 60%),${tema.ink2}}
        .vertice-hero__fallback span{font-family:${font.display};font-size:96px;color:${tema.primary};opacity:.34}
        .vertice-hero__media figcaption{display:flex;flex-direction:column;gap:5px;padding:16px 0 0;border-top:1px solid ${tema.line};margin-top:16px}
        .vertice-hero__media figcaption strong{font-family:${font.display};font-size:17px;font-weight:600;color:${tema.text}}
        .vertice-hero__media figcaption span{font-family:${font.body};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${tema.textFaint};overflow-wrap:anywhere}
        @media(max-width:1024px){.vertice-hero{padding:150px 22px 76px}.vertice-hero__inner{grid-template-columns:1fr;gap:42px;align-items:start}.vertice-hero__media{max-width:520px}}
        @media(max-width:680px){
          .vertice-hero{padding:128px 20px 62px}
          .vertice-hero h1{font-size:clamp(31px,9.5vw,42px)}
          .vertice-hero p{font-size:15.5px;margin-bottom:26px}
          .vertice-hero__actions{flex-direction:column}
          .v-btn{width:100%}
          .v-btn--line{margin:10px 0 0}
          .vertice-hero__facts{flex-direction:column;gap:0;margin-top:30px}
          .vertice-hero__facts li{padding:14px 0;margin-right:0;border-bottom:1px solid ${tema.line}}
        }
      `}</style>
    </section>
  );
}
