import Reveal, { RevealItem } from "./Reveal";
import { Icon } from "./icons";
import { gerarTituloServicos } from "../_lib/helpers";
import { CTA_CONTEXTUAL } from "../_lib/content";
import { paleta, type FamiliaId, type Tema, type Tone } from "../_lib/families";
import type { DBServico, Empresa } from "../_lib/types";
import { construirLinkComRastreio } from "../../../../lib/atribuicao-origem";

// Nunca float — mesma convenção de preco_centavos em todo o schema real.
function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Serviços AURORA ───────────────────────────────────────────────────────
// Grade editorial: o primeiro serviço vira destaque (imagem grande) quando há
// imagem, os demais em cartões claros com fio fino, número, preço público
// quando existir e uma via direta de contato por item. Só serviços REAIS
// cadastrados; item pausado (disponivel === false) desaparece. Preço e
// WhatsApp nunca são inventados.
export default function Servicos({ servicos, empresa, tema, familiaId, waBase, codigoRastreio, tone = "light", variant = 2 }: { servicos: DBServico[]; empresa: Empresa; tema: Tema; familiaId: FamiliaId; waBase?: string; codigoRastreio?: string; tone?: Tone; variant?: 1 | 2 }) {
  const visiveis = servicos.filter((s) => s.disponivel !== false);
  if (visiveis.length === 0) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  const msg = CTA_CONTEXTUAL[familiaId].servicos;
  const temDestaque = visiveis.length > 2 && Boolean(visiveis[0].imagem_url);

  return <section id="servicos" className="premium-section aurora-services"><Reveal><div className="aurora-services__shell">
    <div className="aurora-services__head">
      <div>
        <span className="aurora-label">O que oferecemos</span>
        <h2>{gerarTituloServicos(empresa)}</h2>
      </div>
      <p>Serviços reais cadastrados por {empresa.nome || "esta empresa"}, apresentados para você escolher com clareza.</p>
    </div>
    <div className={`aurora-services__grid ${temDestaque ? "has-feature" : ""}`}>
      {visiveis.map((s, i) => {
        const temPreco = typeof s.preco_centavos === "number" && s.preco_centavos > 0;
        const mensagem = temPreco ? `${msg} (${s.nome} — ${formatarPreco(s.preco_centavos!)})` : `${msg} (${s.nome})`;
        const link = waBase ? `${waBase}${encodeURIComponent(mensagem)}` : "";
        const href = link && codigoRastreio ? construirLinkComRastreio(link, codigoRastreio) : link;
        const destaque = temDestaque && i === 0;
        return <RevealItem key={s.id} index={i}>
          <article className={`aurora-service ${s.imagem_url ? "has-image" : ""} ${destaque ? "is-feature" : ""}`}>
            {s.imagem_url && <img src={s.imagem_url} alt={s.nome} loading="lazy" decoding="async"/>}
            <div className="aurora-service__body">
              <span className="aurora-service__no">{String(i + 1).padStart(2, "0")}</span>
              {!s.imagem_url && <span className="aurora-service__icon"><Icon name={s.icone || "target"} size={19} color={p.accent}/></span>}
              <div className="aurora-service__text">
                <h3>{s.nome}</h3>
                {s.descricao && <p>{s.descricao}</p>}
                {temPreco && <strong className="aurora-service__price">{formatarPreco(s.preco_centavos!)}</strong>}
              </div>
            </div>
            {href && <a className="aurora-service__link" href={href} target="_blank" rel="noreferrer">{temPreco ? "Pedir este item" : "Perguntar sobre este serviço"} <span aria-hidden="true">→</span></a>}
          </article>
        </RevealItem>;
      })}
    </div>
  </div></Reveal>
  <style>{`
    .aurora-services{background:${p.bg}}
    .aurora-services__shell{max-width:1180px;margin:0 auto}
    .aurora-services__head{display:flex;align-items:flex-end;justify-content:space-between;gap:44px;margin-bottom:44px}
    .aurora-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .aurora-services h2{margin:16px 0 0;font-family:${font.display};font-weight:600;font-size:clamp(29px,3.6vw,44px);line-height:1.12;color:${p.text};max-width:600px;text-wrap:balance}
    .aurora-services__head>p{max-width:360px;margin:0;font-family:${font.body};font-size:14px;line-height:1.75;color:${p.textMuted}}
    .aurora-services__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(268px,1fr));gap:18px}
    .aurora-services__grid.has-feature{grid-template-columns:repeat(3,minmax(0,1fr))}
    .aurora-service{position:relative;height:100%;min-height:230px;display:flex;flex-direction:column;border:1px solid ${p.line};border-radius:22px;background:${p.card};overflow:hidden;transition:transform .22s,box-shadow .22s,border-color .22s}
    .aurora-service:hover{transform:translateY(-3px);box-shadow:0 26px 54px -30px rgba(10,15,31,.45);border-color:${tema.primaryBorder}}
    .aurora-service.is-feature{grid-column:span 2;min-height:330px}
    .aurora-service.has-image{min-height:330px;justify-content:flex-end}
    .aurora-service>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .aurora-service.has-image:after{content:"";position:absolute;inset:22% 0 0;background:linear-gradient(transparent,rgba(6,10,22,.9))}
    .aurora-service__body{position:relative;z-index:1;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;padding:26px 26px 0}
    .aurora-service.has-image .aurora-service__body{padding-top:0;margin-top:auto}
    .aurora-service__no{font-family:${font.display};font-size:12px;font-weight:700;color:${p.accent};letter-spacing:.06em;padding-top:5px}
    .aurora-service.has-image .aurora-service__no{color:#fff;opacity:.72}
    .aurora-service__icon{display:none}
    .aurora-service__text{min-width:0}
    .aurora-service h3{margin:0 0 9px;font-family:${font.body};font-size:18.5px;font-weight:700;line-height:1.3;color:${p.text};overflow-wrap:anywhere}
    .aurora-service.has-image h3{color:#fff}
    .aurora-service p{margin:0;font-family:${font.body};font-size:14px;line-height:1.7;color:${p.textMuted};overflow-wrap:anywhere}
    .aurora-service.has-image p{color:rgba(255,255,255,.8)}
    .aurora-service__price{display:inline-block;margin-top:12px;padding:6px 12px;border-radius:999px;background:${tema.primarySoft};color:${p.accent};font-family:${font.body};font-size:13px;font-weight:800}
    .aurora-service.has-image .aurora-service__price{background:rgba(255,255,255,.16);color:#fff}
    .aurora-service__link{position:relative;z-index:1;display:inline-flex;align-items:center;gap:7px;margin:16px 26px 24px;font-family:${font.body};font-size:12.5px;font-weight:700;color:${p.accent};text-decoration:none}
    .aurora-service.has-image .aurora-service__link{color:#fff;opacity:.92}
    .aurora-service__link:hover{gap:11px}
    @media(max-width:1080px){.aurora-services__grid.has-feature{grid-template-columns:repeat(2,minmax(0,1fr))}.aurora-service.is-feature{grid-column:span 2}}
    @media(max-width:760px){
      .aurora-services__head{flex-direction:column;align-items:flex-start;gap:16px}
      .aurora-services__grid,.aurora-services__grid.has-feature{grid-template-columns:1fr}
      .aurora-service.is-feature{grid-column:auto}
      .aurora-service,.aurora-service.has-image,.aurora-service.is-feature{min-height:223px}
    }
  `}</style></section>;
}
