import { IcWa, Icon } from "../../_components/icons";
import { gerarIndicadoresConfianca } from "../../_lib/helpers";
import type { Tema } from "../../_lib/families";
import type { Empresa } from "../../_lib/types";

// ── Hero PULSE ────────────────────────────────────────────────────────────
// Full-bleed: a foto cadastrada ocupa a tela inteira sob um véu escuro, o
// título entra grande embaixo à esquerda e os fatos REAIS cadastrados viram
// uma faixa de indicadores na base. Sem foto, o lugar nunca é um retângulo
// vazio: é um painel de cor da marca com o monograma. Nada é inventado — a
// faixa some quando não há nenhum dado cadastrado.
export default function Hero({ empresa, esp, local, titulo, subtitulo, waLink, whatsappNumber, mediaUrl, hasServices, tema }: {
  empresa: Empresa; esp: string; local: string; titulo: string; subtitulo: string; waLink: string; whatsappNumber?: string; mediaUrl?: string | null; hasServices: boolean; tema: Tema;
}) {
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  const indicadores = gerarIndicadoresConfianca(empresa, local);
  return (
    <section id="hero" className="pulse-hero">
      {mediaUrl
        ? <img className="pulse-hero__bg" src={mediaUrl} alt="" aria-hidden="true" decoding="async"/>
        : <div className="pulse-hero__bg pulse-hero__bg--fallback" aria-hidden="true"><span>{(empresa.nome || "•").charAt(0).toUpperCase()}</span></div>}
      <div className="pulse-hero__veil" aria-hidden="true"/>
      <div className="pulse-hero__inner">
        <div className="pulse-hero__copy">
          {(esp || local) && <div className="pulse-hero__tags">
            {esp && <span>{esp}</span>}
            {local && <span>{local}</span>}
          </div>}
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
          <div className="pulse-hero__actions">
            {whatsappNumber && <a className="pulse-hero__primary" href={waLink} target="_blank" rel="noreferrer"><IcWa size={18}/>Chamar no WhatsApp</a>}
            {hasServices && <a className="pulse-hero__ghost" href="#servicos">Ver serviços</a>}
          </div>
        </div>
      </div>
      {indicadores.length > 0 && <ul className="pulse-hero__strip">
        {indicadores.map((item, i) => <li key={i}><Icon name={item.icone} size={15} color={tema.primary}/><span>{item.texto}</span></li>)}
      </ul>}
      <style>{`
        .pulse-hero{position:relative;isolation:isolate;overflow:hidden;background:${tema.ink};padding:132px 24px 0;min-height:min(90vh,780px);display:flex;flex-direction:column;justify-content:flex-end}
        .pulse-hero__bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}
        .pulse-hero__bg--fallback{display:flex;align-items:center;justify-content:center;background:linear-gradient(150deg,${tema.primarySoft},transparent 55%),linear-gradient(330deg,${tema.primary},transparent 72%),${tema.ink2}}
        .pulse-hero__bg--fallback span{font-family:${font.display};font-size:clamp(110px,24vw,250px);font-weight:800;line-height:1;color:${tema.primary};opacity:.2}
        .pulse-hero__veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,8,7,.8) 0%,rgba(10,8,7,.5) 40%,rgba(10,8,7,.93) 100%)}
        .pulse-hero__inner{position:relative;z-index:1;width:100%;max-width:1240px;margin:0 auto;padding:40px 0 54px}
        .pulse-hero__copy{max-width:780px;min-width:0}
        .pulse-hero__tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
        .pulse-hero__tags span{padding:7px 14px;border-radius:999px;border:1px solid ${tema.primaryBorder};background:rgba(0,0,0,.34);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:${tema.primary};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;overflow-wrap:anywhere}
        .pulse-hero h1{margin:0 0 20px;font-family:${font.display};font-weight:800;font-size:clamp(36px,6.2vw,74px);line-height:1;letter-spacing:-.025em;color:${tema.text};text-wrap:balance;overflow-wrap:anywhere}
        .pulse-hero__copy>p{max-width:560px;margin:0 0 30px;font-family:${font.body};font-size:17px;line-height:1.7;color:${tema.textMuted};overflow-wrap:anywhere}
        .pulse-hero__actions{display:flex;flex-wrap:wrap;gap:12px}
        .pulse-hero__primary,.pulse-hero__ghost{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:56px;padding:0 28px;border-radius:999px;text-decoration:none;font-family:${font.body};font-size:14px;font-weight:800;letter-spacing:.04em;transition:transform .16s,background .2s,color .2s,border-color .2s}
        .pulse-hero__primary{background:${tema.primary};color:${tema.ink3};box-shadow:0 22px 48px -20px rgba(0,0,0,.75)}
        .pulse-hero__primary:hover{transform:translateY(-2px)}
        .pulse-hero__ghost{border:1px solid rgba(255,255,255,.26);color:${tema.text}}
        .pulse-hero__ghost:hover{border-color:${tema.primary};color:${tema.primary}}
        .pulse-hero__strip{position:relative;z-index:1;width:100%;max-width:1240px;margin:0 auto;padding:0;list-style:none;display:flex;flex-wrap:wrap;align-items:center;gap:12px 40px;border-top:1px solid rgba(255,255,255,.16)}
        .pulse-hero__strip li{display:flex;align-items:center;gap:9px;min-width:0;padding:18px 0;font-family:${font.body};font-size:12.5px;font-weight:600;color:${tema.textMuted};overflow-wrap:anywhere}
        @media(max-width:820px){
          .pulse-hero{padding:104px 20px 0;min-height:0}
          .pulse-hero__inner{padding:28px 0 38px}
          .pulse-hero h1{font-size:clamp(32px,9.4vw,46px)}
          .pulse-hero__copy>p{font-size:15.5px;margin-bottom:26px}
          .pulse-hero__actions{flex-direction:column;align-items:stretch}
          .pulse-hero__primary,.pulse-hero__ghost{width:100%}
          .pulse-hero__strip{flex-direction:column;align-items:stretch;gap:0}
          .pulse-hero__strip li{padding:13px 0;border-bottom:1px solid rgba(255,255,255,.1)}
          .pulse-hero__strip li:last-child{border-bottom:0;padding-bottom:20px}
        }
      `}</style>
    </section>
  );
}
