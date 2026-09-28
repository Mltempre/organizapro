import Reveal from "./Reveal";
import { IcWa, IcPhone } from "./icons";
import type { Tema } from "../_lib/families";
import type { Empresa } from "../_lib/types";

// ── CTA final AURORA ──────────────────────────────────────────────────────
// Fecho em painel claro com lavagem de gradiente da marca: contraste alto com
// o rodapé escuro logo abaixo, sem repetir o hero. Só existe com WhatsApp ou
// telefone cadastrado — nunca um botão que não leva a lugar nenhum.
export default function CtaFinal({ empresa, waLink, whatsappNumber, titulo, subtitulo, ctaTexto, tema }: { empresa: Empresa; waLink: string; whatsappNumber?: string; titulo: string; subtitulo: string; ctaTexto: string; tema: Tema }) {
  if (!whatsappNumber && !empresa.telefone) return null;
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  return <section className="aurora-cta"><Reveal><div className="aurora-cta__box">
    <span className="aurora-label">Vamos conversar</span>
    <h2>{titulo}</h2>
    <p>{subtitulo}</p>
    <div className="aurora-cta__actions">
      {whatsappNumber && <a className="aurora-cta__primary" href={waLink} target="_blank" rel="noreferrer"><IcWa size={17}/>{ctaTexto}</a>}
      {empresa.telefone && <a className="aurora-cta__ghost" href={"tel:" + empresa.telefone}><IcPhone/>{empresa.telefone}</a>}
    </div>
    <p className="aurora-cta__reassure">Resposta rápida, sem compromisso.</p>
  </div></Reveal><style>{`
    .aurora-cta{padding:110px 24px;background:
      radial-gradient(620px 320px at 50% 0%, ${tema.primarySoft}, transparent 72%),
      radial-gradient(520px 300px at 12% 100%, ${tema.emotionalSoft}, transparent 70%),
      ${tema.paper2}}
    .aurora-cta__box{max-width:760px;margin:0 auto;text-align:center}
    .aurora-label{display:inline-block;color:${tema.contrast};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .aurora-cta h2{margin:20px auto 14px;font-family:${font.display};font-weight:600;font-size:clamp(31px,4.4vw,50px);line-height:1.08;letter-spacing:-.015em;color:${tema.textOnPaper};text-wrap:balance}
    .aurora-cta p{margin:0 0 32px;font-family:${font.body};font-size:16px;line-height:1.7;color:${tema.textMutedOnPaper}}
    .aurora-cta__actions{display:flex;justify-content:center;flex-wrap:wrap;gap:12px}
    .aurora-cta__actions a{min-height:54px;padding:0 26px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;font-family:${font.body};font-size:14.5px;font-weight:700;transition:transform .16s,box-shadow .16s}
    .aurora-cta__primary{background:${tema.contrast};color:#fff;box-shadow:0 18px 38px -16px ${tema.contrast}}
    .aurora-cta__primary:hover{transform:translateY(-2px)}
    .aurora-cta__ghost{background:rgba(255,255,255,.7);border:1px solid ${tema.lineOnPaper};color:${tema.textOnPaper};overflow-wrap:anywhere}
    .aurora-cta__ghost:hover{border-color:${tema.primaryBorder};color:${tema.contrast}}
    .aurora-cta__reassure{margin:22px 0 0 !important;font-size:12.5px !important;color:${tema.textFaint} !important}
    @media(max-width:600px){.aurora-cta{padding:78px 20px}.aurora-cta__actions{flex-direction:column}.aurora-cta__actions a{width:100%}}
  `}</style></section>;
}
