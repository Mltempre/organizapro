import Reveal from "./Reveal";
import { Icon } from "./icons";
import { SERVICOS_FALLBACK } from "../_lib/content";
import type { DBServico } from "../_lib/types";

export default function Servicos({ servicos }: { servicos: DBServico[] }) {
  const showReal = servicos.length > 0;
  const lista = showReal
    ? servicos.map(s => ({ nome: s.nome, desc: s.descricao || "", imagem: s.imagem_url }))
    : SERVICOS_FALLBACK.map(s => ({ nome: s.nome, desc: s.desc, icone: s.icone }));

  return (
    <section id="servicos" style={{ padding: "104px 24px", background: "#FAF7F2" }}>
      <Reveal>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ marginBottom: 64, maxWidth: 560 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#B8863D", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px" }}>O que oferecemos</p>
            <h2 style={{ fontSize: "clamp(28px,3.4vw,40px)", fontWeight: 700, color: "#14110D", margin: 0, lineHeight: 1.22 }}>Nossos serviços</h2>
          </div>
          <div>
            {lista.map((s, i) => (
              <div key={i} className="servico-row" style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 28, padding: "32px 0", borderTop: "1px solid #E8E1D4" }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#B8863D", display: "block" }}>{String(i + 1).padStart(2, "0")}</span>
                  {"icone" in s && s.icone && (
                    <div style={{ marginTop: 12 }}><Icon name={s.icone} size={18} color="#B8863D"/></div>
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: 19, fontWeight: 700, color: "#14110D", margin: "0 0 10px" }}>{s.nome}</h3>
                  {s.desc && <p style={{ fontSize: 15, color: "#6B6459", lineHeight: 1.75, margin: 0, maxWidth: 560 }}>{s.desc}</p>}
                  {"imagem" in s && s.imagem && (
                    <div style={{ marginTop: 18, borderRadius: 12, overflow: "hidden", maxWidth: 420, aspectRatio: "16/9" }}>
                      <img src={s.imagem} alt={s.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy"/>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #E8E1D4" }}/>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
