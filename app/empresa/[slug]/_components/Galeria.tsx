import Reveal from "./Reveal";
import type { DBGaleria, DBEstrutura } from "../_lib/types";

// Só renderiza com fotos reais cadastradas. Sem foto real, a seção fica
// oculta por completo — evita repetir a mesma composição abstrata do Hero
// e do Sobre pela terceira vez, e nunca inventa nem usa foto de banco de
// imagens genérico.
export default function Galeria({ galeria, estrutura }: { galeria: DBGaleria[]; estrutura: DBEstrutura[] }) {
  const fotos = [
    ...galeria.map(g => ({ id: g.id, url: g.url, titulo: g.titulo || g.categoria })),
    ...estrutura.map(e => ({ id: e.id, url: e.imagem_url, titulo: e.titulo })),
  ];
  if (fotos.length === 0) return null;

  return (
    <section style={{ padding: "104px 24px", background: "#ffffff" }}>
      <Reveal>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 56, maxWidth: 560 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#B8863D", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px" }}>Nosso espaço</p>
            <h2 style={{ fontSize: "clamp(28px,3.4vw,40px)", fontWeight: 700, color: "#14110D", margin: 0, lineHeight: 1.22 }}>Conheça um pouco mais</h2>
          </div>
          <div className="galeria-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gridAutoRows: 200, gap: 14 }}>
            {fotos.map((f, i) => (
              <div key={f.id} style={{ borderRadius: 14, overflow: "hidden", gridRow: i === 0 ? "span 2" : undefined }}>
                <img src={f.url} alt={f.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy"/>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
