import Reveal from "./Reveal";
import { gerarTituloGaleria } from "../_lib/helpers";
import { paleta, type Tema, type Tone } from "../_lib/families";
import type { DBGaleria, DBEstrutura, DBAntes, Empresa } from "../_lib/types";

// ── Galeria + Estrutura + Antes/Depois — AURORA ───────────────────────────
// Mosaico bento com uma peça-âncora (a primeira foto ocupa dois terços da
// altura) em vez de miniaturas em grade uniforme. TODAS as fotos enviadas
// aparecem — nunca há recorte silencioso por posição (há teste de regressão
// exatamente para isso) — e cada tile traz legenda em pílula. Antes/Depois só
// aparece quando o negócio cadastrou os dois lados do par.
export default function Galeria({ galeria, estrutura, antesDepois = [], empresa, tema, tone = "light", variant = 2 }: { antesDepois?: DBAntes[]; galeria: DBGaleria[]; estrutura: DBEstrutura[]; empresa: Empresa; tema: Tema; tone?: Tone; variant?: 1 | 2 }) {
  const fotos = [...galeria.map(g => ({ id: g.id, url: g.url, titulo: g.titulo || g.categoria })), ...estrutura.map(e => ({ id: e.id, url: e.imagem_url, titulo: e.titulo }))].filter(f => f.url);
  const comparacoes = antesDepois.filter(a => a.antes_url && a.depois_url);
  if (!fotos.length && !comparacoes.length) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="galeria" className="premium-section aurora-gallery"><Reveal><div className="aurora-gallery__shell">
    <div className="aurora-gallery__head">
      <div><span className="aurora-label">Em imagens</span><h2>{gerarTituloGaleria(empresa)}</h2></div>
      <p>Registros reais do trabalho, do ambiente e dos detalhes de {empresa.nome || "a empresa"}.</p>
    </div>
    {fotos.length > 0 && <div className={`aurora-gallery__grid ${fotos.length === 1 ? "is-single" : ""}`}>
      {fotos.map((f, i) => <figure key={f.id} className={`gallery-photo gallery-photo--${i}`}>
        <img src={f.url} alt={f.titulo} loading="lazy" decoding="async"/>
        <figcaption>{f.titulo}</figcaption>
      </figure>)}
    </div>}
    {comparacoes.length > 0 && <div className="aurora-gallery__cases">
      {comparacoes.map(caso => <article key={caso.id} className="aurora-case">
        <header><h3>{caso.titulo}</h3>{caso.descricao && <p>{caso.descricao}</p>}</header>
        <div className="aurora-case__pair">
          <figure><img src={caso.antes_url!} alt={`Antes: ${caso.titulo}`} loading="lazy" decoding="async"/><figcaption>Antes</figcaption></figure>
          <figure><img src={caso.depois_url!} alt={`Depois: ${caso.titulo}`} loading="lazy" decoding="async"/><figcaption>Depois</figcaption></figure>
        </div>
      </article>)}
    </div>}
  </div></Reveal>
  <style>{`
    .aurora-gallery{background:${p.bg}}
    .aurora-gallery__shell{max-width:1180px;margin:0 auto}
    .aurora-gallery__head{display:flex;align-items:flex-end;justify-content:space-between;gap:44px;margin-bottom:40px}
    .aurora-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .aurora-gallery h2{margin:16px 0 0;font-family:${font.display};font-weight:600;font-size:clamp(29px,3.6vw,44px);line-height:1.12;color:${p.text};max-width:600px;text-wrap:balance}
    .aurora-gallery__head>p{max-width:360px;margin:0;font-family:${font.body};font-size:14px;line-height:1.75;color:${p.textMuted}}
    .aurora-gallery__grid{display:grid;grid-template-columns:1.3fr .7fr;grid-auto-rows:250px;gap:14px}
    .aurora-gallery__grid.is-single{grid-template-columns:1fr;grid-auto-rows:minmax(280px,52vh)}
    .gallery-photo{position:relative;margin:0;overflow:hidden;border-radius:22px;border:1px solid ${p.line};background:${p.card}}
    .gallery-photo--0{grid-row:span 2}
    .aurora-gallery__grid.is-single .gallery-photo--0{grid-row:auto}
    .gallery-photo img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.2,1)}
    .gallery-photo:hover img{transform:scale(1.04)}
    .gallery-photo figcaption{position:absolute;left:14px;bottom:14px;max-width:calc(100% - 28px);padding:7px 13px;border-radius:999px;background:rgba(9,13,26,.66);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;font-family:${font.body};font-size:11.5px;font-weight:600;overflow-wrap:anywhere}
    .aurora-gallery__cases{margin-top:26px;display:grid;gap:22px}
    .aurora-case{padding:24px;border:1px solid ${p.line};border-radius:22px;background:${p.card}}
    .aurora-case h3{margin:0 0 6px;font-family:${font.display};font-weight:600;font-size:21px;color:${p.text}}
    .aurora-case header p{margin:0 0 16px;font-family:${font.body};font-size:14px;line-height:1.7;color:${p.textMuted}}
    .aurora-case__pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .aurora-case__pair figure{position:relative;margin:0;min-width:0}
    .aurora-case__pair img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;border-radius:16px;background:${p.bg}}
    .aurora-case__pair figcaption{position:absolute;left:12px;top:12px;padding:5px 11px;border-radius:999px;background:rgba(9,13,26,.7);color:#fff;font-family:${font.body};font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
    @media(max-width:900px){.aurora-gallery__head{flex-direction:column;align-items:flex-start;gap:16px}}
    @media(max-width:700px){
      .aurora-gallery__grid{grid-template-columns:1fr;grid-auto-rows:210px}
      .gallery-photo--0{grid-row:span 1}
      .aurora-gallery__grid.is-single{grid-auto-rows:minmax(220px,42vh)}
      .aurora-case__pair{grid-template-columns:1fr}
    }
  `}</style></section>;
}
