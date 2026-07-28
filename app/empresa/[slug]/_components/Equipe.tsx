import Reveal, { RevealItem } from "./Reveal";
import { initials } from "../_lib/helpers";
import { radius, eyebrow, gradienteDe } from "../_lib/theme";
import { font, paleta, type Tema, type Tone } from "../_lib/families";
import type { DBEquipe } from "../_lib/types";

// Só renderiza com equipe real cadastrada — nunca nome ou cargo inventado.
export default function Equipe({ equipe, tema, tone = "dark", variant = 2 }: { equipe: DBEquipe[]; tema: Tema; tone?: Tone; variant?: 1 | 2 }) {
  if (equipe.length === 0) return null;
  const p = paleta(tema, tone, variant);
  return (
    <section id="equipe" style={{ padding: "112px 24px", background: p.bg }}>
      <Reveal>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ marginBottom: 48, maxWidth: 560 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: tema.primarySoft, border: `1px solid ${tema.primaryBorder}`, color: p.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 18, fontFamily: font.body }}>Equipe</span>
            <h2 style={{ fontFamily: font.display, fontWeight: 600, fontSize: "clamp(27px,3.2vw,38px)", color: p.text, margin: 0, lineHeight: 1.2 }}>Quem cuida do seu atendimento</h2>
          </div>
          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
            {equipe.map((m, i) => (
              <RevealItem key={m.id} index={i}>
                <div style={{ background: p.card, borderRadius: tema.radius, border: `1px solid ${p.line}`, padding: 26, height: "100%", textAlign: "center", transition: "border-color 0.25s, transform 0.25s" }}>
                  {m.foto_url ? (
                    <img src={m.foto_url} alt={m.nome} style={{ width: 76, height: 76, borderRadius: "50%", objectFit: "cover", margin: "0 auto 16px" }} loading="lazy"/>
                  ) : (
                    <div style={{ width: 76, height: 76, borderRadius: "50%", background: gradienteDe(tema), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#0c0f12", margin: "0 auto 16px", fontFamily: font.display }}>
                      {initials(m.nome)}
                    </div>
                  )}
                  <h3 style={{ fontFamily: font.body, fontSize: 16, fontWeight: 700, color: p.text, margin: "0 0 4px" }}>{m.nome}</h3>
                  {m.especialidade && <div style={{ fontFamily: font.body, fontSize: 12.5, color: p.accent, fontWeight: 600, marginBottom: 10 }}>{m.especialidade}</div>}
                  {m.descricao && <p style={{ fontFamily: font.body, fontSize: 13.5, color: p.textMuted, lineHeight: 1.65, margin: 0 }}>{m.descricao}</p>}
                </div>
              </RevealItem>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
