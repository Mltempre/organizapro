import Reveal from "./Reveal";
import { gerarTituloGaleria } from "../_lib/helpers";
import { color, radius, eyebrow } from "../_lib/theme";
import type { DBGaleria, DBEstrutura, Empresa } from "../_lib/types";

// Só renderiza com fotos reais cadastradas. Sem foto real, a seção fica
// oculta por completo — nunca inventa nem usa foto de banco de imagens
// genérico.
export default function Galeria({ galeria, estrutura, empresa }: { galeria: DBGaleria[]; estrutura: DBEstrutura[]; empresa: Empresa }) {
  const fotos = [
    ...galeria.map(g => ({ id: g.id, url: g.url, titulo: g.titulo || g.categoria })),
    ...estrutura.map(e => ({ id: e.id, url: e.imagem_url, titulo: e.titulo })),
  ];
  if (fotos.length === 0) return null;

  return (
    <section style={{ padding: "112px 24px", background: color.ink }}>
      <Reveal>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ marginBottom: 48, maxWidth: 560 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: color.accentSoft, border: `1px solid ${color.accentBorder}`, color: color.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 18 }}>Nosso espaço</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 800, color: color.text, margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{gerarTituloGaleria(empresa)}</h2>
          </div>
          <div className="galeria-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gridAutoRows: 200, gap: 12 }}>
            {fotos.map((f, i) => (
              <div key={f.id} className="galeria-item" style={{ borderRadius: radius.md, overflow: "hidden", gridRow: i === 0 ? "span 2" : undefined, position: "relative", border: `1px solid ${color.line}` }}>
                <img src={f.url} alt={f.titulo} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease" }} loading="lazy"/>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
