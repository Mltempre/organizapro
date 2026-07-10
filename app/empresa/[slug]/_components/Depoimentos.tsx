import Reveal from "./Reveal";
import { IcStarFilled } from "./icons";
import { initials } from "../_lib/helpers";
import type { DBDepoimento } from "../_lib/types";

// Só renderiza com dado real cadastrado — nunca depoimento, nome ou nota inventados.
export default function Depoimentos({ depoimentos }: { depoimentos: DBDepoimento[] }) {
  if (depoimentos.length === 0) return null;
  return (
    <section style={{ padding: "96px 24px", background: "#FAF7F2" }}>
      <Reveal>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#B8863D", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 12px" }}>Depoimentos</p>
            <h2 style={{ fontSize: "clamp(30px,3.8vw,44px)", fontWeight: 800, color: "#14110D", margin: 0, lineHeight: 1.2 }}>O que nossos clientes dizem</h2>
          </div>
          <div className="four-col" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
            {depoimentos.map(d => (
              <div key={d.id} style={{ background: "#ffffff", borderRadius: 18, padding: "26px 22px", border: "1px solid #E8E1D4" }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>{[1,2,3,4,5].map(s => <IcStarFilled key={s} size={14} color={s <= d.nota ? "#c9962c" : "#E8E1D4"}/>)}</div>
                <p style={{ fontSize: 14.5, color: "#6B6459", lineHeight: 1.75, margin: "0 0 20px", fontStyle: "italic" }}>&ldquo;{d.comentario}&rdquo;</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {d.foto_url
                    ? <img src={d.foto_url} alt={d.nome} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} loading="lazy"/>
                    : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#B8863D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#ffffff", flexShrink: 0 }}>{initials(d.nome)}</div>
                  }
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "#14110D" }}>{d.nome}</div>
                    {d.cidade && <div style={{ fontSize: 12, color: "#6B6459" }}>{d.cidade}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
