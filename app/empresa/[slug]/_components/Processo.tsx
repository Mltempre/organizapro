import Reveal, { RevealItem } from "./Reveal";
import { PROCESSO } from "../_lib/content";
import { eyebrow, radius } from "../_lib/theme";
import { font, paleta, type FamiliaId, type Tema, type Tone } from "../_lib/families";

// "Como funciona" — existia pronto no código e nunca aparecia em nenhum
// site publicado (achado da Fase 1). Só precisava ser ligado — e ganhar a
// mesma paleta de família dos demais blocos.
export default function Processo({ familiaId, tema, tone = "dark", variant = 1 }: { familiaId: FamiliaId; tema: Tema; tone?: Tone; variant?: 1 | 2 }) {
  const passos = PROCESSO[familiaId];
  const p = paleta(tema, tone, variant);
  return (
    <section style={{ padding: "112px 24px", background: p.bg }}>
      <Reveal>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: tema.primarySoft, border: `1px solid ${tema.primaryBorder}`, color: p.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 16, fontFamily: font.body }}>Como funciona</span>
            <h2 style={{ fontFamily: font.display, fontWeight: 600, fontSize: "clamp(27px,3.2vw,38px)", color: p.text, margin: 0, lineHeight: 1.2 }}>Do primeiro contato ao resultado</h2>
          </div>
          <div className="processo-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 40, position: "relative" }}>
            <div className="processo-line" style={{ position: "absolute", top: 21, left: "18%", right: "18%", height: 1, background: p.line }}/>
            {passos.map((passo, i) => (
              <RevealItem key={i} index={i} step={0.08}>
                <div style={{ position: "relative" }}>
                  <div style={{ fontFamily: font.display, fontSize: 14, fontWeight: 700, color: p.accent, background: p.bg, width: 42, height: 42, borderRadius: "50%", border: `1.5px solid ${p.accent}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative", zIndex: 1 }}>
                    {passo.numero}
                  </div>
                  <h3 style={{ fontFamily: font.body, fontSize: 16.5, fontWeight: 700, color: p.text, margin: "0 0 8px" }}>{passo.titulo}</h3>
                  <p style={{ fontFamily: font.body, fontSize: 14, color: p.textMuted, lineHeight: 1.7, margin: 0, maxWidth: 260 }}>{passo.desc}</p>
                </div>
              </RevealItem>
            ))}
          </div>
        </div>
      </Reveal>
      <style>{`@media(max-width:760px){.processo-grid{grid-template-columns:1fr!important;gap:34px!important}.processo-line{display:none}}`}</style>
    </section>
  );
}
