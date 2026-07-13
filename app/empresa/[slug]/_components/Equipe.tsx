import Reveal, { RevealItem } from "./Reveal";
import { initials } from "../_lib/helpers";
import { color, radius, gradient, eyebrow } from "../_lib/theme";
import type { DBEquipe } from "../_lib/types";

// Só renderiza com equipe real cadastrada — nunca nome ou cargo inventado.
export default function Equipe({ equipe }: { equipe: DBEquipe[] }) {
  if (equipe.length === 0) return null;
  return (
    <section id="equipe" style={{ padding: "112px 24px", background: color.ink }}>
      <Reveal>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ marginBottom: 48, maxWidth: 560 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: color.accentSoft, border: `1px solid ${color.accentBorder}`, color: color.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 18 }}>Equipe</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 800, color: color.text, margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>Quem cuida do seu atendimento</h2>
          </div>
          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
            {equipe.map((m, i) => (
              <RevealItem key={m.id} index={i}>
                <div className="servico-card" style={{ background: color.surface, borderRadius: radius.md, border: `1px solid ${color.line}`, padding: 26, height: "100%", textAlign: "center", transition: "border-color 0.25s, transform 0.25s, background 0.25s" }}>
                  {m.foto_url ? (
                    <img src={m.foto_url} alt={m.nome} style={{ width: 76, height: 76, borderRadius: "50%", objectFit: "cover", margin: "0 auto 16px" }} loading="lazy"/>
                  ) : (
                    <div style={{ width: 76, height: 76, borderRadius: "50%", background: gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 auto 16px" }}>
                      {initials(m.nome)}
                    </div>
                  )}
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: color.text, margin: "0 0 4px" }}>{m.nome}</h3>
                  {m.especialidade && <div style={{ fontSize: 12.5, color: color.accent, fontWeight: 600, marginBottom: 10 }}>{m.especialidade}</div>}
                  {m.descricao && <p style={{ fontSize: 13.5, color: color.textMuted, lineHeight: 1.65, margin: 0 }}>{m.descricao}</p>}
                </div>
              </RevealItem>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
