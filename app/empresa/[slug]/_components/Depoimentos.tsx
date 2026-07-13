import Reveal, { RevealItem } from "./Reveal";
import { IcStarFilled, Icon } from "./icons";
import { initials, gerarTituloDepoimentos } from "../_lib/helpers";
import { color, radius, gradient, eyebrow } from "../_lib/theme";
import type { DBDepoimento } from "../_lib/types";

// Só renderiza com dado real cadastrado — nunca depoimento, nome ou nota inventados.
export default function Depoimentos({ depoimentos }: { depoimentos: DBDepoimento[] }) {
  if (depoimentos.length === 0) return null;
  return (
    <section id="depoimentos" style={{ padding: "112px 24px", background: color.ink2 }}>
      <Reveal>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: color.accentSoft, border: `1px solid ${color.accentBorder}`, color: color.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 16 }}>Depoimentos</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 800, color: color.text, margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{gerarTituloDepoimentos()}</h2>
          </div>
          <div className="four-col" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {depoimentos.map((d, i) => (
              <RevealItem key={d.id} index={i} step={0.05}>
                <div className="dep-card" style={{ background: color.surface, borderRadius: radius.md, padding: "24px 22px", border: `1px solid ${color.line}`, height: "100%", display: "flex", flexDirection: "column", transition: "border-color 0.25s, transform 0.25s" }}>
                  <Icon name="quote" size={20} color={color.accentBorder}/>
                  <div style={{ display: "flex", gap: 3, margin: "12px 0 14px" }}>{[1,2,3,4,5].map(s => <IcStarFilled key={s} size={13} color={s <= d.nota ? color.star : color.line}/>)}</div>
                  <p style={{ fontSize: 14, color: color.textMuted, lineHeight: 1.7, margin: "0 0 20px", flex: 1 }}>&ldquo;{d.comentario}&rdquo;</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {d.foto_url
                      ? <img src={d.foto_url} alt={d.nome} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} loading="lazy"/>
                      : <div style={{ width: 36, height: 36, borderRadius: "50%", background: gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials(d.nome)}</div>
                    }
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: color.text }}>{d.nome}</div>
                      {d.cidade && <div style={{ fontSize: 11.5, color: color.textFaint }}>{d.cidade}</div>}
                    </div>
                  </div>
                </div>
              </RevealItem>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
