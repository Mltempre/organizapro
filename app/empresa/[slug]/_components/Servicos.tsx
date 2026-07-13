import Reveal, { RevealItem } from "./Reveal";
import { Icon } from "./icons";
import { SERVICOS_FALLBACK } from "../_lib/content";
import { gerarTituloServicos } from "../_lib/helpers";
import { color, radius, eyebrow } from "../_lib/theme";
import type { DBServico, Empresa } from "../_lib/types";

export default function Servicos({ servicos, empresa }: { servicos: DBServico[]; empresa: Empresa }) {
  const showReal = servicos.length > 0;
  const lista = showReal
    ? servicos.map(s => ({ nome: s.nome, desc: s.descricao || "", imagem: s.imagem_url, icone: undefined as string | undefined }))
    : SERVICOS_FALLBACK.map(s => ({ nome: s.nome, desc: s.desc, icone: s.icone as string | undefined, imagem: null }));

  return (
    <section id="servicos" style={{ padding: "112px 24px", background: color.ink2 }}>
      <Reveal>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ marginBottom: 56, maxWidth: 560 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: color.accentSoft, border: `1px solid ${color.accentBorder}`, color: color.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 18 }}>O que oferecemos</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 800, color: color.text, margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{gerarTituloServicos(empresa)}</h2>
          </div>
          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
            {lista.map((s, i) => (
              <RevealItem key={i} index={i}>
                <div className="servico-card" style={{ background: color.surface, borderRadius: radius.md, border: `1px solid ${color.line}`, padding: 28, height: "100%", transition: "border-color 0.25s, transform 0.25s, background 0.25s" }}>
                  {s.imagem ? (
                    <div style={{ borderRadius: radius.sm, overflow: "hidden", aspectRatio: "16/9", marginBottom: 20 }}>
                      <img src={s.imagem} alt={s.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy"/>
                    </div>
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: radius.sm, background: color.accentSoft, border: `1px solid ${color.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                      <Icon name={s.icone || "target"} size={19} color={color.accent}/>
                    </div>
                  )}
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: color.text, margin: "0 0 8px" }}>{s.nome}</h3>
                  {s.desc && <p style={{ fontSize: 14, color: color.textMuted, lineHeight: 1.7, margin: 0 }}>{s.desc}</p>}
                </div>
              </RevealItem>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
