import Reveal from "./Reveal";
import { gerarTituloSobre } from "../_lib/helpers";
import { paleta, type Tema, type Tone } from "../_lib/families";
import type { Empresa } from "../_lib/types";
import { Icon } from "./icons";

// ── Sobre AURORA ──────────────────────────────────────────────────────────
// Não é um bloco de texto institucional: é uma composição em três colunas —
// afirmação grande à esquerda, texto real no centro e um painel de fatos
// cadastrados à direita (sede, segmento, horário, avaliação). Cada linha do
// painel só existe se o dado existir no cadastro; nada é inventado.
export default function Sobre({ empresa, nome, sobre, tema, tone = "light", variant = 1 }: { empresa: Empresa; nome: string; sobre: string[]; tema: Tema; tone?: Tone; variant?: 1 | 2 }) {
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const fatos: [string, string][] = [
    empresa.especialidade ? ["Atuação", empresa.especialidade] : null,
    local ? ["Onde atende", local] : null,
    empresa.endereco ? ["Endereço", empresa.endereco] : null,
    empresa.horario_funcionamento ? ["Horário", empresa.horario_funcionamento] : null,
    empresa.nota_google ? ["Google", `${String(empresa.nota_google).replace(".", ",")}${empresa.num_avaliacoes ? ` · ${empresa.num_avaliacoes} avaliações` : ""}`] : null,
  ].filter(Boolean) as [string, string][];

  return (
    <section id="sobre" className="premium-section aurora-about">
      <Reveal>
        <div className="aurora-about__inner">
          <div className="aurora-about__lead">
            <span className="aurora-label">Sobre</span>
            <h2>{gerarTituloSobre(empresa)}</h2>
            {empresa.logo_url && <div className="aurora-about__logo"><img src={empresa.logo_url} alt={nome}/></div>}
          </div>
          <div className="aurora-about__text">
            {sobre.map((texto, i) => <p key={i}>{texto}</p>)}
          </div>
          {fatos.length > 0 && <dl className="aurora-about__facts">
            {fatos.map(([rotulo, valor]) => (
              <div key={rotulo}><dt><Icon name="check" size={13} color={p.accent}/>{rotulo}</dt><dd>{valor}</dd></div>
            ))}
          </dl>}
        </div>
      </Reveal>
      <style>{`
        .aurora-about{background:${p.bg}}
        .aurora-about__inner{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,.94fr) minmax(0,1.2fr);gap:64px;align-items:start}
        .aurora-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
        .aurora-about h2{margin:20px 0 0;font-family:${font.display};font-weight:600;font-size:clamp(29px,3.6vw,44px);line-height:1.13;color:${p.text};text-wrap:balance}
        .aurora-about__logo{margin-top:30px;padding:26px;border:1px solid ${p.line};border-radius:22px;background:${p.card};display:flex;align-items:center;justify-content:center}
        .aurora-about__logo img{max-width:100%;max-height:120px;object-fit:contain}
        .aurora-about__text{padding-top:8px;min-width:0}
        .aurora-about__text p{margin:0 0 18px;font-family:${font.body};font-size:16px;line-height:1.85;color:${p.textMuted};overflow-wrap:anywhere}
        .aurora-about__text p:first-child{color:${p.text};font-size:19px;line-height:1.6;font-weight:500}
        .aurora-about__facts{grid-column:1/-1;margin:14px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}
        .aurora-about__facts>div{padding:20px 22px;border:1px solid ${p.line};border-radius:18px;background:${p.card}}
        .aurora-about__facts dt{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-family:${font.body};font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:${p.textMuted}}
        .aurora-about__facts dd{margin:0;font-family:${font.body};font-size:15px;font-weight:600;line-height:1.5;color:${p.text};overflow-wrap:anywhere}
        @media(max-width:900px){.aurora-about__inner{grid-template-columns:1fr;gap:30px}.aurora-about__text{padding-top:0}}
      `}</style>
    </section>
  );
}
